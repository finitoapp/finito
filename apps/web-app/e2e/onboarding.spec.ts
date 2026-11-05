import { expect, test } from "@playwright/test"
import { verifyEvent } from "nostr-tools/pure"
import { openRecoveryWords, readShownRecoveryWords } from "./support/access.ts"
import { translate } from "./support/i18n.ts"
import { fillInlineField } from "./support/inline-edit.ts"
import { gotoPage, reloadPage } from "./support/navigation.ts"
import { mockNostrProfileRelays } from "./support/nostr-profile.ts"
import {
  completeOnboarding,
  createUnregisteredMnemonic,
  fillRestorePhrase,
  submitRestorePhrase,
} from "./support/onboarding.ts"

test("complete onboarding as a new account, without backing up the recovery phrase", async ({
  page,
}) => {
  await test.step("complete onboarding", () => completeOnboarding(page, "en"))

  await test.step("land on the terminal home screen", async () => {
    await expect(page).toHaveURL("/")
    await expect(
      page.getByRole("button", { name: translate("en", "home.pay") })
    ).toBeVisible()
  })

  await test.step("security settings still hand out the recovery phrase", async () => {
    await openRecoveryWords(page, "en")
    const mnemonic = (await readShownRecoveryWords(page, "en")).join(" ")
    expect(mnemonic.trim().split(/\s+/u).length).toBeGreaterThanOrEqual(12)
  })
})

test("onboarding in English still starts a Czech account in CZK", async ({
  page,
}) => {
  await test.step("complete onboarding in English", () =>
    completeOnboarding(page, "en"))

  await test.step("the business is in the Czech Republic and uses CZK", async () => {
    await gotoPage(
      page,
      "/settings/legal-entity",
      "en",
      "settings.legalEntity.title"
    )
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "settings.legalEntity.country.label"),
      })
    ).toContainText(translate("en", "country.cz"))
    await expect(
      page.getByRole("combobox", {
        name: translate("en", "settings.legalEntity.currency.label"),
      })
    ).toContainText(translate("en", "settings.fiat.czk.title"))
  })

  await test.step("the Czech preset tax rates were seeded", async () => {
    await gotoPage(page, "/settings/tax-rates", "en", "settings.taxRates.title")
    await expect(page.getByText("Základní sazba")).toBeVisible()
    await expect(page.getByText("Snížená sazba")).toBeVisible()
    await expect(page.getByText("Osvobozeno od DPH")).toBeVisible()
    await expect(page.getByText("21%")).toBeVisible()
    await expect(page.getByText("12%")).toBeVisible()
    await expect(page.getByText("0%")).toBeVisible()
  })
})

test("the payment methods step derives bank transfers from the account input", async ({
  page,
}) => {
  const finishButton = page.getByRole("button", {
    name: translate("en", "onboarding.finish"),
  })
  const ibanInput = page.getByRole("textbox", {
    name: translate("en", "onboarding.payments.iban.title"),
  })

  await test.step("walk onboarding up to the payment methods step", async () => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
    const heading = page.getByRole("heading", {
      name: translate("en", "onboarding.title"),
    })
    await heading.waitFor()
    const languagePicker = page.getByRole("combobox", {
      name: translate("en", "onboarding.language.title"),
    })
    const headingTop = await heading.evaluate(
      (element) => element.getBoundingClientRect().top
    )
    const languageTop = await languagePicker.evaluate(
      (element) => element.getBoundingClientRect().top
    )
    await page
      .getByRole("button", {
        name: translate("en", "accountChoice.new.title"),
      })
      .click()
    const paymentsHeading = page.getByRole("heading", {
      name: translate("en", "onboarding.payments.title"),
    })
    await expect(paymentsHeading).toBeVisible()
    expect(
      await paymentsHeading.evaluate(
        (element) => element.getBoundingClientRect().top
      )
    ).toBe(headingTop)
    expect(
      await languagePicker.evaluate(
        (element) => element.getBoundingClientRect().top
      )
    ).toBe(languageTop)
  })

  await test.step("an empty or whitespace-only account offers to start without bank transfers", async () => {
    await expect(page.getByRole("switch")).toHaveCount(0)
    const skipButton = page.getByRole("button", {
      name: translate("en", "onboarding.finishWithoutBankTransfer"),
    })
    await expect(skipButton).toBeEnabled()
    await expect(ibanInput).toBeVisible()
    await expect(ibanInput).toHaveAttribute("aria-invalid", "false")
    await ibanInput.fill("   ")
    await expect(skipButton).toBeEnabled()
    await expect(finishButton).toHaveCount(0)
  })

  await test.step("entering an account changes the button and going back keeps the draft", async () => {
    await ibanInput.fill("CZ6508000000192000145399")
    await expect(ibanInput).toHaveValue("CZ6508000000192000145399")
    await expect(finishButton).toBeEnabled()
    await expect(
      page.getByRole("button", {
        name: translate("en", "settings.fiatBankAccount.iban.format.iban"),
        exact: true,
      })
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: translate("en", "onboarding.back") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "accountChoice.new.title") })
      .click()
    await expect(ibanInput).toHaveValue("CZ6508000000192000145399")
    await expect(finishButton).toBeEnabled()
  })

  await test.step("an invalid IBAN swaps the message and still holds the step", async () => {
    await ibanInput.fill("12345")
    await finishButton.click()
    await expect(
      page.getByText(translate("en", "settings.fiatBankAccount.iban.invalid"))
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: translate("en", "onboarding.payments.title"),
        exact: true,
      })
    ).toBeVisible()
  })

  await test.step("fixing the IBAN lets onboarding complete", async () => {
    await ibanInput.fill("19-2000145399/0800")
    await finishButton.click()
    await page
      .getByRole("button", { name: translate("en", "nav.menu") })
      .waitFor()
  })
  await test.step("the entered account enables bank transfers", async () => {
    await gotoPage(
      page,
      "/settings/payment-accounts",
      "en",
      "settings.paymentAccounts.title"
    )
    await expect(
      page.getByRole("switch", {
        name: translate("en", "settings.fiatBankAccount.enabled.label"),
      })
    ).toBeChecked()
  })
})

test("bank account format switching is only offered for a saved Czech account", async ({
  page,
}) => {
  const ibanInput = page.getByRole("textbox", {
    name: translate("en", "settings.fiatBankAccount.iban.label"),
  })
  const ibanFormat = page.getByRole("button", {
    name: translate("en", "settings.fiatBankAccount.iban.format.iban"),
    exact: true,
  })
  const accountNumberFormat = page.getByRole("button", {
    name: translate("en", "settings.fiatBankAccount.iban.format.bban"),
    exact: true,
  })

  await test.step("finish onboarding without a bank account", async () => {
    await gotoPage(page, "/onboarding", "en", "onboarding.title")
    await page
      .getByRole("button", { name: translate("en", "accountChoice.new.title") })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "onboarding.finishWithoutBankTransfer"),
      })
      .click()
    await expect(page).toHaveURL("/")
    await gotoPage(
      page,
      "/settings/payment-accounts/iban",
      "en",
      "settings.paymentAccounts.method.iban"
    )
  })

  await test.step("a new account accepts either format without changing the draft or showing a switch", async () => {
    await expect(ibanInput).toHaveValue("")
    await expect(ibanFormat).toHaveCount(0)
    await expect(accountNumberFormat).toHaveCount(0)
    await ibanInput.fill("CZ6508000000192000145399")
    await expect(ibanInput).toHaveValue("CZ6508000000192000145399")
    await expect(ibanFormat).toHaveCount(0)
    await ibanInput.press("Escape")
    await expect(ibanInput).toHaveValue("")
    await ibanInput.fill("19-2000145399/0800")
    await expect(ibanInput).toHaveValue("19-2000145399/0800")
    await expect(ibanFormat).toHaveCount(0)
    await ibanInput.press("Escape")
    await fillInlineField(page, ibanInput, "19-2000145399/0800")
  })

  await test.step("the saved Czech account shows its format switch only outside an edit", async () => {
    await expect(ibanFormat).toBeVisible()
    await expect(accountNumberFormat).toBeVisible()
    await ibanFormat.click()
    await expect(ibanInput).toHaveValue("CZ6508000000192000145399")
    await accountNumberFormat.click()
    await expect(ibanInput).toHaveValue("19-2000145399/0800")
    await ibanInput.focus()
    await expect(ibanFormat).toBeVisible()
    const inputTop = await ibanInput.evaluate(
      (element) => element.getBoundingClientRect().top
    )
    await ibanInput.fill("")
    await expect(ibanFormat).not.toBeVisible()
    await expect(accountNumberFormat).not.toBeVisible()
    expect(
      await ibanInput.evaluate((element) => element.getBoundingClientRect().top)
    ).toBe(inputTop)
    await ibanInput.press("Escape")
    await expect(ibanInput).toHaveValue("19-2000145399/0800")
    await expect(ibanFormat).toBeVisible()
    await expect(accountNumberFormat).toBeVisible()
  })

  await test.step("a saved foreign IBAN has no Czech account-number switch", async () => {
    await fillInlineField(page, ibanInput, "DE89370400440532013000")
    await expect(ibanFormat).toHaveCount(0)
    await expect(accountNumberFormat).toHaveCount(0)
    await expect(ibanInput).toHaveValue("DE89370400440532013000")
    await reloadPage(page, "en", "settings.paymentAccounts.method.iban")
    await expect(ibanInput).toHaveValue("DE89370400440532013000")
    await expect(ibanFormat).toHaveCount(0)
    await expect(accountNumberFormat).toHaveCount(0)
  })
})

// Offline is the one sync failure e2e can produce deterministically, and it
// wins over whatever the relays reported. It is switched on only once the
// restore page has loaded: offline also blocks the dev server's lazy chunks.
test("an offline restore fails, and another phrase returns to the restore step", async ({
  page,
  context,
}) => {
  await test.step("submit a recovery phrase and go offline", async () => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
    await page
      .getByRole("heading", { name: translate("en", "onboarding.title") })
      .waitFor()
    await submitRestorePhrase(page, "en", await createUnregisteredMnemonic())
    await context.setOffline(true)
  })

  await test.step("the sync fails with the offline explanation", async () => {
    await expect(
      page.getByRole("heading", {
        name: translate("en", "accountRestore.failed.title"),
      })
    ).toBeVisible()
    await expect(
      page.getByText(translate("en", "accountRestore.failed.offline"))
    ).toBeVisible()
  })

  await test.step("use a different phrase", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "accountRestore.action.otherPhrase"),
      })
      .click()
    await expect(page).toHaveURL(/\/onboarding$/u)
    await expect(
      page.getByRole("button", {
        name: translate("en", "onboarding.restore.action"),
      })
    ).toBeVisible()
    await expect(
      page.getByRole("textbox", {
        name: translate("en", "onboarding.restore.wordLabel").replace(
          "{index}",
          "1"
        ),
        exact: true,
      })
    ).toHaveValue("")
  })
})

test("the restore button stays off until all 20 words are known, and a foreign seed is named", async ({
  page,
}) => {
  const restoreButton = page.getByRole("button", {
    name: translate("en", "onboarding.restore.action"),
  })

  await test.step("open the restore step", async () => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
    await page
      .getByRole("heading", { name: translate("en", "onboarding.title") })
      .waitFor()
    await page
      .getByRole("button", {
        name: translate("en", "accountChoice.restore.title"),
      })
      .click()
    await expect(restoreButton).toBeDisabled()
  })

  await test.step("a partial phrase keeps it off and shows the count", async () => {
    await fillRestorePhrase(page, "en", "academic acid acne")
    await expect(restoreButton).toBeDisabled()
    await expect(page.getByText("3/20 words")).toBeVisible()
  })

  await test.step("an unknown word is named", async () => {
    await fillRestorePhrase(page, "en", "academic zzzz")
    await expect(page.getByText("Unknown word: zzzz")).toBeVisible()
  })

  await test.step("a 12-word seed from another wallet is explained", async () => {
    await fillRestorePhrase(
      page,
      "en",
      Array.from({ length: 12 }, () => "abandon").join(" ")
    )
    await expect(
      page.getByText(
        translate("en", "settings.accounts.restore.mnemonic.foreign")
      )
    ).toBeVisible()
    await expect(restoreButton).toBeDisabled()
  })

  await test.step("a valid phrase turns the button on", async () => {
    await fillRestorePhrase(page, "en", await createUnregisteredMnemonic())
    await expect(restoreButton).toBeEnabled()
  })
})

test("setting up a phrase whose sync failed warns, then goes straight to payments", async ({
  page,
  context,
}) => {
  await test.step("fail an offline restore", async () => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" })
    await page
      .getByRole("heading", { name: translate("en", "onboarding.title") })
      .waitFor()
    await submitRestorePhrase(page, "en", await createUnregisteredMnemonic())
    await context.setOffline(true)
    await page
      .getByRole("heading", {
        name: translate("en", "accountRestore.failed.title"),
      })
      .waitFor()
  })

  await test.step("confirm the overwrite warning", async () => {
    await page
      .getByRole("button", {
        name: translate("en", "accountRestore.action.setupNew"),
      })
      .click()
    await page
      .getByRole("button", {
        name: translate("en", "accountRestore.setupNew.confirm.confirm"),
        exact: true,
      })
      .click()
    await context.setOffline(false)
  })

  await test.step("finish on the payments step", async () => {
    await page
      .getByRole("textbox", {
        name: translate("en", "onboarding.payments.iban.title"),
      })
      .fill("CZ6508000000192000145399")
    await page
      .getByRole("button", { name: translate("en", "onboarding.finish") })
      .click()
    await page
      .getByRole("button", { name: translate("en", "nav.menu") })
      .waitFor()
  })

  await test.step("the empty account from the first start is gone", async () => {
    await gotoPage(page, "/settings/accounts", "en", "settings.accounts.title")
    await expect(
      page.getByTestId("account-list").getByRole("listitem")
    ).toHaveCount(1)
  })
})

for (const outcome of ["success", "retry", "skip", "empty"] as const) {
  test(`business name publication during onboarding: ${outcome}`, async ({
    page,
  }) => {
    let accepts = outcome === "success" || outcome === "empty"
    const relay = await mockNostrProfileRelays(page, () => accepts)
    const nameInput = page.getByRole("textbox", {
      name: translate("en", "onboarding.businessName.label"),
    })
    await test.step("enter the business setup form", async () => {
      await gotoPage(page, "/onboarding", "en", "onboarding.title")
      await page
        .getByRole("button", {
          name: translate("en", "accountChoice.new.title"),
        })
        .click()
      await expect(
        page.getByRole("heading", {
          name: translate("en", "onboarding.payments.title"),
          exact: true,
        })
      ).toBeVisible()
      await nameInput.fill(outcome === "empty" ? "   " : " Café Example ")
      await expect(nameInput).toHaveValue(
        outcome === "empty" ? "   " : " Café Example "
      )
      expect(relay.attempts).toHaveLength(0)
    })
    await test.step("submit and handle a publication failure explicitly", async () => {
      await page
        .getByRole("button", {
          name: translate("en", "onboarding.finishWithoutBankTransfer"),
        })
        .click()
      if (outcome === "retry" || outcome === "skip") {
        await expect(
          page.getByText(
            translate("en", "onboarding.businessName.publishFailed.title"),
            { exact: true }
          )
        ).toBeVisible()
        await expect(page).toHaveURL("/onboarding")
        await expect(nameInput).toHaveValue(" Café Example ")
        if (outcome === "retry") {
          // A kind-0 event includes a second-resolution timestamp; advance
          // past the previous attempt so nostr-tools sends a fresh event.
          await page.clock.install()
          await page.clock.setFixedTime(new Date(Date.now() + 2000))
          accepts = true
          await page
            .getByRole("button", {
              name: translate("en", "onboarding.businessName.retry"),
            })
            .click()
        } else {
          await page
            .getByRole("button", {
              name: translate(
                "en",
                "onboarding.businessName.continueWithoutPublishing"
              ),
            })
            .click()
        }
      }
      await expect(page).toHaveURL("/")
    })
    await test.step("the result matches the explicit choice", async () => {
      if (outcome === "empty") {
        expect(relay.attempts).toHaveLength(0)
      } else if (outcome === "skip") {
        expect(relay.attempts).toHaveLength(1)
      } else {
        expect(relay.attempts.length).toBeGreaterThan(0)
        const published = relay.attempts.at(-1)
        expect(published && verifyEvent(published)).toBe(true)
        expect(JSON.parse(published?.content ?? "null")).toEqual({
          name: "Café Example",
          display_name: "Café Example",
        })
        await gotoPage(
          page,
          "/settings/profile",
          "en",
          "settings.profile.title"
        )
        await expect(
          page.getByRole("textbox", {
            name: translate("en", "settings.profile.name.label"),
            exact: true,
          })
        ).toHaveValue("Café Example")
      }
    })
  })
}

for (const bankTransferEnabled of [false, true]) {
  test(`onboarding enables cash and Spark ${bankTransferEnabled ? "with" : "without"} bank transfers`, async ({
    page,
  }) => {
    await test.step("finish business setup without payment-method switches", async () => {
      await gotoPage(page, "/onboarding", "en", "onboarding.title")
      await page
        .getByRole("button", {
          name: translate("en", "accountChoice.new.title"),
        })
        .click()
      await expect(page.getByRole("switch")).toHaveCount(0)
      await page
        .getByRole("textbox", {
          name: translate("en", "onboarding.payments.iban.title"),
        })
        .fill(bankTransferEnabled ? "19-2000145399/0800" : "   ")
      await page
        .getByRole("button", {
          name: translate(
            "en",
            bankTransferEnabled
              ? "onboarding.finish"
              : "onboarding.finishWithoutBankTransfer"
          ),
        })
        .click()
      await expect(page).toHaveURL("/")
    })

    await test.step("verify enabled methods and Cashu's position", async () => {
      await gotoPage(
        page,
        "/settings/payment-accounts",
        "en",
        "settings.paymentAccounts.title"
      )
      for (const [key, enabled] of [
        ["settings.cashRegisterAccount.enabled.label", true],
        ["settings.sparkAccount.enabled.label", true],
        ["settings.fiatBankAccount.enabled.label", bankTransferEnabled],
        ["settings.cashuAccount.enabled.label", false],
      ] as const) {
        await expect(
          page.getByRole("switch", { name: translate("en", key) })
        ).toBeChecked({ checked: enabled })
      }
      const order = [
        "iban",
        "cardSwitchio",
        "qerkoTerminal",
        "qerkoPayment",
        "spark",
        "cashu",
        "lightningAddress",
        "cashRegister",
      ] as const
      const defaultMethodRow = page.getByRole("listitem").filter({
        has: page.getByRole("switch", {
          name: translate(
            "en",
            bankTransferEnabled
              ? "settings.fiatBankAccount.enabled.label"
              : "settings.sparkAccount.enabled.label"
          ),
        }),
      })
      await expect(defaultMethodRow).toContainText(
        translate("en", "settings.paymentAccounts.default")
      )
      await expect(page.getByRole("listitem")).toContainText(
        order.map((method) =>
          translate("en", `settings.paymentAccounts.method.${method}`)
        )
      )
      await reloadPage(page, "en", "settings.paymentAccounts.title")
      await expect(page.getByRole("listitem")).toContainText(
        order.map((method) =>
          translate("en", `settings.paymentAccounts.method.${method}`)
        )
      )
    })
  })
}
