import { err } from "@evolu/common"
import {
  createSwitchioResultUnreadableError,
  createSwitchioUnavailableError,
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentResult,
  type SwitchioClosureDep,
  type SwitchioNativeClosureResult,
  SwitchioNativeClosureResultSchema,
  type SwitchioNativePayResult,
  SwitchioNativePayResultSchema,
  type SwitchioTerminalDep,
} from "@payky/core/switchio"
import { NativeModule, requireOptionalNativeModule } from "expo"

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
    invoiceNumber: string | null
  ): Promise<unknown>
  peekStoredResult(): unknown
  acknowledgeResult(transactionId: string | null): void
  close(): Promise<unknown>
  peekStoredClosureResult(): unknown
  acknowledgeClosureResult(): void
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

const unreadable = () =>
  err(
    createSwitchioResultUnreadableError({ resultCode: null, rawResult: null })
  )

export const createSwitchioTerminalDep = (): SwitchioTerminalDep => ({
  switchioTerminal: {
    pay: async (request) => {
      if (switchio === null) {
        return err(
          createSwitchioUnavailableError({ reason: "notNativeRuntime" })
        )
      }

      // A result no one has settled yet belongs to an earlier attempt and
      // would be overwritten by this one: wait until it has been settled
      // (`SwitchioRestoredResult` does that at start-up).
      if (switchio.peekStoredResult() !== null) return unreadable()

      try {
        const raw = await switchio.pay(
          request.transactionId,
          request.amount,
          request.tipAmount,
          request.currencyCode,
          request.invoiceNumber ?? null
        )
        // The attempt's marker (`unresolvedTransactionId`) was stored before
        // the terminal was launched, so acknowledging here cannot lose
        // information: a crash before the outcome is recorded leaves the
        // attempt unresolved, never silently unpaid.
        switchio.acknowledgeResult(request.transactionId)
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
          return err(createSwitchioUnavailableError({ reason: "notInstalled" }))
        }
        return unreadable()
      }
    },
  },
})

/**
 * The result of an attempt whose promise was lost when Android killed the
 * app, if one is waiting. Clears it first, so a result is settled at most
 * once by this path; `settleRestoredSwitchioCardPayment` is idempotent too.
 */
export const takeRestoredSwitchioResult = ():
  | SwitchioNativePayResult
  | "unusable"
  | null => {
  if (switchio === null) return null
  const stored = switchio.peekStoredResult()
  if (stored === null || stored === undefined) return null

  const parsed = SwitchioNativePayResultSchema.safeParse(stored)
  switchio.acknowledgeResult(parsed.success ? parsed.data.transactionId : null)
  return parsed.success ? parsed.data : "unusable"
}

/**
 * Closes the batch of the SwitchioPay terminal on this phone. Has its own
 * request code and result store on the native side, so a closure is never
 * taken for a payment's result (payment/0008). A demo account calls no
 * outside service (demo-data/0001), so it never reaches the terminal.
 */
export const createSwitchioClosureDep = ({
  demo,
}: {
  readonly demo: boolean
}): SwitchioClosureDep => ({
  switchioClosure: {
    close: async () => {
      if (switchio === null || demo) {
        return err(
          createSwitchioUnavailableError({ reason: "notNativeRuntime" })
        )
      }

      // An earlier closure's result no one has recorded yet would be
      // overwritten by this one: let `SwitchioRestoredClosure` record it.
      if (switchio.peekStoredClosureResult() !== null) return unreadable()

      try {
        const raw = await switchio.close()
        // Recorded by the caller from this promise; the stored copy is only
        // for a promise lost with the process.
        switchio.acknowledgeClosureResult()
        const parsed = SwitchioNativeClosureResultSchema.safeParse(raw)
        return parsed.success
          ? interpretSwitchioClosureResult(parsed.data)
          : unreadable()
      } catch (error) {
        // As with a payment, only a missing SwitchioPay is known to fail
        // before the batch could have been closed.
        if (isNotInstalledRejection(error)) {
          return err(createSwitchioUnavailableError({ reason: "notInstalled" }))
        }
        return unreadable()
      }
    },
  },
})

/**
 * The result of a closure whose promise was lost when Android killed the
 * app, if one is waiting. Clears it as it is taken;
 * `recordRestoredCardSwitchioClosure` is idempotent too.
 */
export const takeRestoredSwitchioClosureResult = ():
  | SwitchioNativeClosureResult
  | "unusable"
  | null => {
  if (switchio === null) return null
  const stored = switchio.peekStoredClosureResult()
  if (stored === null || stored === undefined) return null

  switchio.acknowledgeClosureResult()
  const parsed = SwitchioNativeClosureResultSchema.safeParse(stored)
  return parsed.success ? parsed.data : "unusable"
}
