import { err, type Result } from "@evolu/common"
import {
  createSwitchioResultUnreadableError,
  createSwitchioUnavailableError,
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentResult,
  interpretSwitchioRefundResult,
  interpretSwitchioReversalResult,
  interpretSwitchioTransactionLookup,
  type SwitchioClosureDep,
  SwitchioNativeClosureResultSchema,
  type SwitchioNativePayResult,
  SwitchioNativePayResultSchema,
  type SwitchioNativeRestoredClosure,
  SwitchioNativeRestoredClosureSchema,
  type SwitchioRefundDep,
  type SwitchioResultUnreadableError,
  type SwitchioTerminalDep,
  type SwitchioUnavailableError,
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
  close(closureId: string, accountId: string): Promise<unknown>
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

/** A closure begun with no result stored: SwitchioPay never answered it. */
const UnansweredClosureSchema = z.object({ unanswered: z.literal(true) })

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
 * One of the native result stores — the payment's, the closure's, the
 * refund's — each with its own request code, so a result never reaches
 * another kind's recovery (payment/0008).
 */
interface SwitchioResultStore {
  /** The in-flight flag its launches hold. */
  readonly launch: "payment" | "closure" | "refund"
  /**
   * Whether a launch on it is waiting on SwitchioPay: a second would take
   * the first one's promise on the native side, and the restore path must
   * leave its result to that promise.
   */
  readonly busy: () => boolean
  readonly peek: (module: PaykySwitchioNativeModule) => unknown
}

const paymentStore: SwitchioResultStore = {
  launch: "payment",
  busy: () => inFlight.payment,
  peek: (module) => module.peekStoredResult(),
}

const closureStore: SwitchioResultStore = {
  launch: "closure",
  busy: () => inFlight.closure,
  peek: (module) => module.peekStoredClosureResult(),
}

/** A lookup stores nothing, but asks the terminal the refund depends on. */
const refundStore: SwitchioResultStore = {
  launch: "refund",
  busy: () => inFlight.refund || inFlight.lookup,
  peek: (module) => module.peekStoredRefundResult(),
}

/**
 * Launches SwitchioPay for one request and reads its answer, the same way
 * for every kind:
 *
 * - a demo account calls no outside service (demo-data/0001), and a build
 *   without the module has none to call;
 * - a launch while another on the same store is in flight, or while a
 *   result no one has settled yet waits there, is refused as unreadable:
 *   it would overwrite what the terminal did, so the restore path settles
 *   that first;
 * - the stored copy is acknowledged as soon as the promise answers, since
 *   the caller settles it from the promise;
 * - only a missing SwitchioPay is known to fail before the terminal could
 *   act. Any other rejection (a dropped bridge call, a recreated activity)
 *   may come after it took the card or closed the batch, so it is an
 *   unknown outcome, never "unavailable".
 */
const launchSwitchio = async <Answer, Value, Error>({
  demo,
  store,
  launch,
  acknowledge,
  schema,
  interpret,
}: {
  readonly demo: boolean
  readonly store: SwitchioResultStore
  readonly launch: (module: PaykySwitchioNativeModule) => Promise<unknown>
  readonly acknowledge: (module: PaykySwitchioNativeModule) => void
  readonly schema: z.ZodType<Answer>
  readonly interpret: (answer: Answer) => Result<Value, Error>
}): Promise<
  Result<
    Value,
    Error | SwitchioUnavailableError | SwitchioResultUnreadableError
  >
> => {
  if (demo) return err(createSwitchioUnavailableError({ reason: "demo" }))
  if (switchio === null) {
    return err(createSwitchioUnavailableError({ reason: "notNativeRuntime" }))
  }
  if (store.busy()) return unreadable()
  if (store.peek(switchio) !== null) return unreadable()

  const module = switchio
  return whileInFlight(store.launch, async () => {
    try {
      const raw = await launch(module)
      acknowledge(module)
      const parsed = schema.safeParse(raw)
      return parsed.success ? interpret(parsed.data) : unreadable()
    } catch (error) {
      if (isNotInstalledRejection(error)) {
        return err(createSwitchioUnavailableError({ reason: "notInstalled" }))
      }
      return unreadable()
    }
  })
}

/**
 * The result of a launch whose promise was lost when Android killed the app,
 * if one is waiting, the same way for every kind. Nothing while a launch on
 * its store is in flight: that promise settles it. Only the active account
 * takes it (`claimStoredResult`): one launched in another account of this
 * device waits for that account, and one whose account is gone is cleared
 * as unusable. Cleared as it is taken, so this path settles a result at
 * most once; the settling Tasks are idempotent too.
 */
const takeStoredSwitchioResult = <Stored>({
  store,
  owner,
  schema,
  acknowledge,
}: {
  readonly store: SwitchioResultStore
  readonly owner: SwitchioResultOwner
  readonly schema: z.ZodType<Stored>
  readonly acknowledge: (
    module: PaykySwitchioNativeModule,
    stored: Stored | null
  ) => void
}): Stored | "unusable" | null => {
  if (switchio === null || store.busy()) return null
  const stored = store.peek(switchio)
  if (stored === null || stored === undefined) return null
  const claim = claimStoredResult(stored, owner)
  if (claim === "wait") return null

  const parsed = schema.safeParse(stored)
  acknowledge(switchio, parsed.success ? parsed.data : null)
  return parsed.success && claim === "take" ? parsed.data : "unusable"
}

/**
 * Takes card payments through SwitchioPay. The attempt's marker
 * (`unresolvedTransactionId`) is stored before the terminal is launched, so
 * acknowledging the answer cannot lose information: a crash before the
 * outcome is recorded leaves the attempt unresolved, never silently unpaid.
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
    pay: (request) =>
      launchSwitchio({
        demo,
        store: paymentStore,
        launch: (module) =>
          module.pay(
            request.transactionId,
            request.amount,
            request.tipAmount,
            request.currencyCode,
            request.invoiceNumber ?? null,
            accountId
          ),
        acknowledge: (module) =>
          module.acknowledgeResult(request.transactionId),
        schema: SwitchioNativePayResultSchema,
        interpret: interpretSwitchioPaymentResult,
      }),
  },
})

/** A payment's result whose promise was lost; see `takeStoredSwitchioResult`. */
export const takeRestoredSwitchioResult = (
  owner: SwitchioResultOwner
): SwitchioNativePayResult | "unusable" | null =>
  takeStoredSwitchioResult({
    store: paymentStore,
    owner,
    schema: SwitchioNativePayResultSchema,
    acknowledge: (module, stored) =>
      module.acknowledgeResult(stored?.transactionId ?? null),
  })

/**
 * Closes the batch of the SwitchioPay terminal on this phone. The caller
 * records the closure from the promise; the stored copy is only for a
 * promise lost with the process.
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
    close: ({ closureId }) =>
      launchSwitchio({
        demo,
        store: closureStore,
        launch: (module) => module.close(closureId, accountId),
        acknowledge: (module) => module.acknowledgeClosureResult(),
        schema: SwitchioNativeClosureResultSchema,
        interpret: interpretSwitchioClosureResult,
      }),
  },
})

/**
 * A closure's result whose promise was lost; see `takeStoredSwitchioResult`.
 * A closure begun but never answered comes back as `unanswered`: the batch
 * may have been closed, and there are no totals to record.
 */
export const takeRestoredSwitchioClosureResult = (
  owner: SwitchioResultOwner
): SwitchioNativeRestoredClosure | "unusable" | "unanswered" | null => {
  const taken = takeStoredSwitchioResult({
    store: closureStore,
    owner,
    schema: z.union([
      UnansweredClosureSchema,
      SwitchioNativeRestoredClosureSchema,
    ]),
    acknowledge: (module) => module.acknowledgeClosureResult(),
  })
  return taken !== null && typeof taken === "object" && "unanswered" in taken
    ? "unanswered"
    : taken
}

/**
 * Whether a refund or a lookup is waiting on SwitchioPay in this process.
 * Asking the terminal about a pending attempt makes sense only when nothing
 * is: `resolveCardSwitchioRefundAttempt` turns a pending attempt it cannot
 * account for into an unknown one.
 */
export const isSwitchioRefundInFlight = (): boolean => refundStore.busy()

/**
 * Takes payments back (reversal) and refunds them to the card through
 * SwitchioPay, and asks it about one whose result was lost (refund/0007,
 * refund/0008). A reversal and a referral refund share the refund store;
 * the attempt is written before SwitchioPay is launched, so a crash before
 * its outcome is applied leaves it pending, to be asked about, never
 * forgotten.
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
      launchSwitchio({
        demo,
        store: refundStore,
        launch: (module) =>
          module.reversal(
            request.transactionId,
            request.originalTransactionId,
            accountId
          ),
        acknowledge: (module) =>
          module.acknowledgeRefundResult(request.transactionId),
        schema: SwitchioNativePayResultSchema,
        interpret: interpretSwitchioReversalResult,
      }),
    referralRefund: (request) =>
      launchSwitchio({
        demo,
        store: refundStore,
        launch: (module) =>
          module.referralRefund(
            request.transactionId,
            request.amount,
            request.currencyCode,
            request.refundId,
            accountId
          ),
        acknowledge: (module) =>
          module.acknowledgeRefundResult(request.transactionId),
        schema: SwitchioNativePayResultSchema,
        interpret: interpretSwitchioRefundResult,
      }),
    // Stores nothing and changes nothing, so every failure is `unknown`.
    lookup: async (transactionId) => {
      if (demo || switchio === null || refundStore.busy()) {
        return { type: "unknown" }
      }
      const module = switchio
      return whileInFlight("lookup", async () => {
        try {
          const raw = await module.lookupTransaction(transactionId)
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

/** A refund's result whose promise was lost; see `takeStoredSwitchioResult`. */
export const takeRestoredSwitchioRefundResult = (
  owner: SwitchioResultOwner
): SwitchioNativePayResult | "unusable" | null =>
  takeStoredSwitchioResult({
    store: refundStore,
    owner,
    schema: SwitchioNativePayResultSchema,
    acknowledge: (module, stored) =>
      module.acknowledgeRefundResult(stored?.transactionId ?? null),
  })
