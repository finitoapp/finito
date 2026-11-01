import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
import type { AccessPreset } from "@payky/core/modules/access/access-types"
import type { Page } from "@playwright/test"
import { accessPresetLabelKeys } from "../../src/i18n/access-labels.ts"
import { translate } from "./i18n.ts"
import { gotoPage } from "./navigation.ts"

export const ownerPin = "4821"

/**
 * Turns access control on through Settings → Access and its wizard, with
 * `pin` as the owner PIN and `preset` for this device; any other device keeps
 * the wizard's Basic. `navigate: false` starts on the Access page
 * already open, so the PIN session the wizard starts survives (a `goto`
 * reloads the app and drops it).
 */
export async function turnOnAccessControl(
  page: Page,
  language: Language,
  {
    pin = ownerPin,
    preset = "basic",
    navigate = true,
  }: {
    readonly pin?: string
    readonly preset?: AccessPreset
    readonly navigate?: boolean
  } = {}
): Promise<void> {
  if (navigate) {
    await gotoPage(page, "/settings/access", language, "access.title")
  }
  await page
    .getByRole("button", { name: translate(language, "access.turnOn") })
    .click()
  await page.getByLabel(translate(language, "access.newPin.label")).fill(pin)
  await page.getByLabel(translate(language, "access.newPin.repeat")).fill(pin)
  await page
    .getByRole("button", { name: translate(language, "access.wizard.next") })
    .click()
  const devices = page.getByTestId("wizard-devices")
  await devices.getByRole("listitem").first().waitFor()
  if (preset !== "basic") {
    await devices
      .getByRole("listitem")
      .filter({ hasText: translate(language, "access.device.this") })
      .getByRole("combobox")
      .click()
    await page
      .getByRole("option", {
        name: translate(language, accessPresetLabelKeys[preset]),
        exact: true,
      })
      .click()
  }
  await page
    .getByRole("button", { name: translate(language, "access.turnOn") })
    .click()
  await page.getByText(translate(language, "access.status.on")).waitFor()
}

/** Types `pin` on the PIN pad on screen, a dialog's or a page's, and submits. */
export async function typePin(
  page: Page,
  language: Language,
  pin: string
): Promise<void> {
  const pad = page.locator("[data-pin-pad]")
  for (const digit of pin) {
    await pad.getByRole("button", { name: digit, exact: true }).click()
  }
  await pad
    .getByRole("button", { name: translate(language, "access.pin.submit") })
    .click()
}

/** Reads the account's recovery phrase from Settings → Security. */
export async function readRecoveryPhrase(
  page: Page,
  language: Language
): Promise<string> {
  await openRecoveryWords(page, language)
  return (await readShownRecoveryWords(page, language)).join(" ")
}

/** Opens the backup screen and steps to the words (account/0007). */
export async function openRecoveryWords(
  page: Page,
  language: Language
): Promise<void> {
  await gotoPage(
    page,
    "/settings/security/backup",
    language,
    "settings.security.mnemonic.title"
  )
  await page
    .getByRole("button", {
      name: translate(language, "settings.security.backup.start"),
    })
    .click()
}

/** The phrase's 20 words in order, read from the grid of the backup screen's words step. */
export async function readShownRecoveryWords(
  page: Page,
  language: Language
): Promise<ReadonlyArray<string>> {
  return page
    .getByRole("group", {
      name: translate(language, "settings.security.mnemonic.label"),
    })
    .locator("input")
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value)
    )
}

/** The one-shot PIN prompt raised for `actionKey` (an `access.action.*` key). */
export const pinPrompt = (
  page: Page,
  language: Language,
  actionKey: TranslationKey
) => page.getByRole("dialog", { name: translate(language, actionKey) })

/** Opens a Settings list entry in the app, without reloading it. */
export async function openSettingsEntry(
  page: Page,
  language: Language,
  titleKey: TranslationKey
): Promise<void> {
  await page
    .getByRole("link", {
      name: new RegExp(`^${translate(language, titleKey)}`, "u"),
    })
    .click()
}
