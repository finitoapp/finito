import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import {
  createMasterKey,
  masterKeyToMnemonic,
} from "@payky/core/modules/shared/key-derivation"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import type { Page } from "@playwright/test"
import { translate } from "./i18n.ts"

/**
 * Runner-agnostic: `bin/generate-doc-screenshots.ts` imports these helpers
 * outside the Playwright test runner, so nothing here may call `test.step(...)`
 * — it throws "test.step() can only be called from a test" there.
 */
export interface SeedOptions {
  readonly spark?: boolean
  readonly fiatCurrency?: FiatCurrency
  /** Leaves the recovery phrase unverified, so the backup reminder can show. */
  readonly unverifiedBackup?: boolean
}

/**
 * Seeds onboarding for whichever account is currently active on the page via
 * `window.__e2eSeedOnboarding` (see src/components/app/e2e-test-bridge.tsx),
 * which writes the same account/settings rows `completeOnboarding` produces
 * (cash + IBAN enabled, USD, tips on defaults), then waits for the app's own
 * reactive redirect off the onboarding page. Assumes the app has already
 * loaded on the current page (the bridge mounts for every route).
 */
export async function seedCurrentAccountOnboarding(
  page: Page,
  language: Language,
  options?: SeedOptions
): Promise<void> {
  // Retried, because the document can be replaced under this call — only a
  // *document* navigation destroys an execution context, so a client-side
  // route change is not the hazard here; a service-worker takeover or Evolu's
  // own `reloadApp` is. Every spec goes through the `seededPage` fixture, so
  // losing the context here surfaces as an unrelated spec failing in its
  // first step, with an error that says nothing about the spec.
  //
  // Safe to repeat: the seed is four singleton upserts (the cash/Spark/bank
  // account rows and the settings row), so a half-applied seed plus a full
  // re-run converges on the same state.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.waitForFunction(
        () => typeof window.__e2eSeedOnboarding === "function"
      )
      await page.evaluate(
        (seedOptions) => window.__e2eSeedOnboarding?.(seedOptions),
        options
      )
      break
    } catch (error) {
      // Narrow on purpose: anything else is a real failure and must not be
      // retried into a timeout that hides it.
      const lostContext =
        error instanceof Error &&
        error.message.includes("Execution context was destroyed")
      if (attempt >= 2 || !lostContext) throw error
      await page.waitForLoadState("domcontentloaded")
    }
  }
  await page
    .getByRole("button", { name: translate(language, "nav.menu") })
    .waitFor()
}

/**
 * Reaches the terminal home screen without clicking through onboarding. Use
 * this in specs that don't test onboarding itself — `completeOnboarding()`
 * remains the one exercising the real onboarding UI. Pass `{ spark: true }`
 * to also enable the Spark payment method (disabled by default).
 */
export async function seedOnboarding(
  page: Page,
  language: Language,
  options?: SeedOptions
): Promise<void> {
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
  await seedCurrentAccountOnboarding(page, language, options)
}

/**
 * A recovery phrase no relay has seen. The relays e2e syncs with are real and
 * shared, so a fixed phrase stays unregistered only until one run onboards
 * it — every call derives a fresh master key instead.
 */
export const createUnregisteredMnemonic = (): Promise<string> =>
  masterKeyToMnemonic(createMasterKey())

/** Pastes `phrase` into the first word field, which fans it out over the grid. */
export async function fillRestorePhrase(
  page: Page,
  language: Language,
  phrase: string
): Promise<void> {
  await page
    .getByRole("textbox", {
      name: translate(language, "onboarding.restore.wordLabel").replace(
        "{index}",
        "1"
      ),
      exact: true,
    })
    .fill(phrase)
}

/**
 * Takes the onboarding page already open from its welcome step to the
 * recovery phrase: "I already have an account", then the phrase in the
 * chooser (onboarding/0011).
 */
export async function openRestorePhraseStep(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", {
      name: translate(language, "accountChoice.existing.title"),
    })
    .click()
  await page
    .getByRole("button", {
      name: translate(language, "openAccount.phrase.title"),
    })
    .click()
}

/**
 * Picks the recovery phrase on the onboarding page already open and submits
 * `mnemonic`, leaving the page on the restore sync screen. Navigates nowhere
 * itself, so a caller can take the context offline first.
 */
export async function submitRestorePhrase(
  page: Page,
  language: Language,
  mnemonic: string
): Promise<void> {
  await openRestorePhraseStep(page, language)
  await fillRestorePhrase(page, language, mnemonic)
  await page
    .getByRole("button", {
      name: translate(language, "onboarding.restore.action"),
    })
    .click()
  await page.waitForURL(/\/restore-account\?/u)
  await page
    .getByText(translate(language, "accountRestore.relays.title"), {
      exact: true,
    })
    .waitFor()
}

/** Completes onboarding as a new account with a bank account, selling on the keypad unless told otherwise. */
export async function completeOnboarding(
  page: Page,
  language: Language,
  options?: {
    readonly baseURL?: string
    /** How the business sells, home's one mode; the keypad by default. */
    readonly sellingMode?: TerminalHomeMode
  }
): Promise<void> {
  await page.goto(`${options?.baseURL ?? ""}/onboarding`, {
    waitUntil: "domcontentloaded",
  })
  await page
    .getByRole("heading", { name: translate(language, "onboarding.title") })
    .waitFor()
  await page
    .getByRole("button", {
      name: translate(language, "accountChoice.new.title"),
    })
    .click()
  await page
    .getByRole("textbox", {
      name: translate(language, "onboarding.payments.iban.title"),
    })
    .fill("CZ6508000000192000145399")
  await page
    .getByRole("button", { name: translate(language, "onboarding.continue") })
    .click()
  await finishOnboardingSelling(
    page,
    language,
    options?.sellingMode ?? "numpad"
  )
}

/**
 * Completes onboarding for an account that is already selected and already
 * on the onboarding flow (for example right after creating a new device
 * account from Settings > Accounts), accepting every default. Unlike
 * completeOnboarding, this does not navigate to the onboarding page.
 *
 * Used instead of the window.__e2eSeedOnboarding bridge for a second device
 * account: switching accounts recreates the app's Evolu client, and the
 * bridge's effect doesn't reliably reattach to the new one in time.
 */
export async function completeOnboardingDefaults(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("heading", { name: translate(language, "onboarding.title") })
    .waitFor()
  await page
    .getByRole("button", {
      name: translate(language, "accountChoice.new.title"),
    })
    .click()
  await page
    .getByRole("textbox", {
      name: translate(language, "onboarding.payments.iban.title"),
    })
    .fill("CZ6508000000192000145399")
  await page
    .getByRole("button", { name: translate(language, "onboarding.continue") })
    .click()
  await finishOnboardingSelling(page, language, "numpad")
}

/**
 * Onboarding's last step (onboarding/0012): picks how the business sells,
 * which home then offers alone, and finishes, waiting for home.
 */
export async function finishOnboardingSelling(
  page: Page,
  language: Language,
  mode: TerminalHomeMode
): Promise<void> {
  await submitOnboardingSelling(page, language, mode)
  await page
    .getByRole("button", { name: translate(language, "nav.menu") })
    .waitFor()
}

/**
 * Picks how the business sells and presses finish, without waiting for
 * home: a business name that fails to publish keeps the last step open.
 */
export async function submitOnboardingSelling(
  page: Page,
  language: Language,
  mode: TerminalHomeMode
): Promise<void> {
  await page
    .getByRole("radio", {
      name: new RegExp(translate(language, sellingModeTitleKeys[mode])),
    })
    .click()
  await page
    .getByRole("button", { name: translate(language, "onboarding.finish") })
    .click()
}

/** From the business details to how the business sells (onboarding/0012). */
export async function continueToSelling(
  page: Page,
  language: Language
): Promise<void> {
  await page
    .getByRole("button", { name: translate(language, "onboarding.continue") })
    .click()
  await page
    .getByRole("heading", {
      name: translate(language, "onboarding.selling.title"),
    })
    .waitFor()
}

const sellingModeTitleKeys = {
  numpad: "onboarding.selling.numpad.title",
  pos: "onboarding.selling.pos.title",
} as const satisfies Record<TerminalHomeMode, TranslationKey>
