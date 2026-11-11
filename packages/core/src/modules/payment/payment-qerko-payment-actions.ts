import { err, ok, type Task } from "@evolu/common"
import { z } from "zod"

import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import {
  getQerkoPayment,
  type QerkoApiDep,
  type QerkoClientError,
} from "../../integrations/qerko/qerko-client.ts"
import type {
  QerkoBill,
  QerkoReceipt,
  QerkoWirePayment,
} from "../../integrations/qerko/qerko-rpc.ts"
import { qerkoPaymentAccountByIdQuery } from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import { settingsQuery } from "../app-settings/app-settings-queries.ts"
import { billLinesByBillIdQuery } from "../bill-line/bill-line-queries.ts"
import {
  calculateTaxRecap,
  type TaxRecapRow,
} from "../bill-line/bill-line-tax-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import { itemsByPaymentIdQuery } from "../item/item-queries.ts"
import { legalEntityQuery } from "../legal-entity/legal-entity-queries.ts"
import { isVatPayer } from "../legal-entity/legal-entity-utils.ts"
import { paymentLinesByPaymentIdQuery } from "../payment-line/payment-line-queries.ts"
import { paymentLinesToBillLineSummaries } from "../payment-line/payment-line-utils.ts"
import { paymentNumberByPaymentIdQuery } from "../payment-number/payment-number-queries.ts"
import {
  loadQerkoCredentials,
  type QerkoPluginNotPairedError,
} from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { taxRatesQuery } from "../tax-rate/tax-rate-queries.ts"
import type { PaymentRow, QerkoPaymentAttemptRow } from "./payment.ts"
import { markPaymentPaid } from "./payment-actions.ts"
import {
  createQerkoBillClosedError,
  createQerkoBillLockedError,
  createQerkoBillNotFoundError,
  createQerkoInvalidDataError,
  createQerkoPaymentAccountNotFoundError,
  createQerkoPaymentAttemptNotFoundError,
  type QerkoPaymentAttemptNotFoundError,
  type ResolveQerkoBillError,
  type SettleQerkoPaymentError,
  type StartQerkoPaymentError,
} from "./payment-errors.ts"
import { loadPaymentStatus } from "./payment-guards.ts"
import {
  calculateQerkoKeypadTaxRecap,
  checkQerkoPaymentStart,
  classifyQerkoPaymentState,
  createQerkoBill,
  createQerkoPaymentAttemptId,
  createQerkoReceipt,
  deriveQerkoChargedTip,
  deriveQerkoPaymentAttemptState,
  deriveQerkoPaymentContent,
  orderQerkoLines,
  type QerkoPaymentAttemptState,
  type QerkoPaymentContent,
  QerkoProvidersJson,
  readQerkoTip,
  summarizeQerkoPaymentParts,
} from "./payment-qerko-payment-utils.ts"
import {
  paymentByIdQuery,
  paymentQerkoPaymentByIdQuery,
  qerkoPaymentAttemptByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "./payment-queries.ts"
import { PaymentId } from "./payment-types.ts"

/**
 * The domain half of Qerko payments (qerko/0007, qerko/0013, qerko/0014,
 * qerko/0015): what Payky answers Qerko's calls with, and how a Qerko
 * payment's outcome is recorded. The websocket session (`qerko-rpc.ts`) calls
 * these through the connection job; `settleQerkoPayment` is also what
 * `get-payment` results go through.
 */

interface QerkoPayable {
  readonly payment: PaymentRow
  readonly accountId: AccountId
  readonly serialNumber: number | null
}

/**
 * The payment a Qerko bill id names — Payky's bills in Qerko are its payments
 * — when it was offered through Qerko and still waits for money.
 */
const loadQerkoPayable =
  (
    idBill: string
  ): Task<QerkoPayable, ResolveQerkoBillError, EvoluDep & DateDep> =>
  async (run) => {
    const notFound = err(createQerkoBillNotFoundError({ idBill }))
    const paymentId = PaymentId.safeParse(idBill)
    if (!paymentId.success) return notFound

    const [[payment], [method], [paymentNumber]] = await Promise.all([
      run.deps.evolu.loadQuery(paymentByIdQuery(paymentId.data)),
      run.deps.evolu.loadQuery(paymentQerkoPaymentByIdQuery(paymentId.data)),
      run.deps.evolu.loadQuery(paymentNumberByPaymentIdQuery(paymentId.data)),
    ])
    if (payment === undefined || method === undefined) return notFound

    const status = await run.ok(loadPaymentStatus(payment))
    if (status !== "pending") {
      return err(createQerkoBillClosedError({ id: payment.id }))
    }

    return ok({
      payment,
      accountId: method.accountId,
      serialNumber: paymentNumber?.serialNumber ?? null,
    })
  }

interface QerkoPaymentBasis {
  readonly content: QerkoPaymentContent
  /** The goods' VAT recap; `null` when the business pays no VAT. */
  readonly taxRecap: ReadonlyArray<TaxRecapRow> | null
}

/**
 * What a payment's Qerko bill and receipt are made of (qerko/0014): the lines
 * it froze from its bill, in the order the bill's ledger first had them, and
 * their VAT recap when the business pays VAT. Both read only what the
 * payment froze, so `searchBills`, `getBill` and `paymentProcessed` agree
 * however the bill changes after. A keypad payment's goods are taxed at the
 * rate set for keypad amounts, read when the receipt is made: Qerko asks for
 * it once and keeps it.
 */
const loadQerkoPaymentContent =
  (
    payment: Pick<PaymentRow, "id" | "billId" | "amount" | "tipAmount">
  ): Task<QerkoPaymentBasis, never, EvoluDep> =>
  async (run) => {
    const { evolu } = run.deps
    if (payment.billId === null) {
      const [[legalEntity], [settings], taxRates] = await Promise.all([
        evolu.loadQuery(legalEntityQuery),
        evolu.loadQuery(settingsQuery),
        evolu.loadQuery(taxRatesQuery),
      ])
      const content = deriveQerkoPaymentContent({
        amount: payment.amount,
        tipAmount: payment.tipAmount,
        lines: [],
      })
      return ok({
        content,
        taxRecap: isVatPayer(legalEntity)
          ? calculateQerkoKeypadTaxRecap({
              goodsAmount: content.goodsAmount,
              taxRateId: settings?.keypadTaxRateId ?? null,
              taxRates,
            })
          : null,
      })
    }

    const [paymentLines, items, ledger, [legalEntity], taxRates] =
      await Promise.all([
        evolu.loadQuery(paymentLinesByPaymentIdQuery(payment.id)),
        evolu.loadQuery(itemsByPaymentIdQuery(payment.id)),
        evolu.loadQuery(billLinesByBillIdQuery(payment.billId)),
        evolu.loadQuery(legalEntityQuery),
        evolu.loadQuery(taxRatesQuery),
      ])
    const lines = orderQerkoLines(
      paymentLinesToBillLineSummaries(paymentLines, items),
      ledger
    )
    return ok({
      content: deriveQerkoPaymentContent({
        amount: payment.amount,
        tipAmount: payment.tipAmount,
        lines,
      }),
      taxRecap: isVatPayer(legalEntity)
        ? calculateTaxRecap(lines, taxRates)
        : null,
    })
  }

/**
 * `searchBills` (the QR code's identifier) and `getBill` (Qerko's bill id):
 * both are a payment's id, answered with its bill (qerko/0014).
 */
export const resolveQerkoBill =
  (
    idBill: string
  ): Task<QerkoBill, ResolveQerkoBillError, EvoluDep & DateDep> =>
  async (run) => {
    const payable = await run(loadQerkoPayable(idBill))
    if (!payable.ok) return payable
    const { payment, serialNumber } = payable.value
    const { content } = await run.ok(loadQerkoPaymentContent(payment))
    return ok(
      createQerkoBill({
        paymentId: payment.id,
        serialNumber,
        currency: payment.currency,
        content,
      })
    )
  }

/** The columns that only ever go from null to a value (qerko/0013). */
type QerkoAttemptFill = Partial<
  Pick<
    QerkoPaymentAttemptRow,
    | "processingAt"
    | "closedAt"
    | "outcome"
    | "failureReason"
    | "chargedAmount"
    | "providers"
  >
>

/**
 * Writes what an attempt does not know yet and nothing else: a column that
 * holds a value keeps it, and the closing columns are written together, only
 * while the attempt is still open. So an answer that arrives late, or twice,
 * from the websocket or from `get-payment`, cannot move an attempt back or
 * give it a second outcome.
 */
const fillQerkoPaymentAttempt =
  ({
    attempt,
    values,
  }: {
    readonly attempt: QerkoPaymentAttemptRow
    readonly values: QerkoAttemptFill
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const open = attempt.closedAt === null
    const missing = removeUndefinedValues({
      processingAt:
        attempt.processingAt === null ? values.processingAt : undefined,
      closedAt: open ? values.closedAt : undefined,
      outcome: open ? values.outcome : undefined,
      failureReason: open ? values.failureReason : undefined,
      chargedAmount: open ? values.chargedAmount : undefined,
      providers: open ? values.providers : undefined,
    })
    if (Object.keys(missing).length === 0) return ok()

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "qerkoPaymentAttempt",
        { id: attempt.id, ...missing },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

/**
 * `paymentStart`: Qerko is about to take the money. Refuses a payment that no
 * longer matches the bill or no longer waits, and one with another Qerko
 * payment still in progress — only the device holding the connection starts
 * attempts, so that check reads what it alone writes. Records the attempt;
 * the same `paymentStart` again changes nothing.
 */
export const startQerkoPayment =
  (
    wire: QerkoWirePayment
  ): Task<void, StartQerkoPaymentError, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const attemptId = createQerkoPaymentAttemptId(wire.id)
    const [existing] = await run.deps.evolu.loadQuery(
      qerkoPaymentAttemptByIdQuery(attemptId)
    )
    if (existing !== undefined) return ok()

    const payable = await run(loadQerkoPayable(wire.idBill))
    if (!payable.ok) return payable
    const { payment } = payable.value

    const mismatch = checkQerkoPaymentStart({
      wire,
      goodsAmount: NonNegativeInteger(
        Math.max(0, payment.amount - payment.tipAmount)
      ),
      currency: payment.currency,
    })
    if (mismatch !== null) {
      return err(
        createQerkoInvalidDataError({ id: payment.id, reason: mismatch })
      )
    }

    const attempts = await run.deps.evolu.loadQuery(
      qerkoPaymentAttemptsByPaymentIdQuery(payment.id)
    )
    const running = attempts.find((attempt) => attempt.closedAt === null)
    if (running !== undefined) {
      return err(
        createQerkoBillLockedError({
          id: payment.id,
          qerkoPaymentId: running.qerkoPaymentId,
        })
      )
    }

    // Qerko's tip is fixed once its payment exists, so it is written with the
    // start, once (qerko/0013, qerko/0015).
    const tip = readQerkoTip(wire, payment.currency)
    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "qerkoPaymentAttempt",
        {
          id: attemptId,
          paymentId: payment.id,
          qerkoPaymentId: NonEmptyString255(wire.id),
          startedAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
          tipAmount: tip.tipAmount,
          tipNetAmount: tip.tipNetAmount,
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

const loadAttempt =
  (
    qerkoPaymentId: string
  ): Task<QerkoPaymentAttemptRow, QerkoPaymentAttemptNotFoundError, EvoluDep> =>
  async (run) => {
    const [attempt] = await run.deps.evolu.loadQuery(
      qerkoPaymentAttemptByIdQuery(createQerkoPaymentAttemptId(qerkoPaymentId))
    )
    return attempt === undefined
      ? err(createQerkoPaymentAttemptNotFoundError({ qerkoPaymentId }))
      : ok(attempt)
  }

/**
 * `paymentProcessed`: Qerko has the money's authorization and wants the
 * receipt, without which it cancels the payment. It lists the tip the
 * customer chose in Qerko, which `paymentStart` recorded on the attempt. No
 * money is recorded yet: that waits for `PAID` (qerko/0015).
 */
export const processQerkoPayment =
  (
    qerkoPaymentId: string
  ): Task<
    QerkoReceipt,
    QerkoPaymentAttemptNotFoundError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const attempt = await run(loadAttempt(qerkoPaymentId))
    if (!attempt.ok) return attempt

    await run.ok(
      fillQerkoPaymentAttempt({
        attempt: attempt.value,
        values: {
          processingAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        },
      })
    )

    const [[payment], [paymentNumber]] = await Promise.all([
      run.deps.evolu.loadQuery(paymentByIdQuery(attempt.value.paymentId)),
      run.deps.evolu.loadQuery(
        paymentNumberByPaymentIdQuery(attempt.value.paymentId)
      ),
    ])
    if (payment === undefined) {
      return err(createQerkoPaymentAttemptNotFoundError({ qerkoPaymentId }))
    }

    const { content, taxRecap } = await run.ok(loadQerkoPaymentContent(payment))
    return ok(
      createQerkoReceipt({
        serialNumber: paymentNumber?.serialNumber ?? null,
        currency: payment.currency,
        content,
        taxRecap,
      })
    )
  }

/**
 * Records what Qerko says a Qerko payment ended as — from `paymentClosed` on
 * the websocket or from `get-payment` — and is the one place either does
 * (qerko/0013, qerko/0015). Only `PAID` is money; any other final state is a
 * failed payment; a state still in progress fills at most `processingAt`.
 * It touches only the attempt `qerkoPaymentId` names, and running it again,
 * from any device, writes nothing new.
 *
 * `payment` is Qerko's `Payment` when the caller has it; `paymentClosed`
 * carries only the state, so a `PAID` without it is read with `get-payment`
 * for what was charged and by whom.
 */
export const settleQerkoPayment =
  ({
    qerkoPaymentId,
    state,
    payment,
    deviceId,
  }: {
    readonly qerkoPaymentId: string
    readonly state: string
    readonly payment?: QerkoWirePayment
    readonly deviceId?: DeviceId | null
  }): Task<
    QerkoPaymentAttemptState,
    SettleQerkoPaymentError | QerkoPluginNotPairedError | QerkoClientError,
    EvoluDep & EvoluOwnerDep & DateDep & QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const attemptResult = await run(loadAttempt(qerkoPaymentId))
    if (!attemptResult.ok) return attemptResult
    const attempt = attemptResult.value
    const now = TimestampMsSchema.decode(run.deps.date.now().getTime())
    const outcome = classifyQerkoPaymentState(state)

    if (outcome === "ongoing") {
      if (state !== "STARTED") {
        await run.ok(
          fillQerkoPaymentAttempt({ attempt, values: { processingAt: now } })
        )
      }
      return ok(
        deriveQerkoPaymentAttemptState({
          processingAt:
            attempt.processingAt ?? (state === "STARTED" ? null : now),
          outcome: attempt.outcome,
        })
      )
    }

    if (outcome === "failed") {
      await run.ok(
        fillQerkoPaymentAttempt({
          attempt,
          values: {
            closedAt: now,
            outcome: "failed",
            failureReason: NonEmptyString255(state.slice(0, 255) || "UNKNOWN"),
          },
        })
      )
      return ok(attempt.outcome ?? "failed")
    }

    if (attempt.outcome === "paid") return ok("paid")

    const [method] = await run.deps.evolu.loadQuery(
      paymentQerkoPaymentByIdQuery(attempt.paymentId)
    )
    if (method === undefined) {
      return err(createQerkoPaymentAttemptNotFoundError({ qerkoPaymentId }))
    }

    let wire = payment
    if (wire === undefined) {
      const credentials = await run(loadQerkoCredentials("standard"))
      if (!credentials.ok) return credentials
      const fetched = await run(
        getQerkoPayment({
          credentials: credentials.value,
          paymentId: qerkoPaymentId,
        })
      )
      if (!fetched.ok) return fetched
      wire = fetched.value
    }

    const [paymentRow] = await run.deps.evolu.loadQuery(
      paymentByIdQuery(attempt.paymentId)
    )
    const currency = paymentRow?.currency
    const parts =
      currency === undefined
        ? null
        : summarizeQerkoPaymentParts(wire.parts, currency)

    // The money lands before the attempt is closed, as on the terminal: a
    // crash in between leaves a paid payment with a thinner trail, not money
    // taken that still reads as unpaid. The bill allows no part payment, so a
    // `Payment` whose parts do not say otherwise charged the payment's own
    // amount. Qerko offered only the goods and the customer tipped there
    // (qerko/0015): when the parts are exactly the goods and that tip, the
    // tip replaces the payment's own, zero included, so the payment is
    // neither over- nor underpaid; otherwise the money is recorded as charged
    // and the difference shows. `tipBrutto` comes from the `Payment`, or from
    // the attempt when the `Payment` lacks it. Qerko's commission on the tip,
    // like its other fees, is not recorded (qerko/0015).
    const chargedAmount =
      parts === null || parts.chargedAmount === 0
        ? undefined
        : NonNegativeInteger(parts.chargedAmount)
    const chargedTipAmount =
      chargedAmount === undefined || paymentRow === undefined
        ? undefined
        : deriveQerkoChargedTip({
            chargedAmount,
            tipAmount:
              wire.tipBrutto === undefined
                ? attempt.tipAmount
                : readQerkoTip(wire, paymentRow.currency).tipAmount,
            goodsAmount: paymentRow.amount - paymentRow.tipAmount,
          })
    const settled = await run(
      markPaymentPaid({
        paymentId: attempt.paymentId,
        accountId: method.accountId,
        deviceId,
        ...(chargedAmount === undefined ? {} : { chargedAmount }),
        ...(chargedTipAmount === undefined ? {} : { chargedTipAmount }),
        accountKind: "qerkoPayment",
        // Qerko said paid, not staff (payment/0010).
        source: "auto",
        accountQuery: qerkoPaymentAccountByIdQuery,
        notFoundError: createQerkoPaymentAccountNotFoundError({
          id: method.accountId,
        }),
      })
    )
    if (!settled.ok) return settled

    await run.ok(
      fillQerkoPaymentAttempt({
        attempt,
        values: {
          closedAt: now,
          outcome: "paid",
          chargedAmount,
          providers:
            parts === null || parts.providers.length === 0
              ? undefined
              : NonEmptyStringSchema.decode(
                  z.encode(QerkoProvidersJson, [...parts.providers])
                ),
        },
      })
    )
    return ok("paid")
  }

/**
 * Asks Qerko where a Qerko payment stands (`get-payment`) and records it: how
 * an attempt is settled when `paymentClosed` never arrived — the connection
 * dropped, or the device holding it went away mid-payment (qerko/0012). It
 * needs only REST, so any device of the account can run it.
 */
export const syncQerkoPaymentAttempt =
  ({
    qerkoPaymentId,
    deviceId,
  }: {
    readonly qerkoPaymentId: string
    readonly deviceId?: DeviceId | null
  }): Task<
    QerkoPaymentAttemptState,
    SettleQerkoPaymentError | QerkoPluginNotPairedError | QerkoClientError,
    EvoluDep & EvoluOwnerDep & DateDep & QerkoApiDep & FetchDep
  > =>
  async (run) => {
    const credentials = await run(loadQerkoCredentials("standard"))
    if (!credentials.ok) return credentials
    const payment = await run(
      getQerkoPayment({
        credentials: credentials.value,
        paymentId: qerkoPaymentId,
      })
    )
    if (!payment.ok) return payment
    return await run(
      settleQerkoPayment({
        qerkoPaymentId,
        state: payment.value.state,
        payment: payment.value,
        deviceId,
      })
    )
  }
