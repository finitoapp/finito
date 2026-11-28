import {
  err,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
  type UpdateValues,
} from "@evolu/common"
import { z } from "zod"
import type { DateDep, EvoluOwnerDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  saveCardSwitchioAccount,
  saveCashRegisterAccount,
  saveFiatBankAccount,
  saveSparkAccount,
} from "../account/account-actions.ts"
import {
  type NewCatalogCategory,
  planCatalogCategoriesByName,
  upsertNewCatalogCategories,
} from "../catalog-category/catalog-category-actions.ts"
import {
  type NewCatalogItem,
  planCatalogItemsAtEnd,
  upsertNewCatalogItems,
} from "../catalog-item/catalog-item-actions.ts"
import type { CatalogItemPricingError } from "../catalog-item/catalog-item-utils.ts"
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
import {
  activeTaxRatesQuery,
  taxRatesQuery,
} from "../tax-rate/tax-rate-queries.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { findActiveTaxRateByPercentage } from "../tax-rate/tax-rate-utils.ts"
import type { appSettings } from "./app-settings.ts"
import { settingsQuery } from "./app-settings-queries.ts"
import {
  stringifyTipFixedAmounts,
  stringifyTipPercentages,
} from "./app-settings-tips.ts"
import type {
  AppSettingsId,
  DefaultPaymentMethod,
  OnboardingStarterItem,
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

/** What the appSettings row an onboarding writes starts with. */
interface OnboardingSettingsInput {
  readonly fiatCurrency: FiatCurrency
  readonly defaultPaymentMethod: DefaultPaymentMethod
  readonly paymentMethodOrderJson: string
  /**
   * The one mode home offers, as the merchant chose it (onboarding/0012);
   * left out, the modes stay unset, which means all of them.
   */
  readonly homeMode?: TerminalHomeMode
  /** Left out, tips start on. */
  readonly tipsEnabled?: boolean
}

/**
 * Writes the appSettings row that marks the account onboarded into the
 * caller's batch; `onboardingCompleted` is still written for compatibility
 * with older app versions syncing the same account.
 */
const upsertOnboardingSettings = (
  evolu: EvoluDep["evolu"],
  { homeMode, tipsEnabled, ...input }: OnboardingSettingsInput,
  options: MutationOptions
): void => {
  evolu.upsert(
    "appSettings",
    {
      ...createDefaultSettings(),
      ...input,
      ...(homeMode === undefined
        ? {}
        : {
            enabledHomeModesJson: z.encode(EnabledHomeModesJson, [homeMode]),
          }),
      ...(tipsEnabled === undefined
        ? {}
        : { tipsEnabled: tipsEnabled ? sqliteTrue : sqliteFalse }),
      onboardingCompleted: sqliteTrue,
    },
    options
  )
}

/**
 * Creates the appSettings row when onboarding finishes. The row's existence
 * marks the account as onboarded.
 */
export const completeOnboarding =
  (
    input: OnboardingSettingsInput
  ): Task<AppSettingsId, AlreadyOnboardedError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    const notOnboarded = await run(requireNotOnboarded())
    if (!notOnboarded.ok) return notOnboarded

    await runMutationWithCompletion((options) =>
      upsertOnboardingSettings(run.deps.evolu, input, {
        ...options,
        owner: evoluOwner,
      })
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

/**
 * Saves the tax rate a VAT payer's keypad amount is sold at, or clears it
 * with `null`. The rate is not checked here: one deleted later, or not yet
 * synced to the device reading it, reads as no rate set anyway.
 */
export const setKeypadTaxRate =
  (
    taxRateId: TaxRateId | null
  ): Task<AppSettingsId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) =>
    await run(updateSettings({ keypadTaxRateId: taxRateId }))

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

/** The starter pack's rows, judged and placed, nothing of them written. */
interface StarterItemsPlan {
  readonly categories: ReadonlyArray<NewCatalogCategory>
  readonly items: ReadonlyArray<NewCatalogItem>
}

/**
 * Plans a starter pack's items in the onboarding currency, after the
 * catalog's last item, without writing. Items naming one category share it,
 * made where there is none of that name yet; an item's VAT becomes the
 * account's active rate of that percentage, or none when it has no such
 * rate. Every item's pricing is judged here, so a refused one stops the
 * pack before anything of it is written.
 */
const planStarterItems =
  (
    starterItems: ReadonlyArray<OnboardingStarterItem>,
    currency: FiatCurrency
  ): Task<StarterItemsPlan, CatalogItemPricingError, EvoluDep> =>
  async (run) => {
    if (starterItems.length === 0) return ok({ categories: [], items: [] })

    const [taxRates, categories] = await Promise.all([
      run.deps.evolu.loadQuery(activeTaxRatesQuery),
      run.ok(
        planCatalogCategoriesByName(
          starterItems.flatMap(({ categoryName }) =>
            categoryName === null ? [] : [categoryName]
          )
        )
      ),
    ])

    const items = await run(
      planCatalogItemsAtEnd(
        starterItems.map((item) => ({
          deviceId: null,
          categoryId:
            item.categoryName === null
              ? null
              : categories.idOf(item.categoryName),
          name: item.name,
          libraryProductId: item.libraryProductId,
          currency,
          unitAmount: item.unitAmount,
          taxRateId:
            item.taxRatePercentage === null
              ? null
              : (findActiveTaxRateByPercentage(
                  taxRates,
                  item.taxRatePercentage
                ) ?? null),
        }))
      )
    )
    if (!items.ok) return items
    return ok({ categories: categories.created, items: items.value })
  }

/**
 * Writes everything the onboarding wizard collected. Refuses an onboarded
 * account before the first write (account/0005): the bank account below is
 * a last-write-wins singleton, so a refusal at the settings row alone would
 * come after the IBAN was already overwritten.
 */
export const finishOnboarding =
  (input: {
    readonly country: CountryCode | null
    readonly currency: FiatCurrency
    readonly iban: Iban | null
    readonly defaultPaymentMethod: DefaultPaymentMethod
    readonly paymentMethodOrderJson: string
    /** How the business sells, chosen on onboarding's last step (onboarding/0012). */
    readonly homeMode: TerminalHomeMode
    readonly tipsEnabled: boolean
    /**
     * Whether this device can launch SwitchioPay: the card terminal starts
     * enabled on a phone that has it (onboarding/0015), left as it is
     * otherwise.
     */
    readonly cardSwitchio: boolean
    /**
     * The starter pack's products the merchant checked and priced; left out,
     * the catalog starts empty.
     */
    readonly starterItems?: ReadonlyArray<OnboardingStarterItem>
  }): Task<
    void,
    AlreadyOnboardedError | CatalogItemPricingError,
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

    // These writes come before the starter pack is judged, which needs the
    // seeded rates, and each is its own batch. Running them again is
    // harmless: the two above are skipped once their rows exist, and the
    // accounts are singleton upserts a second finish only writes again
    // with what the wizard then holds.
    // So a finish refused or cut short anywhere up to the last batch leaves
    // the account not onboarded, and the wizard can finish it again.
    if (existingLegalEntity.length === 0) {
      await run.ok(setLegalEntity({ country: input.country, vatPayer: false }))
    }
    if (existingTaxRates.length === 0) {
      await run.ok(seedTaxRatesForCountry(input.country))
    }
    await run.ok(
      saveCashRegisterAccount({ enabled: true, currency: input.currency })
    )
    await run.ok(saveSparkAccount({ enabled: true }))
    if (input.cardSwitchio) {
      await run.ok(
        saveCardSwitchioAccount({ enabled: true, currency: input.currency })
      )
    }
    await run.ok(
      saveFiatBankAccount({
        enabled: input.iban !== null,
        iban: input.iban ?? undefined,
        currency: input.currency,
      })
    )

    const starter = await run(
      planStarterItems(input.starterItems ?? [], input.currency)
    )
    if (!starter.ok) return starter

    // The last line of defence: a settings row synced in since the check
    // above must not be overwritten, nor get a second starter pack.
    const stillNotOnboarded = await run(requireNotOnboarded())
    if (!stillNotOnboarded.ok) return stillNotOnboarded

    // One batch: the starter pack lands with the row that marks the account
    // onboarded or not at all, so a finish cut short creates no pack the
    // wizard's next finish would create a second time.
    const { evoluOwner } = run.deps
    await runMutationWithCompletion((options) => {
      const ownerOptions = { ...options, owner: evoluOwner }
      upsertNewCatalogCategories(
        run.deps.evolu,
        starter.value.categories,
        ownerOptions
      )
      upsertNewCatalogItems(run.deps.evolu, starter.value.items, ownerOptions)
      upsertOnboardingSettings(
        run.deps.evolu,
        {
          fiatCurrency: input.currency,
          defaultPaymentMethod: input.defaultPaymentMethod,
          paymentMethodOrderJson: input.paymentMethodOrderJson,
          homeMode: input.homeMode,
          tipsEnabled: input.tipsEnabled,
        },
        ownerOptions
      )
    })
    return ok()
  }
