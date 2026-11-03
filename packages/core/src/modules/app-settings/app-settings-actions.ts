import {
  err,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"
import { z } from "zod"
import type { CashuShardStoreDep } from "../../cashu/cashu-shard-store.ts"
import type { DateDep, EvoluOwnerDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  saveCashRegisterAccount,
  saveCashuAccount,
  saveFiatBankAccount,
  saveSparkAccount,
} from "../account/account-actions.ts"
import { setLegalEntity } from "../legal-entity/legal-entity-actions.ts"
import { legalEntityQuery } from "../legal-entity/legal-entity-queries.ts"
import type { CountryCode } from "../legal-entity/legal-entity-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { type FiatCurrency, type Iban, TimestampMs } from "../shared/schema.ts"
import { seedTaxRatesForCountry } from "../tax-rate/tax-rate-actions.ts"
import { taxRatesQuery } from "../tax-rate/tax-rate-queries.ts"
import type { appSettings } from "./app-settings.ts"
import { settingsQuery } from "./app-settings-queries.ts"
import {
  stringifyTipFixedAmounts,
  stringifyTipPercentages,
} from "./app-settings-tips.ts"
import type {
  AppSettingsId,
  DefaultPaymentMethod,
  TerminalHomeMode,
} from "./app-settings-types.ts"
import {
  createDefaultSettings,
  EnabledHomeModesJson,
  PaymentMethodOrderJson,
  settingsId,
  terminalHomeModes,
} from "./app-settings-utils.ts"

const createAlreadyOnboardedError = defineError("AlreadyOnboarded")()
export type AlreadyOnboardedError = ReturnType<
  typeof createAlreadyOnboardedError
>

/**
 * Refuses an account that already has its appSettings row: onboarding writes
 * last-write-wins singletons (the bank account among them), so running it
 * again on an onboarded account would overwrite them (account/0005).
 */
export const requireNotOnboarded =
  (): Task<void, AlreadyOnboardedError, EvoluDep> => async (run) => {
    const rows = await run.deps.evolu.loadQuery(settingsQuery)
    return rows.length === 0 ? ok() : err(createAlreadyOnboardedError())
  }

/**
 * Creates the appSettings row when onboarding finishes. The row's existence
 * marks the account as onboarded; `onboardingCompleted` is still written for
 * compatibility with older app versions syncing the same account.
 */
export const completeOnboarding =
  (input: {
    readonly fiatCurrency: FiatCurrency
    readonly defaultPaymentMethod: DefaultPaymentMethod
    readonly paymentMethodOrderJson: string
  }): Task<AppSettingsId, AlreadyOnboardedError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    // The last line of defence; `finishOnboarding` checks before its first
    // write already.
    const notOnboarded = await run(requireNotOnboarded())
    if (!notOnboarded.ok) return notOnboarded

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "appSettings",
        {
          ...createDefaultSettings(),
          ...input,
          onboardingCompleted: sqliteTrue,
        },
        { ...options, owner: evoluOwner }
      )
    )
    return ok(settingsId)
  }

export const updateSettings =
  (
    input: Omit<UpdateValues<typeof appSettings>, "id">
  ): Task<AppSettingsId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "appSettings",
        removeUndefinedValues({
          id: settingsId,
          ...input,
        }),
        { ...options, owner: evoluOwner }
      )
    )
    return ok(settingsId)
  }

export const updateTipSettings =
  (input: {
    readonly enabled: boolean
    readonly fixedAmounts: ReadonlyArray<number>
    readonly percentages: ReadonlyArray<number>
  }): Task<AppSettingsId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) =>
    await run(
      updateSettings({
        tipsEnabled: input.enabled ? sqliteTrue : sqliteFalse,
        presetTipPercentagesJson: stringifyTipPercentages(input.percentages),
        presetTipFixedAmountsJson: stringifyTipFixedAmounts(input.fixedAmounts),
      })
    )

/**
 * Saves the order payment methods are offered in. The first one is also
 * written as `defaultPaymentMethod`, which `getPaymentMethodOrder` moves to
 * the front — so the two can no longer disagree, and older app versions
 * syncing the same account still open the right tab.
 */
export const setPaymentMethodOrder =
  (
    order: ReadonlyArray<DefaultPaymentMethod>
  ): Task<AppSettingsId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) =>
    await run(
      updateSettings({
        paymentMethodOrderJson: z.encode(PaymentMethodOrderJson, order),
        defaultPaymentMethod: order[0],
      })
    )

const createNoHomeModeEnabledError = defineError("NoHomeModeEnabled")()
export type NoHomeModeEnabledError = ReturnType<
  typeof createNoHomeModeEnabledError
>

/**
 * Saves which modes the home screen offers. The home screen must always have
 * one to show, so an empty set is refused rather than written. The whole set
 * is one column on purpose: two devices each switching off a different mode
 * resolve to one of their writes, never to both modes off.
 */
export const setEnabledHomeModes =
  (
    modes: ReadonlyArray<TerminalHomeMode>
  ): Task<AppSettingsId, NoHomeModeEnabledError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const enabled = terminalHomeModes.filter((mode) => modes.includes(mode))
    if (enabled.length === 0) return err(createNoHomeModeEnabledError())

    return await run(
      updateSettings({
        enabledHomeModesJson: z.encode(EnabledHomeModesJson, enabled),
      })
    )
  }

/**
 * Records that the merchant typed back words of the recovery phrase
 * correctly (account/0007). The row is account data, so every device of the
 * account sees it. Running it again only moves the stamp forward.
 */
export const markRecoveryPhraseVerified =
  (): Task<AppSettingsId, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) =>
    await run(
      updateSettings({
        recoveryPhraseVerifiedAt: TimestampMs(run.deps.date.now().getTime()),
      })
    )

/**
 * Writes everything the onboarding wizard collected. Refuses an onboarded
 * account before the first write (account/0005): the bank account below is
 * a last-write-wins singleton, so a refusal in `completeOnboarding` alone
 * would come after the IBAN was already overwritten.
 */
export const finishOnboarding =
  (input: {
    readonly country: CountryCode | null
    readonly currency: FiatCurrency
    readonly iban: Iban | null
    readonly defaultPaymentMethod: DefaultPaymentMethod
    readonly paymentMethodOrderJson: string
    /**
     * Spark starts enabled (onboarding/0007) unless the caller enables a
     * wallet of its own instead, as `finishOnboardingOnLinkyWallet` does.
     */
    readonly bitcoinWallet?: "spark" | "none"
  }): Task<
    void,
    AlreadyOnboardedError,
    EvoluDep & EvoluOwnerDep & MasterKeyDep
  > =>
  async (run) => {
    const notOnboarded = await run(requireNotOnboarded())
    if (!notOnboarded.ok) return notOnboarded

    // A restored account can still reach onboarding with data on a relay
    // this device has not synced yet — `_terminal.tsx` gives up waiting for
    // an owner the shared worker never reports, and the restore page lets the
    // merchant set up a phrase whose relays were unreachable. Guard these two
    // against that data arriving later: unlike the singleton account upserts
    // below, `setLegalEntity` would overwrite an already-synced row via
    // last-write-wins, and `seedTaxRatesForCountry` has no upsert semantics
    // at all — it would insert a duplicate set of rates.
    const [existingLegalEntity, existingTaxRates] = await Promise.all([
      run.deps.evolu.loadQuery(legalEntityQuery),
      run.deps.evolu.loadQuery(taxRatesQuery),
    ])

    if (existingLegalEntity.length === 0) {
      await run.ok(setLegalEntity({ country: input.country, vatPayer: false }))
    }
    if (existingTaxRates.length === 0) {
      await run.ok(seedTaxRatesForCountry(input.country))
    }
    await run.ok(
      saveCashRegisterAccount({ enabled: true, currency: input.currency })
    )
    if (input.bitcoinWallet !== "none") {
      await run.ok(saveSparkAccount({ enabled: true }))
    }
    await run.ok(
      saveFiatBankAccount({
        enabled: input.iban !== null,
        iban: input.iban ?? undefined,
        currency: input.currency,
      })
    )
    const completed = await run(
      completeOnboarding({
        fiatCurrency: input.currency,
        defaultPaymentMethod: input.defaultPaymentMethod,
        paymentMethodOrderJson: input.paymentMethodOrderJson,
      })
    )
    if (!completed.ok) return completed
    return ok()
  }

/**
 * Finito's onboarding (onboarding/0009): the Cashu wallet shared with Linky
 * starts enabled as the Bitcoin method instead of Spark, so a fresh account
 * takes bitcoin into the wallet its owner already has. The account is
 * onboarded first: a wallet that cannot be enabled leaves an onboarded
 * account without a bitcoin method, which settings can fix, rather than one
 * stuck in onboarding.
 */
export const finishOnboardingOnLinkyWallet =
  (
    input: Omit<Parameters<typeof finishOnboarding>[0], "bitcoinWallet">
  ): Task<
    void,
    AlreadyOnboardedError,
    EvoluDep & EvoluOwnerDep & MasterKeyDep & CashuShardStoreDep
  > =>
  async (run) => {
    const finished = await run(
      finishOnboarding({ ...input, bitcoinWallet: "none" })
    )
    if (!finished.ok) return finished
    await run.ok(saveCashuAccount({ enabled: true }))
    return ok()
  }
