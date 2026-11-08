import { createIdFromString, sqliteTrue } from "@evolu/common"
import { z } from "zod"
import { jsonCodec } from "../../zod-utils.ts"
import { FiatCurrency } from "../shared/schema.ts"
import type { AppSettingsRow } from "./app-settings.ts"
import {
  defaultTipFixedAmounts,
  defaultTipPercentages,
  stringifyTipFixedAmounts,
  stringifyTipPercentages,
} from "./app-settings-tips.ts"
import {
  type DefaultPaymentMethod,
  DefaultPaymentMethodSchema,
  type TerminalHomeMode,
  TerminalHomeModeSchema,
} from "./app-settings-types.ts"

export const settingsId =
  createIdFromString<"AppSettings">("payky-app-settings")

export const defaultPaymentMethod: DefaultPaymentMethod = "spark"

/** The enum's own order is the order a new account starts with. */
export const defaultPaymentMethodOrder: ReadonlyArray<DefaultPaymentMethod> =
  DefaultPaymentMethodSchema.options

/** `paymentMethodOrderJson` as stored. */
export const PaymentMethodOrderJson = jsonCodec(
  DefaultPaymentMethodSchema.array().readonly()
)

/** `enabledHomeModesJson` as stored. */
export const EnabledHomeModesJson = jsonCodec(
  TerminalHomeModeSchema.array().readonly()
)

/**
 * `enabledHomeModesJson` is left out: `null` already means every mode, which
 * also offers a mode added later to anyone who never narrowed the set.
 * `recoveryPhraseVerifiedAt` is left out: `null` means not verified yet.
 */
/** The fiat currency an account works in before its settings row exists. */
export const defaultFiatCurrency = FiatCurrency.CZK

/**
 * The account's fiat currency, or the default while its settings row has not
 * loaded or synced yet.
 */
export const getFiatCurrency = (
  settings: { readonly fiatCurrency: FiatCurrency | null } | undefined
): FiatCurrency => settings?.fiatCurrency ?? defaultFiatCurrency

export const offersOrders = (
  settings: Pick<AppSettingsRow, "menuOrdering" | "writtenOrders"> | undefined
): boolean =>
  settings?.menuOrdering === sqliteTrue ||
  settings?.writtenOrders === sqliteTrue

export const createDefaultSettings = (): Omit<
  AppSettingsRow,
  | "enabledHomeModesJson"
  | "recoveryPhraseVerifiedAt"
  | "selfPayGuestName"
  | "selfPayBillsHidden"
  | "menuOrdering"
  | "writtenOrders"
  | "writtenOrderTaxRateId"
  | "orderDeviceId"
> => ({
  id: settingsId,
  onboardingCompleted: null,
  fiatCurrency: defaultFiatCurrency,
  tipsEnabled: sqliteTrue,
  presetTipPercentagesJson: stringifyTipPercentages(defaultTipPercentages),
  presetTipFixedAmountsJson: stringifyTipFixedAmounts(defaultTipFixedAmounts),
  paymentMethodOrderJson: z.encode(
    PaymentMethodOrderJson,
    defaultPaymentMethodOrder
  ),
  defaultPaymentMethod,
})

export const parsePaymentMethodOrder = (
  value: string | null | undefined
): ReadonlyArray<DefaultPaymentMethod> => {
  if (value === null || value === undefined) {
    return defaultPaymentMethodOrder
  }

  const parsed = z.safeDecode(PaymentMethodOrderJson, value)
  if (!parsed.success) return defaultPaymentMethodOrder

  const uniqueMethods = parsed.data.filter(
    (method, index, methods) => methods.indexOf(method) === index
  )
  const missingMethods = defaultPaymentMethodOrder.filter(
    (method) => !uniqueMethods.includes(method)
  )

  return [...uniqueMethods, ...missingMethods]
}

/**
 * The order payment methods are offered in, with the default one first.
 * `setPaymentMethodOrder` keeps the two in step; settings written before it
 * (onboarding stores them independently) get the default moved to the front,
 * which is the tab they already opened first.
 */
export const getPaymentMethodOrder = (
  settings:
    | {
        readonly paymentMethodOrderJson: string
        readonly defaultPaymentMethod: DefaultPaymentMethod
      }
    | undefined
): ReadonlyArray<DefaultPaymentMethod> => {
  const order = parsePaymentMethodOrder(settings?.paymentMethodOrderJson)
  if (settings === undefined) return order

  // The query only checks the column is set, so a value another build of the
  // app wrote — a branch with one more method, run on the same device — would
  // otherwise lead the order and crash every screen that keys a lookup by it.
  // Such a value keeps the stored order instead.
  const first = DefaultPaymentMethodSchema.safeParse(
    settings.defaultPaymentMethod
  )
  if (!first.success) return order
  return [first.data, ...order.filter((method) => method !== first.data)]
}

/** Every home-screen mode, in the fixed order the header lists them. */
export const terminalHomeModes: ReadonlyArray<TerminalHomeMode> =
  TerminalHomeModeSchema.options

/**
 * The enabled home-screen modes, in `terminalHomeModes` order. `null`, an
 * unreadable value and an empty set all mean every mode, so the home screen
 * always has one to show.
 */
export const parseEnabledHomeModes = (
  value: string | null | undefined
): ReadonlyArray<TerminalHomeMode> => {
  if (value === null || value === undefined) return terminalHomeModes

  const parsed = z.safeDecode(EnabledHomeModesJson, value)
  if (!parsed.success) return terminalHomeModes

  const enabled = terminalHomeModes.filter((mode) => parsed.data.includes(mode))
  return enabled.length === 0 ? terminalHomeModes : enabled
}

/** The remembered mode while it is enabled, otherwise the first enabled one. */
export const resolveTerminalHomeMode = (
  remembered: TerminalHomeMode,
  enabled: ReadonlyArray<TerminalHomeMode>
): TerminalHomeMode =>
  enabled.includes(remembered) ? remembered : (enabled[0] ?? remembered)

/**
 * Whether the recovery-phrase backup reminder is due (account/0007): after
 * the account's first paid payment, until the phrase is verified, never on a
 * demo account, and not while this device's snooze still holds.
 */
export function isBackupReminderDue(input: {
  readonly hasPaidPayment: boolean
  readonly verifiedAt: number | null
  readonly isDemo: boolean
  readonly snoozedUntil: number | null
  readonly now: number
}): boolean {
  return (
    input.hasPaidPayment &&
    input.verifiedAt === null &&
    !input.isDemo &&
    (input.snoozedUntil === null || input.snoozedUntil <= input.now)
  )
}
