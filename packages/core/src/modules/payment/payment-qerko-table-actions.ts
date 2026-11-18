import { err, ok, type Result, type Task } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type {
  QerkoBill,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { qerkoPaymentAccountQuery } from "../account/account-queries.ts"
import {
  type BillStatusSnapshot,
  loadBillStatusSnapshot,
  requireEditableBill,
} from "../bill/bill-guards.ts"
import { openBillsByTableIdQuery } from "../bill/bill-queries.ts"
import { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255Schema,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { tableByCodeQuery, tablesQuery } from "../table/table-queries.ts"
import type { PaymentRow } from "./payment.ts"
import { createPayment } from "./payment-actions.ts"
import {
  type CreatePaymentError,
  createQerkoBillClosedError,
  createQerkoBillLockedError,
  createQerkoBillNotFoundError,
  createQerkoInvalidDataError,
  type QerkoBillClosedError,
  type QerkoBillNotFoundError,
  type ResolveQerkoBillError,
  type StartQerkoPaymentError,
} from "./payment-errors.ts"
import { recordQerkoPaymentStart } from "./payment-qerko-payment-actions.ts"
import {
  checkQerkoTablePaymentStart,
  createQerkoTableBill,
  createQerkoTableList,
  createQerkoTablePaymentId,
  deriveQerkoTableOffer,
  type QerkoAttemptPaidLines,
  QerkoPaidLinesJson,
  type QerkoTableOffer,
} from "./payment-qerko-table-utils.ts"
import {
  paymentByIdQuery,
  qerkoPaidLinesByBillIdQuery,
} from "./payment-queries.ts"

/**
 * Qerko's table flow (qerko/0017, qerko/0018): a guest scans Qerko's QR code
 * on a table, Qerko asks for the table's open bills and the guest pays one
 * of them, or part of it. Whether the flow is on is the caller's to judge
 * (`payment-qerko-pos-actions.ts`, qerko/0016); these answer as if it were.
 */

/** `getTableList`: the catalog's tables, by code (qerko/0017). */
export const listQerkoTables =
  (): Task<ReadonlyArray<QerkoTable>, never, EvoluDep> => async (run) =>
    ok(createQerkoTableList(await run.deps.evolu.loadQuery(tablesQuery)))

interface QerkoTableOfferSnapshot {
  readonly snapshot: BillStatusSnapshot
  readonly offer: QerkoTableOffer
  readonly bill: QerkoBill
}

/**
 * The lines Qerko attempts of a bill paid or are paying (qerko/0018); a
 * failed attempt took none. A record that does not read is left out, which
 * leaves its money untied to lines and the bill offered as its rest.
 */
const loadQerkoAttemptPaidLines =
  (
    billId: BillId
  ): Task<ReadonlyArray<QerkoAttemptPaidLines>, never, EvoluDep> =>
  async (run) => {
    const rows = await run.deps.evolu.loadQuery(
      qerkoPaidLinesByBillIdQuery(billId)
    )
    return ok(
      rows.flatMap((row): ReadonlyArray<QerkoAttemptPaidLines> => {
        if (row.closedAt !== null && row.outcome !== "paid") return []
        const lines = QerkoPaidLinesJson.safeDecode(row.paidLines)
        return lines.success
          ? [{ paid: row.outcome === "paid", lines: lines.data }]
          : []
      })
    )
  }

/**
 * What a bill offers Qerko (qerko/0018), judged by its live status rather
 * than the `closedAt` cache; `null` when it is closed, discarded or has
 * nothing left to pay, which Qerko reads as `BILL_CLOSED`.
 */
const offerFromSnapshot = (
  snapshot: BillStatusSnapshot,
  attempts: ReadonlyArray<QerkoAttemptPaidLines>
): QerkoTableOfferSnapshot | null => {
  if (snapshot.status !== "open") return null
  const offer = deriveQerkoTableOffer({
    summaries: snapshot.items,
    ledger: snapshot.ledger.lineRows,
    claimedSum: snapshot.claimedSum,
    attempts,
  })
  if (offer === null) return null
  return {
    snapshot,
    offer,
    bill: createQerkoTableBill({ bill: snapshot.bill, offer }),
  }
}

/**
 * `getTableContents(code)`: the open bills of the table with that code
 * (qerko/0017), the one opened first first, each as `createQerkoTableBill`
 * makes it. A bill with nothing left to pay is left out; a bill another
 * payment locks is listed, and `paymentStart` answers `BILL_LOCKED`. An
 * unknown code is an empty table: Qerko's protocol has no error for it.
 */
export const listQerkoTableBills =
  (code: string): Task<ReadonlyArray<QerkoBill>, never, EvoluDep> =>
  async (run) => {
    const tableCode = NonEmptyString255Schema.safeParse(code)
    if (!tableCode.success) return ok([])
    const [table] = await run.deps.evolu.loadQuery(
      tableByCodeQuery(tableCode.data)
    )
    if (table === undefined) return ok([])

    const bills = await run.deps.evolu.loadQuery(
      openBillsByTableIdQuery(table.id)
    )
    const offers = await Promise.all(
      bills.map(async (bill) => {
        const [snapshot, attempts] = await Promise.all([
          run(loadBillStatusSnapshot(bill.id)),
          run.ok(loadQerkoAttemptPaidLines(bill.id)),
        ])
        return snapshot.ok ? offerFromSnapshot(snapshot.value, attempts) : null
      })
    )
    return ok(
      offers.flatMap((offered) => (offered === null ? [] : [offered.bill]))
    )
  }

/** A Qerko bill id as one of Payky's bills, or not found. */
const parseQerkoTableBillId = (
  idBill: string
): Result<BillId, QerkoBillNotFoundError> => {
  const billId = BillId.safeParse(idBill)
  return billId.success
    ? ok(billId.data)
    : err(createQerkoBillNotFoundError({ idBill }))
}

/**
 * `getBill` for a table's bill: the bill as `getTableContents` lists it,
 * wherever its table is (qerko/0018), `BILL_NOT_FOUND` for no such bill and
 * `BILL_CLOSED` for one closed, discarded or with nothing left to pay.
 */
export const resolveQerkoTableBill =
  (idBill: string): Task<QerkoBill, ResolveQerkoBillError, EvoluDep> =>
  async (run) => {
    const parsed = parseQerkoTableBillId(idBill)
    if (!parsed.ok) return parsed
    const billId = parsed.value
    const [snapshot, attempts] = await Promise.all([
      run(loadBillStatusSnapshot(billId)),
      run.ok(loadQerkoAttemptPaidLines(billId)),
    ])
    if (!snapshot.ok) return err(createQerkoBillNotFoundError({ idBill }))
    const offered = offerFromSnapshot(snapshot.value, attempts)
    return offered === null
      ? err(createQerkoBillClosedError({ id: billId }))
      : ok(offered.bill)
  }

/** How `createPayment` refusing a table's payment reads to Qerko. */
const createPaymentRefusals = {
  BillNotFound: "QerkoBillNotFound",
  BillStatusNotAllowed: "QerkoBillClosed",
  BillTotalNotPositive: "QerkoBillClosed",
  NoPayableMethod: "QerkoBillClosed",
} as const satisfies Record<
  CreatePaymentError["type"],
  QerkoBillNotFoundError["type"] | QerkoBillClosedError["type"]
>

/**
 * `paymentStart` for a table's bill (qerko/0018). The bill must still be
 * open, have something left to pay, and no payment in flight (`BILL_LOCKED`):
 * the editing lock that keeps staff from changing a bill mid-payment keeps a
 * second payer off it too. Qerko's items must be what the bill offers now —
 * lines still unpaid, or part of them where the bill may be split — or the
 * rest whole (`INVALID_DATA`, Qerko refreshes the bill).
 *
 * Then a payment of those items is made for the bill, taken through Qerko
 * payments, its id derived from Qerko's payment id, and the attempt is
 * recorded on it with the lines it pays. That payment is pending, which
 * locks the bill until Qerko's answer: `PAID` records the money, closing the
 * bill once covered, any other end cancels the payment
 * (`settleQerkoPayment`).
 */
export const startQerkoTablePayment =
  ({
    wire,
    deviceId,
  }: {
    readonly wire: QerkoWirePayment
    /** The device holding the connection, which makes the payment. */
    readonly deviceId: DeviceId | null
  }): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const parsed = parseQerkoTableBillId(wire.idBill)
    if (!parsed.ok) return parsed
    const billId = parsed.value

    const paymentId = createQerkoTablePaymentId(wire.id)
    const [[existing], attempts] = await Promise.all([
      run.deps.evolu.loadQuery(paymentByIdQuery(paymentId)),
      run.ok(loadQerkoAttemptPaidLines(billId)),
    ])
    if (existing !== undefined) {
      return await run(
        finishInterruptedStart({ wire, billId, payment: existing, attempts })
      )
    }

    const [editable, [account]] = await Promise.all([
      run(requireEditableBill(billId)),
      run.deps.evolu.loadQuery(qerkoPaymentAccountQuery),
    ])
    if (account === undefined || account.isDeleted === 1) {
      return err(createQerkoBillNotFoundError({ idBill: wire.idBill }))
    }
    if (!editable.ok) {
      switch (editable.error.type) {
        case "BillNotFound":
          return err(createQerkoBillNotFoundError({ idBill: wire.idBill }))
        case "BillStatusNotAllowed":
          return err(createQerkoBillClosedError({ id: billId }))
        case "BillLocked":
          return err(
            createQerkoBillLockedError({ id: billId, qerkoPaymentId: null })
          )
      }
    }

    const offered = offerFromSnapshot(editable.value, attempts)
    if (offered === null) return err(createQerkoBillClosedError({ id: billId }))
    const { bill: billRow } = offered.snapshot
    const start = checkQerkoTablePaymentStart({
      wire,
      offer: offered.offer,
      billId,
      currency: billRow.currency,
    })
    if (!start.ok) {
      return err(
        createQerkoInvalidDataError({ id: billId, reason: start.error })
      )
    }

    const created = await run(
      createPayment({
        id: paymentId,
        deviceId,
        billId,
        tableId: billRow.tableId,
        amount: start.value.amount,
        currency: billRow.currency,
        // The guest tips in Qerko, and that tip replaces this one once paid
        // (qerko/0015).
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        qerkoPayment: { accountId: account.id },
      })
    )
    if (!created.ok) {
      const refusal = createPaymentRefusals[created.error.type]
      return err(
        refusal === "QerkoBillNotFound"
          ? createQerkoBillNotFoundError({ idBill: wire.idBill })
          : createQerkoBillClosedError({ id: billId })
      )
    }

    return await run(
      recordQerkoPaymentStart({
        wire,
        paymentId,
        currency: billRow.currency,
        paidLines: start.value.paidLines,
      })
    )
  }

/**
 * Finishes a start whose payment was made, but whose attempt an
 * interruption — a crash, a closed tab — kept from being written. That
 * payment is what locks the bill now, so the lock would refuse the start
 * that made it; recording the attempt lets Qerko's answer settle it. The
 * lines it pays are read again from the bill as it stands, which its own
 * lock kept still; should they no longer match, it is recorded without
 * them, and its money then reads as untied to lines. A payment staff
 * canceled meanwhile is `BILL_CLOSED`.
 */
const finishInterruptedStart =
  ({
    wire,
    billId,
    payment,
    attempts,
  }: {
    readonly wire: QerkoWirePayment
    readonly billId: BillId
    readonly payment: Pick<PaymentRow, "billId" | "canceledAt" | "currency">
    readonly attempts: ReadonlyArray<QerkoAttemptPaidLines>
  }): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    if (payment.billId !== billId || payment.canceledAt !== null) {
      return err(createQerkoBillClosedError({ id: billId }))
    }
    const snapshot = await run(loadBillStatusSnapshot(billId))
    const offered = snapshot.ok
      ? offerFromSnapshot(snapshot.value, attempts)
      : null
    const start =
      offered === null
        ? null
        : checkQerkoTablePaymentStart({
            wire,
            offer: offered.offer,
            billId,
            currency: payment.currency,
          })
    return await run(
      recordQerkoPaymentStart({
        wire,
        paymentId: createQerkoTablePaymentId(wire.id),
        currency: payment.currency,
        paidLines: start?.ok === true ? start.value.paidLines : null,
      })
    )
  }
