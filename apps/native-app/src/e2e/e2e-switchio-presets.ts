import { format } from "date-fns"
import { nativeEnv } from "../core/native-env.ts"
import { queryClient } from "../core/query-client.ts"
import type { PaykySwitchioNativeModule } from "../platform/switchio.ts"

/**
 * A fake SwitchioPay for e2e builds and the screenshots: it stands in for the
 * native `PaykySwitchio` module (`modules/payky-switchio`) where there is none
 * (the web export) or where SwitchioPay is not installed (an emulator), so
 * every card screen can be driven. It answers with the module's *raw*
 * results (`{ resultCode, transactionResult: "<ECR v8 JSON>", transactionId }`)
 * and keeps its stored results as `MainActivity` does, so the whole of
 * `platform/switchio.ts`, core's `interpret*` and the domain Tasks run
 * unchanged on top of it.
 *
 * The terminal it plays keeps a little state: the transactions it approved
 * (so `get_transaction`, a reversal and a referral refund find them, and
 * `isReversed` is told), the open batch (a closure reports what was charged
 * and refunded since the last one), and a running sequence number. Every
 * value but the clock is fixed or counted, so screenshots stay the same.
 *
 * Chosen per scenario, each named after what the next launches do:
 *
 * - `approved`: every launch is approved;
 * - `declined`: a payment is declined by the card;
 * - `unknown`: a payment answers success with no data, and nothing was
 *   charged;
 * - `unknown-then-approved`: a payment answers no data, but the card was
 *   charged: `get_transaction` finds it approved;
 * - `unknown-then-not-found`: a payment answers no data and nothing was
 *   charged: `get_transaction` answers "Transaction not found";
 * - `cancelled`: a payment comes back cancelled (result code 0) with no data,
 *   what SwitchioPay is believed to answer when the customer cancels;
 * - `busy`: every launch finds the terminal busy (result code 2);
 * - `launch-refused`: every launch is refused before SwitchioPay opens
 *   (`SWITCHIO_LAUNCH_REFUSED`);
 * - `reversal-declined`: a reversal is declined, so `get_transaction` reads
 *   the payment as not reversed (a closure SwitchioPay made by itself);
 * - `refund-unknown`: a referral refund answers no data, though the money
 *   went back: `get_transaction` finds the refund approved;
 * - `closure-unknown`: a closure comes back cancelled with no data, and the
 *   batch stays open;
 * - `restored-approved`: a payment is approved, but its promise is lost as if
 *   Android had killed the app: the result waits in the store for the
 *   restore path (the next card tap settles it first, as does the app
 *   coming back to the foreground);
 * - `not-installed`: SwitchioPay is missing (`isInstalled` false, every
 *   launch rejected with `SWITCHIO_NOT_INSTALLED`).
 *
 * Inert unless `EXPO_PUBLIC_PAYKY_E2E`: the `fake` bridge action
 * (`switchio=<scenario>`, `off` to drop it) or, on web, Playwright's
 * `window.__e2eSwitchio.setScenario(...)` and an init script's
 * `window.__e2eSwitchioScenario` (`e2e-setup.web.ts`) switch it on. It lives
 * in memory until the app restarts (a web link reloads the page), as the
 * other e2e fakes do.
 */
export const e2eSwitchioScenarios = [
  "approved",
  "declined",
  "unknown",
  "unknown-then-approved",
  "unknown-then-not-found",
  "cancelled",
  "busy",
  "launch-refused",
  "reversal-declined",
  "refund-unknown",
  "closure-unknown",
  "restored-approved",
  "not-installed",
] as const

export type E2eSwitchioScenario = (typeof e2eSwitchioScenarios)[number]

/** The module's own rejection codes, matched by `platform/switchio.ts`. */
const rejectionCodes = {
  notInstalled: "SWITCHIO_NOT_INSTALLED",
  launchRefused: "SWITCHIO_LAUNCH_REFUSED",
  noOriginal: "SWITCHIO_NO_ORIGINAL",
  /** Not the module's: a promise lost with the process, which no code names. */
  lost: "E2E_SWITCHIO_PROMISE_LOST",
} as const

/** A rejection as an Expo `CodedException` reaches JS: an `Error` with a `code`. */
const rejection = (code: string, message: string): Error =>
  Object.assign(new Error(message), { code })

/** The activity result codes SwitchioPay answers with (ECR 3.3). */
const resultCodes = { success: -1, failure: 0, terminalBusy: 2 } as const

/** What SwitchioPay hands back to the module for one launch. */
interface ActivityResult {
  readonly resultCode: number
  readonly transactionResult: string | null
}

const busyResult: ActivityResult = {
  resultCode: resultCodes.terminalBusy,
  transactionResult: JSON.stringify({
    responseCode: "UNDEFINED",
    responseMessage: "Terminal busy",
  }),
}

/** The terminal and card every approval names, fixed for stable screenshots. */
export const e2eSwitchioTerminal = {
  terminalId: "N92-0001",
  maskedPan: "**** **** **** 4242",
  brand: "VISA",
} as const

/**
 * One of `MainActivity`'s result stores (`SwitchioResultStore` and its
 * closure and refund twins): an attempt is begun before the terminal opens,
 * its result saved before the promise answers, and only JS clears it.
 */
const createResultStore = () => {
  let attempt: { readonly id: string; readonly accountId: string } | null = null
  let result: ActivityResult | null = null
  return {
    begin: (id: string, accountId: string) => {
      attempt = { id, accountId }
      result = null
    },
    save: (answer: ActivityResult) => {
      result = answer
    },
    peek: () => ({ attempt, result }),
    /** Clears the result if it belongs to `id` (`null` for any). */
    acknowledge: (id: string | null) => {
      if (result === null) return
      if (id !== null && attempt?.id !== id) return
      attempt = null
      result = null
    },
  }
}

interface FakeTransaction {
  readonly kind: "payment" | "referralRefund"
  readonly batchNumber: number
  /** Charged (a payment, tip included) or credited (a refund). */
  readonly total: number
  readonly refundId: string | null
  /** The ECR result as `get_transaction` repeats it, but `isReversed`. */
  readonly result: Readonly<Record<string, unknown>>
}

/** What `pay` hands SwitchioPay. */
interface PayRequest {
  readonly transactionId: string
  readonly amount: number
  readonly tipAmount: number
  readonly currencyCode: number
  readonly invoiceNumber: string | null
}

/**
 * The fake module itself, over its own terminal state. `scenario` is read on
 * every launch, so a flow can change it between steps.
 */
export const createE2eSwitchioModule = ({
  scenario,
  now = () => new Date(),
}: {
  readonly scenario: () => E2eSwitchioScenario
  readonly now?: () => Date
}): PaykySwitchioNativeModule => {
  const payments = createResultStore()
  const closures = createResultStore()
  const refunds = createResultStore()

  const transactions = new Map<string, FakeTransaction>()
  const reversed = new Set<string>()
  /** What was refunded to the card per payment, by the payment's id. */
  const refunded = new Map<string, number>()
  let sequence = 1000
  let batchNumber = 1
  let batch = {
    debitsCount: 0,
    debitsAmount: 0,
    creditsCount: 0,
    creditsAmount: 0,
  }

  const approval = () => {
    sequence += 1
    return {
      responseCode: "OK",
      responseMessage: "Approved",
      authCode: String(114_000 + sequence),
      sequenceNumber: String(sequence).padStart(9, "0"),
      pan: e2eSwitchioTerminal.maskedPan,
      appLabel: e2eSwitchioTerminal.brand,
      brand: e2eSwitchioTerminal.brand,
      terminalIdAcquirer: e2eSwitchioTerminal.terminalId,
      // The ECR's own rendering, a fixed format rather than the device's.
      dateTimeTerminal: format(now(), "MMM d, yyyy HH:mm:ss"),
    }
  }

  const declined = (
    transactionId: string,
    responseMessage: string,
    resultCode: number = resultCodes.success
  ): ActivityResult => ({
    resultCode,
    transactionResult: JSON.stringify({
      transactionId,
      responseCode: "DECLINED",
      responseMessage,
      terminalIdAcquirer: e2eSwitchioTerminal.terminalId,
    }),
  })

  /** Charges the card, kept for `get_transaction` and the batch. */
  const charge = (request: PayRequest): string => {
    const approved = approval()
    // 18 digits, as the ECR names a payment for a referral refund.
    const refundId = `424242${approved.sequenceNumber.padStart(12, "0")}`
    const result = {
      transactionId: request.transactionId,
      amount: request.amount,
      tipAmount: request.tipAmount,
      currencyCode: request.currencyCode,
      ...(request.invoiceNumber === null
        ? {}
        : { invoiceNumber: request.invoiceNumber }),
      ...approved,
      // A string: the terminal's number is past what JSON.parse holds exactly.
      refundId,
    }
    const total = request.amount + request.tipAmount
    transactions.set(request.transactionId, {
      kind: "payment",
      batchNumber,
      total,
      refundId,
      result,
    })
    batch = {
      ...batch,
      debitsCount: batch.debitsCount + 1,
      debitsAmount: batch.debitsAmount + total,
    }
    return JSON.stringify(result)
  }

  const payAnswer = (request: PayRequest): ActivityResult => {
    const noData = { resultCode: resultCodes.success, transactionResult: null }
    switch (scenario()) {
      case "declined":
        return declined(
          request.transactionId,
          "Declined by the card issuer",
          resultCodes.failure
        )
      case "unknown":
      case "unknown-then-not-found":
        return noData
      case "unknown-then-approved":
        charge(request)
        return noData
      case "cancelled":
        return { resultCode: resultCodes.failure, transactionResult: null }
      default:
        return {
          resultCode: resultCodes.success,
          transactionResult: charge(request),
        }
    }
  }

  /**
   * What every launch goes through first: a missing SwitchioPay and a
   * refused launch reject before anything is stored, and a busy terminal
   * answers before it does anything.
   */
  const launch = async <T>(answer: () => T, onBusy: () => T): Promise<T> => {
    const current = scenario()
    if (current === "not-installed") {
      throw rejection(
        rejectionCodes.notInstalled,
        "SwitchioPay is not installed"
      )
    }
    if (current === "launch-refused") {
      throw rejection(
        rejectionCodes.launchRefused,
        "Another SwitchioPay launch is under way"
      )
    }
    return current === "busy" ? onBusy() : answer()
  }

  /** Saves the answer in its store and resolves as the module does. */
  const answerRefund = (transactionId: string, answer: ActivityResult) => {
    refunds.save(answer)
    return { transactionId, ...answer }
  }

  const findPayment = (
    matches: (transaction: FakeTransaction) => boolean
  ): readonly [string, FakeTransaction] | undefined =>
    [...transactions].find(
      ([, transaction]) =>
        transaction.kind === "payment" && matches(transaction)
    )

  return {
    isInstalled: () => scenario() !== "not-installed",

    pay: (
      transactionId,
      amount,
      tipAmount,
      currencyCode,
      invoiceNumber,
      accountId
    ) =>
      launch(
        () => {
          payments.begin(transactionId, accountId)
          const answer = payAnswer({
            transactionId,
            amount,
            tipAmount,
            currencyCode,
            invoiceNumber,
          })
          payments.save(answer)
          if (scenario() === "restored-approved") {
            throw rejection(
              rejectionCodes.lost,
              "The launch's promise was lost with the process"
            )
          }
          return { transactionId, ...answer }
        },
        () => {
          payments.begin(transactionId, accountId)
          payments.save(busyResult)
          return { transactionId, ...busyResult }
        }
      ),

    peekStoredResult: () => {
      const { attempt, result } = payments.peek()
      return result === null
        ? null
        : {
            transactionId: attempt?.id ?? null,
            ...result,
            accountId: attempt?.accountId ?? null,
          }
    },

    acknowledgeResult: (transactionId) => payments.acknowledge(transactionId),

    close: (closureId, accountId) =>
      launch(
        () => {
          closures.begin(closureId, accountId)
          if (scenario() === "closure-unknown") {
            const unknown = {
              resultCode: resultCodes.failure,
              transactionResult: null,
            }
            closures.save(unknown)
            return unknown
          }
          const batchTotals = {
            shiftNumber: 1,
            batchNumber,
            ...batch,
            adjsCount: 0,
            adjsAmount: 0,
          }
          const answer = {
            resultCode: resultCodes.success,
            transactionResult: JSON.stringify({
              transactionType: "CLOSE_BATCH",
              responseCode: "OK",
              responseMessage: "Batch closed",
              terminalIdAcquirer: e2eSwitchioTerminal.terminalId,
              dateTimeTerminal: format(now(), "MMM d, yyyy HH:mm:ss"),
              batchTotals,
            }),
          }
          batchNumber += 1
          batch = {
            debitsCount: 0,
            debitsAmount: 0,
            creditsCount: 0,
            creditsAmount: 0,
          }
          closures.save(answer)
          return answer
        },
        () => {
          closures.begin(closureId, accountId)
          closures.save(busyResult)
          return busyResult
        }
      ),

    peekStoredClosureResult: () => {
      const { attempt, result } = closures.peek()
      if (attempt === null) return null
      return result === null
        ? {
            unanswered: true,
            closureId: attempt.id,
            accountId: attempt.accountId,
          }
        : { closureId: attempt.id, ...result, accountId: attempt.accountId }
    },

    acknowledgeClosureResult: () => closures.acknowledge(null),

    reversal: async (transactionId, originalTransactionId, accountId) => {
      if (originalTransactionId === "") {
        throw rejection(
          rejectionCodes.noOriginal,
          "A reversal needs the original transaction"
        )
      }
      return launch(
        () => {
          refunds.begin(transactionId, accountId)
          const original = transactions.get(originalTransactionId)
          // Only a payment of the open batch, never refunded or reversed.
          if (
            scenario() === "reversal-declined" ||
            original === undefined ||
            original.kind !== "payment" ||
            original.batchNumber !== batchNumber ||
            reversed.has(originalTransactionId) ||
            refunded.has(originalTransactionId)
          ) {
            return answerRefund(
              transactionId,
              declined(transactionId, "Reversal not possible")
            )
          }
          reversed.add(originalTransactionId)
          batch = {
            ...batch,
            debitsCount: batch.debitsCount - 1,
            debitsAmount: batch.debitsAmount - original.total,
          }
          // Not kept for `get_transaction`: the terminal does not find a
          // reversal by its own id (refund-switchio-actions.ts).
          return answerRefund(transactionId, {
            resultCode: resultCodes.success,
            transactionResult: JSON.stringify({
              transactionId,
              originalTransactionId,
              reversal: true,
              amount: original.total,
              currencyCode: original.result.currencyCode,
              ...approval(),
            }),
          })
        },
        () => {
          refunds.begin(transactionId, accountId)
          return answerRefund(transactionId, busyResult)
        }
      )
    },

    referralRefund: (
      transactionId,
      amount,
      currencyCode,
      refundId,
      accountId
    ) =>
      launch(
        () => {
          refunds.begin(transactionId, accountId)
          const original = findPayment(
            (transaction) => transaction.refundId === refundId
          )
          const left =
            original === undefined || reversed.has(original[0])
              ? 0
              : original[1].total - (refunded.get(original[0]) ?? 0)
          if (original === undefined || amount <= 0 || amount > left) {
            return answerRefund(
              transactionId,
              declined(transactionId, "Original transaction not found")
            )
          }
          const result = {
            transactionId,
            amount,
            currencyCode,
            ...approval(),
          }
          transactions.set(transactionId, {
            kind: "referralRefund",
            batchNumber,
            total: amount,
            refundId: null,
            result,
          })
          refunded.set(original[0], (refunded.get(original[0]) ?? 0) + amount)
          batch = {
            ...batch,
            creditsCount: batch.creditsCount + 1,
            creditsAmount: batch.creditsAmount + amount,
          }
          return answerRefund(
            transactionId,
            scenario() === "refund-unknown"
              ? { resultCode: resultCodes.success, transactionResult: null }
              : {
                  resultCode: resultCodes.success,
                  transactionResult: JSON.stringify(result),
                }
          )
        },
        () => {
          refunds.begin(transactionId, accountId)
          return answerRefund(transactionId, busyResult)
        }
      ),

    lookupTransaction: (transactionId) =>
      launch(
        () => {
          const transaction = transactions.get(transactionId)
          return {
            resultCode: resultCodes.success,
            transactionResult: JSON.stringify(
              transaction === undefined
                ? {
                    transactionId,
                    responseCode: "FAILED",
                    responseMessage: "Transaction not found",
                  }
                : {
                    ...transaction.result,
                    isReversed: reversed.has(transactionId),
                  }
            ),
          }
        },
        () => busyResult
      ),

    peekStoredRefundResult: () => {
      const { attempt, result } = refunds.peek()
      return result === null
        ? null
        : {
            transactionId: attempt?.id ?? null,
            ...result,
            accountId: attempt?.accountId ?? null,
          }
    },

    acknowledgeRefundResult: (transactionId) =>
      refunds.acknowledge(transactionId),
  }
}

// Module state: one fake terminal, until the app restarts or `off`.
let activeScenario: E2eSwitchioScenario = "approved"
let activeModule: PaykySwitchioNativeModule | null = null
const listeners = new Set<(module: PaykySwitchioNativeModule | null) => void>()

/**
 * Switches the fake on with `scenario`, or off with `null` (forgetting its
 * transactions). A changed scenario keeps the terminal's state, so a flow can
 * pay with one and refund with another.
 */
export const setE2eSwitchioScenario = (
  scenario: E2eSwitchioScenario | null
): void => {
  if (!nativeEnv.EXPO_PUBLIC_PAYKY_E2E) return
  if (scenario === null) {
    activeModule = null
  } else {
    activeScenario = scenario
    activeModule ??= createE2eSwitchioModule({
      scenario: () => activeScenario,
    })
  }
  for (const listener of listeners) listener(activeModule)
  // `useIsSwitchioInstalled` keeps its answer until the app comes back to
  // the foreground; the fake changes it without that.
  void queryClient.invalidateQueries({ queryKey: ["switchioInstalled"] })
}

/**
 * How `platform/switchio.ts` swaps the fake in: `listener` hears the fake
 * module at once and on every change, `null` while it is off.
 */
export const onE2eSwitchioChange = (
  listener: (module: PaykySwitchioNativeModule | null) => void
): void => {
  listeners.add(listener)
  listener(activeModule)
}
