import { err, ok, type Result, type Task } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type {
  QerkoBill,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { qerkoPaymentAccountQuery } from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  type SplitBillError,
  splitBillIntoNewBill,
} from "../bill/bill-actions.ts"
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
  createQerkoTableSplitBillId,
  deriveQerkoTableOffer,
  type QerkoTableOffer,
} from "./payment-qerko-table-utils.ts"
import { paymentByIdQuery } from "./payment-queries.ts"

/**
 * Qerko's table flow (qerko/0017, qerko/0018): a guest scans Qerko's QR code
 * on a table, Qerko asks for the table's open bills and the guest pays one
 * of them, or part of it split off into a bill of its own. Whether the flow
 * is on is the caller's to judge (`payment-qerko-pos-actions.ts`,
 * qerko/0016); these answer as if it were.
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
 * makes it. A bill with nothing left to pay is left out, and so is one a
 * payment is paying now — another guest's part split off, or a bill paid
 * whole — which has nothing to pay until that payment ends. An unknown code
 * is an empty table: Qerko's protocol has no error for it.
 */
export const listQerkoTableBills =
  (code: string): Task<ReadonlyArray<QerkoBill>, never, EvoluDep & DateDep> =>
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
    const editable = await Promise.all(
      bills.map((bill) => run(requireEditableBill(bill.id)))
    )
    return ok(
      editable.flatMap((snapshot) => {
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
 * `BILL_CLOSED` for one closed, discarded or with nothing left to pay. A bill
 * a payment is paying now is answered too, and `paymentStart` then says
 * `BILL_LOCKED`.
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

/**
 * How a refusal of the bill a payment is for reads to Qerko: the bill gone
 * is `BILL_NOT_FOUND`, a payment in flight `BILL_LOCKED`, a selection the
 * bill no longer holds or cannot split `INVALID_DATA`, and anything else
 * that leaves nothing to pay `BILL_CLOSED`.
 */
const billRefusals = {
  BillNotFound: "QerkoBillNotFound",
  BillStatusNotAllowed: "QerkoBillClosed",
  BillLocked: "QerkoBillLocked",
  BillTotalBelowPaid: "QerkoInvalidData",
  BillSplitSameBill: "QerkoInvalidData",
  BillSplitSelectionStale: "QerkoInvalidData",
  BillSplitTotalNegative: "QerkoInvalidData",
  BillTotalNotPositive: "QerkoBillClosed",
  NoPayableMethod: "QerkoBillClosed",
} as const satisfies Record<
  SplitBillError["type"] | CreatePaymentError["type"],
  StartQerkoPaymentError["type"]
>

const refuseBill = ({
  type,
  billId,
  idBill,
}: {
  readonly type: keyof typeof billRefusals
  readonly billId: BillId
  readonly idBill: string
}): StartQerkoPaymentError => {
  switch (billRefusals[type]) {
    case "QerkoBillNotFound":
      return createQerkoBillNotFoundError({ idBill })
    case "QerkoBillClosed":
      return createQerkoBillClosedError({ id: billId })
    case "QerkoBillLocked":
      return createQerkoBillLockedError({ id: billId, qerkoPaymentId: null })
    case "QerkoInvalidData":
      return createQerkoInvalidDataError({ id: billId, reason: "items" })
  }
}

/**
 * Makes the table's payment of `billId` for `amount` and records its start
 * (qerko/0018): taken through Qerko payments, its id derived from Qerko's
 * payment id, its tip zero until the guest's Qerko tip replaces it
 * (qerko/0015). Pending, it locks that bill until Qerko's answer.
 */
const payTableBill =
  ({
    wire,
    deviceId,
    accountId,
    billId,
    tableId,
    amount,
    currency,
    splitFromBillId,
  }: {
    readonly wire: QerkoWirePayment
    readonly deviceId: DeviceId | null
    readonly accountId: AccountId
    readonly billId: BillId
    readonly tableId: BillStatusSnapshot["bill"]["tableId"]
    readonly amount: NonNegativeInteger
    readonly currency: BillStatusSnapshot["bill"]["currency"]
    readonly splitFromBillId: BillId | null
  }): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const paymentId = createQerkoTablePaymentId(wire.id)
    const created = await run(
      createPayment({
        id: paymentId,
        deviceId,
        billId,
        tableId,
        amount,
        currency,
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        qerkoPayment: { accountId },
      })
    )
    if (!created.ok) {
      return err(
        refuseBill({
          type: created.error.type,
          billId: splitFromBillId ?? billId,
          idBill: wire.idBill,
        })
      )
    }
    return await run(
      recordQerkoPaymentStart({ wire, paymentId, currency, splitFromBillId })
    )
  }

/**
 * `paymentStart` for a table's bill (qerko/0018). The bill must still be
 * open, have something left to pay and no payment in flight (`BILL_LOCKED`),
 * and Qerko's items must be what it offers now — all of it, part of it where
 * it may be split, or its rest (`INVALID_DATA`, Qerko refreshes the bill).
 *
 * A guest paying the whole bill pays it. A guest paying part of it has that
 * part split off into a bill of its own on the same table, its id derived
 * from Qerko's payment id, and pays that bill whole: the rest stays open,
 * and unlocked, for the other guests. Either way the payment is pending and
 * locks the bill it pays until Qerko's answer: `PAID` records the money and
 * closes that bill, any other end cancels the payment and moves a part's
 * lines back (`settleQerkoPayment`).
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
    const partBillId = createQerkoTableSplitBillId(wire.id)

    const [[existing], [account], part] = await Promise.all([
      run.deps.evolu.loadQuery(
        paymentByIdQuery(createQerkoTablePaymentId(wire.id))
      ),
      run.deps.evolu.loadQuery(qerkoPaymentAccountQuery),
      run(loadBillStatusSnapshot(partBillId)),
    ])
    if (existing !== undefined) {
      return await run(finishInterruptedStart({ wire, billId, existing }))
    }
    if (account === undefined || account.isDeleted === 1) {
      return err(createQerkoBillNotFoundError({ idBill: wire.idBill }))
    }
    // The part was split off, and an interruption kept its payment from
    // being made: it is paid as it stands.
    if (part.ok) {
      return await run(
        payTableBill({
          wire,
          deviceId,
          accountId: account.id,
          billId: partBillId,
          tableId: part.value.bill.tableId,
          amount: NonNegativeInteger(Math.max(0, part.value.billTotal)),
          currency: part.value.bill.currency,
          splitFromBillId: billId,
        })
      )
    }

    const editable = await run(requireEditableBill(billId))
    if (!editable.ok) {
      return err(
        refuseBill({ type: editable.error.type, billId, idBill: wire.idBill })
      )
    }
    const offered = offerFromSnapshot(editable.value)
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

    const { split, amount } = start.value
    if (split !== null) {
      const splitted = await run(
        splitBillIntoNewBill({
          deviceId,
          tableId: billRow.tableId,
          currency: billRow.currency,
          sourceBillId: billId,
          targetBillId: partBillId,
          items: split,
        })
      )
      if (!splitted.ok) {
        return err(
          refuseBill({ type: splitted.error.type, billId, idBill: wire.idBill })
        )
      }
    }

    return await run(
      payTableBill({
        wire,
        deviceId,
        accountId: account.id,
        billId: split === null ? billId : partBillId,
        tableId: billRow.tableId,
        amount,
        currency: billRow.currency,
        splitFromBillId: split === null ? null : billId,
      })
    )
  }

/**
 * Finishes a start whose payment was made, but whose attempt an
 * interruption — a crash, a closed tab — kept from being written. That
 * payment is what locks its bill now, so the lock would refuse the start
 * that made it; recording the attempt lets Qerko's answer settle it. A
 * payment staff canceled meanwhile is `BILL_CLOSED`.
 */
const finishInterruptedStart =
  ({
    wire,
    billId,
    existing,
  }: {
    readonly wire: QerkoWirePayment
    readonly billId: BillId
    readonly existing: Pick<PaymentRow, "billId" | "canceledAt" | "currency">
  }): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const partBillId = createQerkoTableSplitBillId(wire.id)
    const ownBill = existing.billId === billId || existing.billId === partBillId
    if (!ownBill || existing.canceledAt !== null) {
      return err(createQerkoBillClosedError({ id: billId }))
    }
    return await run(
      recordQerkoPaymentStart({
        wire,
        paymentId: createQerkoTablePaymentId(wire.id),
        currency: existing.currency,
        splitFromBillId: existing.billId === partBillId ? billId : null,
      })
    )
  }
