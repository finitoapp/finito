import { err, ok, type Task } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type {
  QerkoBill,
  QerkoTable,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { qerkoPaymentAccountQuery } from "../account/account-queries.ts"
import {
  deriveQerkoPaymentFlows,
  type QerkoPaymentFlows,
} from "../account/account-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createQerkoBillNotFoundError,
  type ResolveQerkoBillError,
  type StartQerkoPaymentError,
} from "./payment-errors.ts"
import {
  resolveQerkoBill,
  startQerkoPayment,
} from "./payment-qerko-payment-actions.ts"
import { createQerkoPaymentAttemptId } from "./payment-qerko-payment-utils.ts"
import {
  listQerkoTableBills,
  listQerkoTables,
  resolveQerkoTableBill,
  startQerkoTablePayment,
} from "./payment-qerko-table-actions.ts"
import { qerkoPaymentAttemptByIdQuery } from "./payment-queries.ts"

/**
 * What Payky answers each of Qerko's POS calls with, by the flows the
 * merchant turned on (qerko/0016): a QR code for one payment (direct,
 * `payment-qerko-payment-actions.ts`) and a table's open bill
 * (`payment-qerko-table-actions.ts`, qerko/0017, qerko/0018). A flow that is
 * off answers as if Payky had nothing for it: an empty list where Qerko asks
 * for one, `BILL_NOT_FOUND` where it names a bill. What follows a payment's
 * start — `paymentProcessed`, `paymentClosed`, `get-payment` — is answered
 * whatever the switches say, since the customer's money is already moving.
 */

/** Which flows are on; a switch never written, or no account, reads as on. */
export const loadQerkoPaymentFlows =
  (): Task<QerkoPaymentFlows, never, EvoluDep> => async (run) => {
    const [account] = await run.deps.evolu.loadQuery(qerkoPaymentAccountQuery)
    return ok(deriveQerkoPaymentFlows(account))
  }

/**
 * `searchBills(qr)`: the payment a Payky QR code names (direct flow), or
 * none — also while the direct flow is off.
 */
export const answerQerkoSearchBills =
  (
    qrIdentifier: string
  ): Task<
    ReadonlyArray<QerkoBill>,
    ResolveQerkoBillError,
    EvoluDep & DateDep
  > =>
  async (run) => {
    const flows = await run.ok(loadQerkoPaymentFlows())
    if (!flows.direct) return ok([])
    const bill = await run(resolveQerkoBill(qrIdentifier))
    if (bill.ok) return ok([bill.value])
    return bill.error.type === "QerkoBillNotFound" ? ok([]) : bill
  }

/**
 * `getBill(id)`: a payment's bill (direct flow) or a table's bill, each only
 * while its flow is on. The two kinds of id never meet: a payment's id names
 * no bill and a bill's no payment.
 */
export const answerQerkoGetBill =
  (
    idBill: string
  ): Task<QerkoBill, ResolveQerkoBillError, EvoluDep & DateDep> =>
  async (run) => {
    const flows = await run.ok(loadQerkoPaymentFlows())
    if (flows.direct) {
      const bill = await run(resolveQerkoBill(idBill))
      if (bill.ok || bill.error.type !== "QerkoBillNotFound") return bill
    }
    if (flows.table) return await run(resolveQerkoTableBill(idBill))
    return err(createQerkoBillNotFoundError({ idBill }))
  }

/** `getTableList()`: the catalog's tables, none while the table flow is off. */
export const answerQerkoGetTableList =
  (): Task<ReadonlyArray<QerkoTable>, never, EvoluDep> => async (run) => {
    const flows = await run.ok(loadQerkoPaymentFlows())
    return flows.table ? await run(listQerkoTables()) : ok([])
  }

/**
 * `getTableContents(code)`: the table's open bills, none while the table
 * flow is off.
 */
export const answerQerkoGetTableContents =
  (code: string): Task<ReadonlyArray<QerkoBill>, never, EvoluDep & DateDep> =>
  async (run) => {
    const flows = await run.ok(loadQerkoPaymentFlows())
    return flows.table ? await run(listQerkoTableBills(code)) : ok([])
  }

/**
 * `paymentStart(payment)`: starts it on the bill it names, a payment's or a
 * table's, while that flow is on. A start already recorded is accepted again
 * whatever the switches say since: Qerko repeats a call it got no answer to.
 */
export const answerQerkoPaymentStart =
  ({
    wire,
    deviceId,
  }: {
    readonly wire: QerkoWirePayment
    readonly deviceId: DeviceId | null
  }): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const [existing] = await run.deps.evolu.loadQuery(
      qerkoPaymentAttemptByIdQuery(createQerkoPaymentAttemptId(wire.id))
    )
    if (existing !== undefined) return ok()

    const flows = await run.ok(loadQerkoPaymentFlows())
    if (flows.direct) {
      const started = await run(startQerkoPayment(wire))
      if (started.ok || started.error.type !== "QerkoBillNotFound") {
        return started
      }
    }
    if (flows.table) {
      return await run(startQerkoTablePayment({ wire, deviceId }))
    }
    return err(createQerkoBillNotFoundError({ idBill: wire.idBill }))
  }
