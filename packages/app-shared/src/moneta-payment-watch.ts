import type { Result } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import type {
  MonetaPluginNotFoundError,
  MonetaSyncError,
  MonetaSyncResult,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import {
  isMonetaFastWatchActive,
  MONETA_FAST_WATCH_INTERVAL_MS,
  MONETA_FAST_WATCH_WINDOW_MS,
  monetaBankDay,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { type DateString, TimestampMs } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"

/**
 * How the payment-wait screen's own MONETA check went (moneta/0010): the
 * bank answered, did not, or refused — the token, or the daily limit — which
 * stops the check for the rest of the wait.
 */
export type MonetaPaymentWatchResult =
  | "answered"
  | "unreachable"
  | "unauthorized"
  | "rateLimited"

type MonetaPaymentWatchSyncResult = Result<
  MonetaSyncResult,
  MonetaSyncError | MonetaPluginNotFoundError
>

export const toMonetaPaymentWatchResult = (
  result: Result<unknown, MonetaSyncError | MonetaPluginNotFoundError>
): MonetaPaymentWatchResult => {
  if (result.ok) return "answered"

  switch (result.error.type) {
    case "MonetaUnauthorizedError":
      return result.error.code === "NARR" ? "unreachable" : "unauthorized"
    case "MonetaRateLimitError":
      return "rateLimited"
    case "MonetaApiError":
    case "MonetaHttpError":
    case "FetchError":
    case "MonetaPluginNotFound":
      return "unreachable"
  }
}

export const isMonetaPaymentWatchStopped = (
  result: MonetaPaymentWatchResult | undefined
): boolean => result === "unauthorized" || result === "rateLimited"

/**
 * The bank days that hold a payment's transfer: from the day it was created
 * up to today. The bank filters by booking date, which is never before the
 * day the transfer arrives (moneta/0004), and counts days in its own time
 * zone (moneta/0008).
 */
export const monetaPaymentWatchRange = (
  createdAt: Date,
  now: Date
): MonetaPaymentWatchRange => ({
  fromDate: monetaBankDay(createdAt),
  toDate: monetaBankDay(now),
})

/** Bank days, both included (`syncMonetaTransactions`). */
export interface MonetaPaymentWatchRange {
  readonly fromDate: DateString
  readonly toDate: DateString
}

/**
 * The gap before the next check. A check reads every page of the window, so
 * the screen waits one interval per page it read: however busy the account,
 * a wait spends at most `MONETA_FAST_WATCH_WINDOW_MS /
 * MONETA_FAST_WATCH_INTERVAL_MS` calls, the budget moneta/0010 counts.
 */
export const monetaPaymentWatchIntervalMs = (callCount: number): number =>
  MONETA_FAST_WATCH_INTERVAL_MS * Math.max(1, callCount)

/** The line under the QR code; `null` once the watch says nothing. */
export const monetaPaymentWatchStatusKey = ({
  isActive,
  result,
}: {
  readonly isActive: boolean
  readonly result: MonetaPaymentWatchResult | undefined
}): TranslationKey | null => {
  if (result === "unauthorized") return "paymentWait.monetaWatch.unauthorized"
  if (result === "rateLimited") return "paymentWait.monetaWatch.rateLimited"
  if (!isActive) return null
  return result === "unreachable"
    ? "paymentWait.monetaWatch.unreachable"
    : "paymentWait.monetaWatch.watching"
}

export interface MonetaPaymentWatchCheck {
  readonly result: MonetaPaymentWatchResult
  readonly callCount: number
  /**
   * The token the check used. A refusal stops the watch only while the
   * plugin still has that token, so connecting a new one from the screen's
   * own settings link starts checking again.
   */
  readonly token: string
}

/**
 * One check of the watch: runs the sync and says how it went. A sync that
 * throws instead of returning a failure is no answer from the bank either,
 * so it reads as `unreachable` and the next interval tries again, as after
 * an expected failure — the screen never keeps saying it is checking while
 * every check fails.
 */
export const checkMonetaPaymentWatch = async ({
  sync,
  range,
  token,
  onFailure,
}: {
  readonly sync: (
    range: MonetaPaymentWatchRange
  ) => Promise<MonetaPaymentWatchSyncResult>
  readonly range: MonetaPaymentWatchRange
  readonly token: string
  readonly onFailure: (error: unknown) => void
}): Promise<MonetaPaymentWatchCheck> => {
  try {
    const result = await sync(range)
    if (!result.ok) onFailure(result.error)
    return {
      result: toMonetaPaymentWatchResult(result),
      callCount: result.ok ? result.value.callCount : 1,
      token,
    }
  } catch (error) {
    onFailure(error)
    return { result: "unreachable", callCount: 1, token }
  }
}

/**
 * MONETA's fast speed (moneta/0010), the one body behind web's and native's
 * `useMonetaPaymentWatch`: while a payable bank transfer to an account with
 * a connected MONETA token waits, ask the bank every few seconds for the
 * first ten minutes. The payment turns paid through the claim the sync
 * writes, as with a manual "Paid", so this only says what the check is
 * doing. A refused token or an exceeded limit stops it for the rest of the
 * wait; the background job carries on.
 *
 * The apps pass what differs between them: whether this device can reach
 * the bank (`canReachBank`: natively, or in a browser through the service
 * proxy it allowed), the active plugin of the payment's account, and how to
 * run the sync.
 */
export function useMonetaPaymentWatchFor({
  paymentId,
  createdAt,
  payable,
  canReachBank,
  pluginToken,
  sync,
  onFailure,
}: {
  readonly paymentId: PaymentId
  readonly createdAt: string | null
  readonly payable: boolean
  readonly canReachBank: boolean
  /** The token of the active plugin of the payment's account, if any. */
  readonly pluginToken: string | null
  readonly sync: (
    range: MonetaPaymentWatchRange
  ) => Promise<MonetaPaymentWatchSyncResult>
  readonly onFailure: (error: unknown) => void
}) {
  const createdAtDate = createdAt === null ? null : new Date(createdAt)
  const windowEnd =
    createdAtDate === null
      ? null
      : TimestampMs(createdAtDate.getTime() + MONETA_FAST_WATCH_WINDOW_MS)
  const now = useNow([windowEnd])

  const resultFor = (check: MonetaPaymentWatchCheck | undefined) =>
    check === undefined ||
    (check.result === "unauthorized" && check.token !== pluginToken)
      ? undefined
      : check.result

  const isWatchable = (check: MonetaPaymentWatchCheck | undefined) =>
    createdAtDate !== null &&
    isMonetaFastWatchActive({
      payable,
      canReachBank,
      hasActivePlugin: pluginToken !== null,
      isStopped: isMonetaPaymentWatchStopped(resultFor(check)),
      createdAt: createdAtDate,
      now,
    })

  const watch = useQuery<MonetaPaymentWatchCheck>({
    queryKey: ["monetaPaymentWatch", paymentId],
    queryFn: () =>
      checkMonetaPaymentWatch({
        sync,
        range: monetaPaymentWatchRange(createdAtDate ?? new Date(), new Date()),
        token: pluginToken ?? "",
        onFailure,
      }),
    refetchInterval: (query) =>
      monetaPaymentWatchIntervalMs(query.state.data?.callCount ?? 1),
    // Every attempt is a call against the daily limit, so only the interval
    // paces it: no retry, and a result that never goes stale, so a remount
    // (a tab switch), a reconnect or the app coming back to the foreground
    // asks the bank no extra time.
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    // Read off the query's own last result, so a refusal stops the very
    // next poll rather than one render later.
    enabled: (query) => isWatchable(query.state.data),
  })
  const isActive = isWatchable(watch.data)
  const result = resultFor(watch.data)

  return {
    isActive,
    result,
    statusKey: monetaPaymentWatchStatusKey({ isActive, result }),
  }
}
