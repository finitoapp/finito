import { err, type Result } from "@evolu/common"
import {
  createSwitchioResultUnreadableError,
  createSwitchioUnavailableError,
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentResult,
  interpretSwitchioRefundResult,
  interpretSwitchioReversalResult,
  interpretSwitchioTransactionLookup,
  type SwitchioCardRefundResult,
  type SwitchioClosureDep,
  type SwitchioNativeClosureResult,
  SwitchioNativeClosureResultSchema,
  type SwitchioNativePayResult,
  SwitchioNativePayResultSchema,
  type SwitchioRefundDep,
  type SwitchioRefundError,
  type SwitchioTerminalDep,
} from "@payky/core/switchio"
import { NativeModule, requireOptionalNativeModule } from "expo"
import { z } from "zod"

/**
 * `modules/payky-switchio`: the SwitchioPay ECR API (v8) is driven entirely
 * through Android intents, so there is no iOS or web equivalent. The Android
 * half of web's `platform/switchio.ts`.
 */
declare class PaykySwitchioNativeModule extends NativeModule {
  isInstalled(): boolean
  pay(
    transactionId: string,
    amount: number,
    tipAmount: number,
    currencyCode: number,
    invoiceNumber: string | null,
    accountId: string
  ): Promise<unknown>
  peekStoredResult(): unknown
  acknowledgeResult(transactionId: string | null): void
  close(accountId: string): Promise<unknown>
  peekStoredClosureResult(): unknown
  acknowledgeClosureResult(): void
  reversal(
    transactionId: string,
    originalTransactionId: string,
    accountId: string
  ): Promise<unknown>
  referralRefund(
    transactionId: string,
    amount: number,
    currencyCode: number,
    refundId: string,
    accountId: string
  ): Promise<unknown>
  lookupTransaction(transactionId: string): Promise<unknown>
  peekStoredRefundResult(): unknown
  acknowledgeRefundResult(transactionId: string | null): void
}

/** Matched by the Kotlin module: the one rejection known to precede any charge. */
const SWITCHIO_NOT_INSTALLED_CODE = "SWITCHIO_NOT_INSTALLED"

// Absent in a binary built before the module existed.
const switchio =
  requireOptionalNativeModule<PaykySwitchioNativeModule>("PaykySwitchio")

/** Whether this build can talk to SwitchioPay at all (the module is linked). */
export const isSwitchioSupported = (): boolean => switchio !== null

/** Whether this device can launch SwitchioPay; `false` without the module. */
export const isSwitchioInstalled = (): boolean =>
  switchio?.isInstalled() === true

const isNotInstalledRejection = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === SWITCHIO_NOT_INSTALLED_CODE

/**
 * The device's accounts as the restore path sees them. Each launch stores the
 * account it was made in beside its result, because the result is
 * device-wide and outlives a switch of the active account.
 */
export interface SwitchioResultOwner {
  readonly activeAccountId: string
  readonly deviceAccountIds: ReadonlySet<string>
}

/** Null for a result stored by a build that did not keep the account. */
const StoredResultAccountSchema = z.object({
  accountId: z.string().nullable().default(null),
})

/**
 * What the restore path does with a stored result: take it in the active
 * account it was launched in, leave it for its own account to take once that
 * one is active again, or drop it when its account is gone from this device,
 * since there is nowhere to record it. A result with no account came from an
 * earlier build and is taken, as it was then.
 */
const claimStoredResult = (
  stored: unknown,
  owner: SwitchioResultOwner
): "take" | "wait" | "orphaned" => {
  const parsed = StoredResultAccountSchema.safeParse(stored)
  const accountId = parsed.success ? parsed.data.accountId : null
  if (accountId === null || accountId === owner.activeAccountId) return "take"
  return owner.deviceAccountIds.has(accountId) ? "wait" : "orphaned"
}

const unreadable = () =>
  err(
    createSwitchioResultUnreadableError({ resultCode: null, rawResult: null })
  )

/**
 * The SwitchioPay launches this JS runtime is awaiting. Native code stores a
 * result before it resolves the launch's promise, and the restore path
 * (`takeRestored*`) runs whenever the app comes back to the foreground, so
 * nothing orders the two: while a launch is in flight its result is its
 * promise's, and the restore path leaves the stored copy alone. Otherwise
 * both would record one result, twice over (payment/0008).
 *
 * A new process or a reloaded JS starts with nothing in flight, which is
 * right: the promise of the old one is gone, and the stored copy is the
 * restore path's to take.
 */
const inFlight = {
  payment: false,
  closure: false,
  refund: false,
  lookup: false,
}

const whileInFlight = async <T>(
  launch: keyof typeof inFlight,
  work: () => Promise<T>
): Promise<T> => {
  inFlight[launch] = true
  try {
    return await work()
  } finally {
    inFlight[launch] = false
  }
}

/**
 * Takes card payments through SwitchioPay. A demo account calls no outside
 * service (demo-data/0001), so it never reaches the terminal.
 */
export const createSwitchioTerminalDep = ({
  demo,
  accountId,
}: {
  readonly demo: boolean
  /** The account a launch is made in, kept with its stored result. */
  readonly accountId: string
}): SwitchioTerminalDep => ({
  switchioTerminal: {
    pay: async (request) => {
      if (demo) return err(createSwitchioUnavailableError({ reason: "demo" }))
      if (switchio === null) {
        return err(
          createSwitchioUnavailableError({ reason: "notNativeRuntime" })
        )
      }

      // A result no one has settled yet belongs to an earlier attempt and
      // would be overwritten by this one: wait until it has been settled
      // (`SwitchioRestoredResult` does that at start-up).
      if (switchio.peekStoredResult() !== null) return unreadable()

      const module = switchio
      return whileInFlight("payment", async () => {
        try {
          const raw = await module.pay(
            request.transactionId,
            request.amount,
            request.tipAmount,
            request.currencyCode,
            request.invoiceNumber ?? null,
            accountId
          )
          // The attempt's marker (`unresolvedTransactionId`) was stored before
          // the terminal was launched, so acknowledging here cannot lose
          // information: a crash before the outcome is recorded leaves the
          // attempt unresolved, never silently unpaid.
          module.acknowledgeResult(request.transactionId)
          const parsed = SwitchioNativePayResultSchema.safeParse(raw)
          return parsed.success
            ? interpretSwitchioPaymentResult(parsed.data)
            : unreadable()
        } catch (error) {
          // Only a missing SwitchioPay activity is known to fail before
          // anything was charged. Any other rejection (a dropped bridge call,
          // a recreated activity) may come after the terminal took the card,
          // so it is an unknown outcome, never "unavailable".
          if (isNotInstalledRejection(error)) {
            return err(
              createSwitchioUnavailableError({ reason: "notInstalled" })
            )
          }
          return unreadable()
        }
      })
    },
  },
})

/**
 * The result of an attempt whose promise was lost when Android killed the
 * app, if one is waiting. Clears it first, so a result is settled at most
 * once by this path, and leaves it to the promise of a payment still in
 * flight; `settleRestoredSwitchioCardPayment` is idempotent too.
 * Only the active account takes it (`claimStoredResult`): one launched in
 * another account of this device waits for that account, and one whose
 * account is gone is cleared as unusable.
 */
export const takeRestoredSwitchioResult = (
  owner: SwitchioResultOwner
): SwitchioNativePayResult | "unusable" | null => {
  if (switchio === null || inFlight.payment) return null
  const stored = switchio.peekStoredResult()
  if (stored === null || stored === undefined) return null
  const claim = claimStoredResult(stored, owner)
  if (claim === "wait") return null

  const parsed = SwitchioNativePayResultSchema.safeParse(stored)
  switchio.acknowledgeResult(parsed.success ? parsed.data.transactionId : null)
  return parsed.success && claim === "take" ? parsed.data : "unusable"
}

/**
 * Closes the batch of the SwitchioPay terminal on this phone. Has its own
 * request code and result store on the native side, so a closure is never
 * taken for a payment's result (payment/0008). A demo account calls no
 * outside service (demo-data/0001), so it never reaches the terminal.
 */
export const createSwitchioClosureDep = ({
  demo,
  accountId,
}: {
  readonly demo: boolean
  /** The account a launch is made in, kept with its stored result. */
  readonly accountId: string
}): SwitchioClosureDep => ({
  switchioClosure: {
    close: async () => {
      if (demo) return err(createSwitchioUnavailableError({ reason: "demo" }))
      if (switchio === null) {
        return err(
          createSwitchioUnavailableError({ reason: "notNativeRuntime" })
        )
      }

      // A closure already on SwitchioPay would lose its promise to this one
      // on the native side.
      if (inFlight.closure) return unreadable()

      // An earlier closure's result no one has recorded yet would be
      // overwritten by this one: let `SwitchioRestoredClosure` record it.
      if (switchio.peekStoredClosureResult() !== null) return unreadable()

      const module = switchio
      return whileInFlight("closure", async () => {
        try {
          const raw = await module.close(accountId)
          // Recorded by the caller from this promise; the stored copy is only
          // for a promise lost with the process.
          module.acknowledgeClosureResult()
          const parsed = SwitchioNativeClosureResultSchema.safeParse(raw)
          return parsed.success
            ? interpretSwitchioClosureResult(parsed.data)
            : unreadable()
        } catch (error) {
          // As with a payment, only a missing SwitchioPay is known to fail
          // before the batch could have been closed.
          if (isNotInstalledRejection(error)) {
            return err(
              createSwitchioUnavailableError({ reason: "notInstalled" })
            )
          }
          return unreadable()
        }
      })
    },
  },
})

/**
 * The result of a closure whose promise was lost when Android killed the
 * app, if one is waiting. Clears it as it is taken, and leaves it to the
 * promise of a closure still in flight, so one result is recorded once.
 * Only the active account takes it (`claimStoredResult`): one launched in
 * another account of this device waits for that account, and one whose
 * account is gone is cleared as unusable.
 */
export const takeRestoredSwitchioClosureResult = (
  owner: SwitchioResultOwner
): SwitchioNativeClosureResult | "unusable" | null => {
  if (switchio === null || inFlight.closure) return null
  const stored = switchio.peekStoredClosureResult()
  if (stored === null || stored === undefined) return null
  const claim = claimStoredResult(stored, owner)
  if (claim === "wait") return null

  switchio.acknowledgeClosureResult()
  const parsed = SwitchioNativeClosureResultSchema.safeParse(stored)
  return parsed.success && claim === "take" ? parsed.data : "unusable"
}

/**
 * Whether a refund or a lookup is waiting on SwitchioPay in this process.
 * Asking the terminal about a pending attempt makes sense only when nothing
 * is: `resolveCardSwitchioRefundAttempt` turns a pending attempt it cannot
 * account for into an unknown one.
 */
export const isSwitchioRefundInFlight = (): boolean =>
  inFlight.refund || inFlight.lookup

/**
 * Launches a reversal or a referral refund and reads its answer. Both share
 * the native refund store, so an earlier result no one has settled yet
 * blocks either.
 */
const launchRefund = async ({
  demo,
  transactionId,
  launch,
  interpret,
}: {
  readonly demo: boolean
  readonly transactionId: string
  readonly launch: (module: PaykySwitchioNativeModule) => Promise<unknown>
  readonly interpret: (answer: {
    readonly resultCode: number
    readonly transactionResult: string | null
  }) => Result<SwitchioCardRefundResult, SwitchioRefundError>
}): Promise<Result<SwitchioCardRefundResult, SwitchioRefundError>> => {
  if (demo) return err(createSwitchioUnavailableError({ reason: "demo" }))
  if (switchio === null) {
    return err(createSwitchioUnavailableError({ reason: "notNativeRuntime" }))
  }
  if (isSwitchioRefundInFlight()) return unreadable()

  // An earlier refund's result no one has settled yet would be overwritten
  // by this one: let `SwitchioRestoredRefund` settle it.
  if (switchio.peekStoredRefundResult() !== null) return unreadable()

  const module = switchio
  return whileInFlight("refund", async () => {
    try {
      const raw = await launch(module)
      // The attempt was written before SwitchioPay was launched, so a crash
      // before its outcome is applied leaves it pending, to be asked about,
      // never forgotten.
      module.acknowledgeRefundResult(transactionId)
      const parsed = SwitchioNativePayResultSchema.safeParse(raw)
      return parsed.success ? interpret(parsed.data) : unreadable()
    } catch (error) {
      // As with a payment, only a missing SwitchioPay is known to fail
      // before the card could have been refunded.
      if (isNotInstalledRejection(error)) {
        return err(createSwitchioUnavailableError({ reason: "notInstalled" }))
      }
      return unreadable()
    }
  })
}

/**
 * Takes payments back (reversal) and refunds them to the card through
 * SwitchioPay, and asks it about one whose result was lost (refund/0007,
 * refund/0008). Has its own request code and result store
 * on the native side, so a refund result is never taken for a payment's or a
 * closure's. A demo account calls no outside service (demo-data/0001), so it
 * never reaches the terminal.
 */
export const createSwitchioRefundDep = ({
  demo,
  accountId,
}: {
  readonly demo: boolean
  /** The account a launch is made in, kept with its stored result. */
  readonly accountId: string
}): SwitchioRefundDep => ({
  switchioRefund: {
    reverse: (request) =>
      launchRefund({
        demo,
        transactionId: request.transactionId,
        launch: (module) =>
          module.reversal(
            request.transactionId,
            request.originalTransactionId,
            accountId
          ),
        interpret: interpretSwitchioReversalResult,
      }),
    referralRefund: (request) =>
      launchRefund({
        demo,
        transactionId: request.transactionId,
        launch: (module) =>
          module.referralRefund(
            request.transactionId,
            request.amount,
            request.currencyCode,
            request.refundId,
            accountId
          ),
        interpret: interpretSwitchioRefundResult,
      }),
    lookup: async (transactionId) => {
      if (demo || switchio === null || isSwitchioRefundInFlight()) {
        return { type: "unknown" }
      }
      return whileInFlight("lookup", async () => {
        try {
          const raw = await switchio.lookupTransaction(transactionId)
          const parsed = SwitchioNativeClosureResultSchema.safeParse(raw)
          return parsed.success
            ? interpretSwitchioTransactionLookup({
                transactionId,
                ...parsed.data,
              })
            : { type: "unknown" }
        } catch {
          return { type: "unknown" }
        }
      })
    },
  },
})

/**
 * The result of a refund whose promise was lost when Android killed the
 * app, if one is waiting. Clears it as it is taken, and leaves it to the
 * promise of a refund still in flight; `settleRestoredCardSwitchioRefund` is
 * idempotent too.
 * Only the active account takes it (`claimStoredResult`): one launched in
 * another account of this device waits for that account, and one whose
 * account is gone is cleared as unusable.
 */
export const takeRestoredSwitchioRefundResult = (
  owner: SwitchioResultOwner
): SwitchioNativePayResult | "unusable" | null => {
  if (switchio === null || inFlight.refund) return null
  const stored = switchio.peekStoredRefundResult()
  if (stored === null || stored === undefined) return null
  const claim = claimStoredResult(stored, owner)
  if (claim === "wait") return null

  const parsed = SwitchioNativePayResultSchema.safeParse(stored)
  switchio.acknowledgeRefundResult(
    parsed.success ? parsed.data.transactionId : null
  )
  return parsed.success && claim === "take" ? parsed.data : "unusable"
}
