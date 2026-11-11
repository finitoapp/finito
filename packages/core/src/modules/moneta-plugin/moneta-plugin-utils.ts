import { tz } from "@date-fns/tz"
import { createIdFromString } from "@evolu/common"
import { addDays, format, subMonths, subYears } from "date-fns"

import type { MonetaTransaction } from "../../integrations/moneta/moneta-client.ts"
import {
  dateStringToDate,
  dateToDateString,
} from "../shared/date-string-utils.ts"
import {
  type DateString,
  DateStringSchema,
  type FiatCurrency,
} from "../shared/schema.ts"

/**
 * The MONETA plugin is a singleton, like the fiat bank account it syncs
 * against: there is one such account (`fiatBankAccountQuery`) and so at most
 * one MONETA integration for it, re-pointed whenever that account is replaced
 * (`updateMonetaPluginAccountRow`). Its id is therefore fixed rather than
 * generated.
 *
 * A missing row means the integration is off. Nothing needs to distinguish
 * "not connected yet" from "disconnected".
 */
export const monetaPluginId = createIdFromString<"MonetaPlugin">(
  "payky-moneta-plugin"
)

/** Only the last four characters of a saved token are ever shown. */
export const maskMonetaToken = (token: string): string => {
  const suffix = token.slice(-4)
  return suffix === "" ? "********" : `********${suffix}`
}

const monetaTimeZone = tz("Europe/Prague")

/**
 * The booking day `date` falls on at the bank. MONETA reads only the date
 * of `fromDate` and `toDate` and takes each day whole, in its own time zone
 * whatever offset a request carries (moneta/0008), so a sync asks for bank
 * days rather than instants: a device in another time zone would otherwise
 * shift its window by a day.
 */
export const monetaBankDay = (date: Date): DateString =>
  DateStringSchema.decode(format(date, "yyyy-MM-dd", { in: monetaTimeZone }))

/** `day` moved by `days` calendar days. */
export const addMonetaBankDays = (day: DateString, days: number): DateString =>
  dateToDateString(addDays(dateStringToDate(day), days))

/**
 * How far back the background job reads before it has a sync pointer: two
 * months. The settings screens show this day while no pointer is set, as
 * that is where the first sync starts.
 */
export const monetaFirstSyncStartDate = (now: Date): DateString =>
  monetaBankDay(subMonths(now, 2))

/**
 * How far back a token reads without strong authentication: two years, less
 * a day so a slow clock cannot reach past it. Asking for more is refused
 * with `NARR` (moneta-client.ts), so a sync clamps its window here instead.
 */
export const earliestMonetaReadableDay = (now: Date): DateString =>
  monetaBankDay(addDays(subYears(now, 2), 1))

export const defaultMonetaPluginCheckIntervalSeconds = 300
export const minMonetaPluginCheckIntervalSeconds = 60

/**
 * The interval the job keeps: a row may hold less — written by the CLI, an
 * older build or another device — and the job is what spends the daily
 * limit, so it holds the minute itself (moneta/0010).
 */
export const monetaPluginCheckIntervalSeconds = (seconds: number): number =>
  Math.max(seconds, minMonetaPluginCheckIntervalSeconds)

/**
 * The call budget (moneta/0010). A token may make 5000 calls a day, shared by
 * every device of the merchant. The background job at the default 300 s makes
 * 288 a day per device, so three devices spend 864. The payment-wait screen
 * asks every `MONETA_FAST_WATCH_INTERVAL_MS` for at most
 * `MONETA_FAST_WATCH_WINDOW_MS` — 150 calls for a payment nobody pays, and
 * usually a handful, since the transfer arrives within a minute or two. The
 * rest covers more than 25 full ten-minute waits a day, in practice hundreds
 * of payments.
 */
export const MONETA_DAILY_CALL_LIMIT = 5000
export const MONETA_FAST_WATCH_INTERVAL_MS = 4000
export const MONETA_FAST_WATCH_WINDOW_MS = 10 * 60 * 1000

/** Background calls a day one device makes at `intervalSeconds`. */
export const estimateMonetaDailyCalls = (intervalSeconds: number): number =>
  Math.ceil((24 * 60 * 60) / intervalSeconds)

/**
 * Whether the payment-wait screen should still ask the bank itself: the
 * payment is payable, the device can reach the bank (`canReachBank`: a native
 * runtime calls it directly, a browser only through the service proxy its
 * device allowed), an active plugin covers the account the payment asks to
 * be paid to, the bank has not refused the token or the daily limit, and the
 * wait is still within the window.
 */
export const isMonetaFastWatchActive = ({
  payable,
  canReachBank,
  hasActivePlugin,
  isStopped,
  createdAt,
  now,
}: {
  readonly payable: boolean
  readonly canReachBank: boolean
  readonly hasActivePlugin: boolean
  readonly isStopped: boolean
  readonly createdAt: Date
  readonly now: Date
}): boolean =>
  payable &&
  canReachBank &&
  hasActivePlugin &&
  !isStopped &&
  now.getTime() - createdAt.getTime() < MONETA_FAST_WATCH_WINDOW_MS

/**
 * A transaction that can pay a payment into the account: incoming, not a
 * reversal, booked (moneta/0003), with a bank reference to key it by, a
 * positive amount, and in the account's currency.
 */
export const isIncomingMonetaTransaction = (
  transaction: MonetaTransaction,
  currency: FiatCurrency
): transaction is MonetaTransaction & { readonly id: string } =>
  transaction.direction === "incoming" &&
  !transaction.isReversal &&
  transaction.status === "booked" &&
  transaction.id !== null &&
  transaction.amountMinor > 0 &&
  transaction.currency === currency
