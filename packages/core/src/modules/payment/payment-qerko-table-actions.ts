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
  type QerkoTableOffer,
} from "./payment-qerko-table-utils.ts"
import { paymentByIdQuery } from "./payment-queries.ts"

/**
 * Qerko's table flow (qerko/0017, qerko/0018): a guest scans Qerko's QR code
 * on a table, Qerko asks for the table's open bills and the guest pays one
 * of them whole. Whether the flow is on is the caller's to judge
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
 * What a bill offers Qerko (qerko/0018), judged by its live status rather
 * than the `closedAt` cache; `null` when it is closed, discarded or has
 * nothing left to pay, which Qerko reads as `BILL_CLOSED`.
 */
const offerFromSnapshot = (
  snapshot: BillStatusSnapshot
): QerkoTableOfferSnapshot | null => {
  if (snapshot.status !== "open") return null
  const offer = deriveQerkoTableOffer({
    summaries: snapshot.items,
    ledger: snapshot.ledger.lineRows,
    claimedSum: snapshot.claimedSum,
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
    const snapshots = await Promise.all(
      bills.map((bill) => run(loadBillStatusSnapshot(bill.id)))
    )
    return ok(
      snapshots.flatMap((snapshot) => {
        const offered = snapshot.ok ? offerFromSnapshot(snapshot.value) : null
        return offered === null ? [] : [offered.bill]
      })
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
    const snapshot = await run(loadBillStatusSnapshot(billId))
    if (!snapshot.ok) return err(createQerkoBillNotFoundError({ idBill }))
    const offered = offerFromSnapshot(snapshot.value)
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
 * second payer off it too. Qerko's items must be exactly what the bill offers
 * now (`INVALID_DATA`, Qerko refreshes the bill).
 *
 * Then a payment of what is left is made for the bill, taken through Qerko
 * payments, its id derived from Qerko's payment id, and the attempt is
 * recorded on it as a direct one's is. That payment is pending, which locks
 * the bill until Qerko's answer: `PAID` records the money and closes the bill
 * once covered, any other end cancels the payment (`settleQerkoPayment`).
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

    // This start's own payment, made before an interruption — a crash, a
    // closed tab — kept its attempt from being written. That payment is what
    // locks the bill now, so the guard below would refuse the start that
    // made it; the start is finished instead, which lets Qerko's answer
    // settle the payment.
    const paymentId = createQerkoTablePaymentId(wire.id)
    const [existing] = await run.deps.evolu.loadQuery(
      paymentByIdQuery(paymentId)
    )
    if (existing !== undefined) {
      if (existing.billId !== billId || existing.canceledAt !== null) {
        return err(createQerkoBillClosedError({ id: billId }))
      }
      return await run(
        recordQerkoPaymentStart({
          wire,
          paymentId,
          currency: existing.currency,
        })
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

    const offered = offerFromSnapshot(editable.value)
    if (offered === null) return err(createQerkoBillClosedError({ id: billId }))
    const { bill: billRow } = offered.snapshot
    const mismatch = checkQerkoTablePaymentStart({
      wire,
      offered: offered.bill,
      currency: billRow.currency,
    })
    if (mismatch !== null) {
      return err(createQerkoInvalidDataError({ id: billId, reason: mismatch }))
    }

    const created = await run(
      createPayment({
        id: paymentId,
        deviceId,
        billId,
        tableId: billRow.tableId,
        amount: offered.offer.restAmount,
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
      recordQerkoPaymentStart({ wire, paymentId, currency: billRow.currency })
    )
  }
