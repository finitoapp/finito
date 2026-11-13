import type { Language } from "@payky/app-shared/i18n/resources"
import type { TerminalShotName } from "@payky/doc-mockups/terminal-shots"
import { expect, type Page } from "@playwright/test"
import type { E2eSwitchioScenario } from "../../src/e2e/e2e-switchio-presets.ts"
import {
  alertDialog,
  backToMenu,
  chooseRefund,
  completeOnboarding,
  confirmRefund,
  enableCardPayments,
  generateDemoData,
  goBack,
  holdSwitchio,
  openHome,
  openNewestPayment,
  openPaymentDetail,
  openPaymentMethods,
  openRefund,
  openSettings,
  payByCard,
  refundConfirmButton,
  releaseSwitchio,
  returnToForeground,
  runClosure,
  scrollTo,
  setSwitchioScenario,
  startCardPayment,
  startClosure,
  tapPayByCard,
  translate,
  waitForPaid,
  waitForSwitchioLaunch,
} from "./finito-steps.ts"

/**
 * Takes the shot `name` of the screen as it is; `prepare` brings the screen
 * into place first.
 */
export type TerminalShoot = (
  name: TerminalShotName,
  prepare?: (page: Page) => Promise<void>
) => Promise<void>

/**
 * One fresh app on the card terminal's display, onboarded on the keypad,
 * with the fake SwitchioPay (src/e2e/e2e-switchio-presets.ts) answering
 * `switchio` from the first load and card payments turned on, then driven
 * through `capture`, which takes `shots`.
 */
export interface TerminalScenario {
  readonly name: string
  readonly shots: ReadonlyArray<TerminalShotName>
  /** The fake's scenario from the first load; "approved" by default. */
  readonly switchio?: E2eSwitchioScenario
  /** Leaves onboarding and the card's activation to `capture`. */
  readonly bare?: boolean
  readonly capture: (
    page: Page,
    language: Language,
    shoot: TerminalShoot
  ) => Promise<void>
}

/**
 * Comgate's simulator approves 1.01 and every amount it does not list
 * (landing.terminal.testing.*); a round café bill reads better.
 */
const amount = "249"

/** The tip preset the payments take, so a tip can be refunded on its own. */
const tipOf = (language: Language) =>
  translate(language, "settings.tips.percentages.value", { value: 10 })

/** Part of the payment, typed on the refund screen. */
const partialRefund = "100"

/** Onboarding on the keypad, then card payments on, ending on home. */
export async function prepareCardTerminal(
  page: Page,
  language: Language
): Promise<void> {
  await completeOnboarding(page, language)
  await openSettings(page, language)
  await openPaymentMethods(page, language)
  await enableCardPayments(page, language)
  await goBack(page, language)
  await openHome(page, language)
}

/**
 * A text of the screen, found by its copy; screens left mounted under the
 * current one keep theirs, hidden.
 */
const textOf = (page: Page, text: string) =>
  page.getByText(text).filter({ visible: true }).first()

/** The settle time of a dialog or a toast sliding in. */
const settle = (page: Page) => page.waitForTimeout(500)

/** Waits out the toast `key` a screen left behind, so it covers nothing. */
const toastGone = async (
  page: Page,
  language: Language,
  key: Parameters<typeof translate>[1]
) => {
  // A toast is the one alert that says so aloud (ui/toast.tsx).
  await expect(
    page
      .locator('[aria-live="assertive"]')
      .filter({ hasText: translate(language, key) })
  ).toHaveCount(0, { timeout: 15_000 })
}

export const terminalScenarios: ReadonlyArray<TerminalScenario> = [
  {
    name: "activation",
    shots: [
      "settings-payments",
      "payment-methods-off",
      "payment-methods-on",
      "card-settings",
    ],
    bare: true,
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      await openSettings(page, language)
      await shoot("settings-payments")
      await openPaymentMethods(page, language)
      await shoot("payment-methods-off")
      await enableCardPayments(page, language)
      await shoot("payment-methods-on")
      await page
        .getByRole("button", {
          name: translate(
            language,
            "settings.paymentAccounts.method.cardSwitchio"
          ),
          exact: true,
        })
        .click()
      await page
        .getByRole("button", {
          name: translate(language, "settings.cardSwitchioAccount.closureLink"),
        })
        .waitFor()
      await shoot("card-settings")
    },
  },
  {
    name: "payment",
    shots: [
      "pay-amount",
      "pay-tip",
      "pay-card-tab",
      "pay-waiting",
      "pay-received",
      "pay-detail",
    ],
    async capture(page, language, shoot) {
      await startCardPayment(page, language, {
        amount,
        tip: tipOf(language),
        onKeypad: () => shoot("pay-amount"),
        onTip: () => shoot("pay-tip"),
      })
      await shoot("pay-card-tab")
      await holdSwitchio(page)
      await tapPayByCard(page, language)
      await waitForSwitchioLaunch(page)
      await page
        .getByRole("button", {
          name: translate(language, "paymentWait.cardPaid.pending"),
        })
        .waitFor()
      await shoot("pay-waiting")
      await holdSwitchio(page, false)
      await waitForPaid(page, language)
      await settle(page)
      await shoot("pay-received")
      await openPaymentDetail(page, language)
      await shoot("pay-detail", () =>
        scrollTo(page, page.getByTestId("payment-detail-card"))
      )
    },
  },
  {
    name: "reversal",
    shots: [
      "refund-button",
      "refund-reversal",
      "refund-running",
      "refund-reversed-detail",
    ],
    async capture(page, language, shoot) {
      await payByCard(page, language, { amount, tip: tipOf(language) })
      await openPaymentDetail(page, language)
      const refund = page.getByRole("button", {
        name: translate(language, "paymentDetail.refunds.action"),
      })
      await shoot("refund-button", () => scrollTo(page, refund, "end"))
      await openRefund(page, language)
      await expect(
        textOf(page, translate(language, "refund.outcome.reversal"))
      ).toBeVisible()
      await shoot("refund-reversal")
      await holdSwitchio(page)
      await confirmRefund(page, language)
      await waitForSwitchioLaunch(page)
      await page.getByTestId("refund-card-progress").waitFor()
      await shoot("refund-running", () =>
        scrollTo(page, page.getByTestId("refund-card-progress"))
      )
      await holdSwitchio(page, false)
      await page.getByTestId("payment-detail-refund").first().click()
      await textOf(
        page,
        translate(language, "refundDetail.card.kind.reversal")
      ).waitFor()
      await toastGone(page, language, "refund.switchio.done")
      await shoot("refund-reversed-detail")
    },
  },
  {
    name: "refund",
    shots: [
      "refund-referral",
      "refund-partial",
      "refund-tip-only",
      "refund-referral-detail",
      "edge-refund-unknown",
    ],
    async capture(page, language, shoot) {
      await payByCard(page, language, { amount, tip: tipOf(language) })
      await page
        .getByRole("button", { name: translate(language, "paymentWait.back") })
        .click()
      await openSettings(page, language)
      await runClosure(page, language)
      await backToMenu(page, language)
      await openNewestPayment(page, language)
      await openRefund(page, language)
      await expect(
        textOf(page, translate(language, "refund.outcome.card"))
      ).toBeVisible()
      await shoot("refund-referral")

      await chooseRefund(page, language, "tip")
      await shoot("refund-tip-only")

      await chooseRefund(page, language, "part")
      const howMuch = page.getByRole("textbox", {
        name: translate(language, "refund.dialog.amount.label"),
      })
      await howMuch.fill(partialRefund)
      await expect(refundConfirmButton(page, language)).toBeEnabled()
      await howMuch.blur()
      await shoot("refund-partial", () =>
        scrollTo(page, refundConfirmButton(page, language), "end")
      )
      await confirmRefund(page, language)
      await page.getByTestId("payment-detail-refund").first().click()
      await textOf(
        page,
        translate(language, "refundDetail.card.kind.referralRefund")
      ).waitFor()
      await toastGone(page, language, "refund.switchio.done")
      await shoot("refund-referral-detail")

      // The tip next, whose result SwitchioPay does not report.
      await goBack(page, language)
      await openRefund(page, language)
      await chooseRefund(page, language, "tip")
      await setSwitchioScenario(page, "refund-unknown")
      await confirmRefund(page, language)
      const unknown = page.getByTestId("payment-detail-switchio-refund")
      await unknown
        .getByRole("button", {
          name: translate(language, "refund.switchio.check"),
        })
        .waitFor()
      await toastGone(page, language, "refund.switchio.unresolved")
      await shoot("edge-refund-unknown", () => scrollTo(page, unknown))
    },
  },
  {
    name: "reversal-declined",
    shots: ["reversal-declined"],
    async capture(page, language, shoot) {
      await payByCard(page, language, { amount, tip: tipOf(language) })
      await openPaymentDetail(page, language)
      await openRefund(page, language)
      // A closure SwitchioPay ran by itself: the terminal declines.
      await setSwitchioScenario(page, "reversal-declined")
      await confirmRefund(page, language)
      const offer = page.getByRole("button", {
        name: translate(language, "refund.switchio.reversalDeclined.confirm"),
      })
      await offer.waitFor()
      await shoot("reversal-declined", () => scrollTo(page, offer, "end"))
    },
  },
  {
    name: "closure",
    shots: [
      "closure-row",
      "closure-page",
      "closure-confirm",
      "closure-detail",
      "edge-closure-unknown",
    ],
    async capture(page, language, shoot) {
      // A closure before, so the screen has a last one to show.
      await payByCard(page, language, { amount: "120" })
      await page
        .getByRole("button", { name: translate(language, "paymentWait.back") })
        .click()
      await openSettings(page, language)
      await runClosure(page, language)
      await openHome(page, language)
      await payByCard(page, language, { amount, tip: tipOf(language) })
      await page
        .getByRole("button", { name: translate(language, "paymentWait.back") })
        .click()

      await openSettings(page, language)
      await shoot("closure-row")
      await runClosure(page, language, {
        onPage: () => shoot("closure-page"),
        onConfirm: async () => {
          await settle(page)
          await shoot("closure-confirm")
        },
      })
      await textOf(
        page,
        translate(language, "settings.cardClosure.result.batch")
      ).waitFor()
      await shoot("closure-detail")

      await goBack(page, language)
      await setSwitchioScenario(page, "closure-unknown")
      await startClosure(page, language)
      const dialog = alertDialog(
        page,
        translate(language, "settings.cardClosure.confirm.title")
      )
      await dialog
        .getByRole("button", {
          name: translate(language, "settings.cardClosure.action"),
        })
        .click()
      await textOf(
        page,
        translate(language, "settings.cardClosure.error.unknown")
      ).waitFor()
      await shoot("edge-closure-unknown")
    },
  },
  {
    name: "edges",
    shots: [
      "edge-declined",
      "edge-busy",
      "edge-unknown",
      "edge-charge-again",
      "edge-unknown-resolved",
    ],
    async capture(page, language, shoot) {
      await startCardPayment(page, language, { amount })
      const errorText = (key: Parameters<typeof translate>[1]) =>
        textOf(page, translate(language, key))

      await setSwitchioScenario(page, "declined")
      await tapPayByCard(page, language)
      await errorText("paymentWait.cardPaid.error.declined").waitFor()
      await shoot("edge-declined")

      await setSwitchioScenario(page, "launch-refused")
      await tapPayByCard(page, language)
      await errorText("paymentWait.cardPaid.error.busy").waitFor()
      await shoot("edge-busy")

      // Nothing charged, and SwitchioPay finds nothing when asked.
      await setSwitchioScenario(page, "unknown-then-not-found")
      await tapPayByCard(page, language)
      const ask = page.getByRole("button", {
        name: translate(language, "paymentWait.cardPaid.check"),
      })
      await ask.waitFor()
      await expect(ask).toBeEnabled()
      await expect(
        page.getByRole("button", {
          name: translate(language, "paymentWait.cardPaid.action"),
        })
      ).toBeEnabled()
      await shoot("edge-unknown")

      await tapPayByCard(page, language)
      const chargeAgain = alertDialog(
        page,
        translate(language, "paymentWait.cardPaid.retryUnresolved.title")
      )
      await chargeAgain.waitFor()
      await settle(page)
      await shoot("edge-charge-again")

      // This time the card was charged, and asking SwitchioPay finds it.
      await setSwitchioScenario(page, "unknown-then-approved")
      await chargeAgain
        .getByRole("button", {
          name: translate(
            language,
            "paymentWait.cardPaid.retryUnresolved.confirm"
          ),
        })
        .click()
      await waitForPaid(page, language)
      await settle(page)
      await shoot("edge-unknown-resolved")
    },
  },
  {
    name: "restored",
    shots: ["edge-restored"],
    async capture(page, language, shoot) {
      await startCardPayment(page, language, { amount })
      // The approval is stored, but the app that asked for it is gone.
      await setSwitchioScenario(page, "restored-approved")
      await holdSwitchio(page)
      await tapPayByCard(page, language)
      await waitForSwitchioLaunch(page)
      // Let the payment go; the lookup it starts finds the terminal busy.
      await releaseSwitchio(page)
      await waitForSwitchioLaunch(page)
      await setSwitchioScenario(page, "busy")
      await holdSwitchio(page, false)
      await page
        .getByRole("button", {
          name: translate(language, "paymentWait.cardPaid.check"),
        })
        .waitFor()
      await setSwitchioScenario(page, "approved")
      await returnToForeground(page)
      await textOf(
        page,
        translate(language, "paymentWait.cardPaid.restored.paid")
      ).waitFor()
      await settle(page)
      await shoot("edge-restored")
    },
  },
  {
    name: "canceled-but-paid",
    shots: ["edge-canceled-but-paid"],
    async capture(page, language, shoot) {
      await startCardPayment(page, language, { amount })
      // The card is charged while the payment is canceled meanwhile: the
      // approval waits in the store until the app is back.
      await setSwitchioScenario(page, "restored-approved")
      await holdSwitchio(page)
      await tapPayByCard(page, language)
      await waitForSwitchioLaunch(page)
      await releaseSwitchio(page)
      await waitForSwitchioLaunch(page)
      await setSwitchioScenario(page, "busy")
      await holdSwitchio(page, false)
      await page
        .getByRole("button", {
          name: translate(language, "paymentWait.cardPaid.check"),
        })
        .waitFor()

      await page
        .getByRole("button", {
          name: translate(language, "paymentWait.cancel"),
        })
        .click()
      // A canceled keypad payment goes home.
      await page
        .getByRole("button", {
          name: translate(language, "home.pay"),
          exact: true,
        })
        .waitFor()

      await setSwitchioScenario(page, "approved")
      await returnToForeground(page)
      await textOf(
        page,
        translate(language, "paymentWait.cardPaid.restored.paid")
      ).waitFor()
      await openNewestPayment(page, language)
      await textOf(
        page,
        translate(language, "paymentDetail.collision.title")
      ).waitFor()
      await shoot("edge-canceled-but-paid")
    },
  },
  {
    name: "not-installed",
    shots: ["edge-not-installed"],
    switchio: "not-installed",
    async capture(page, language, shoot) {
      // Settings › Payment methods says so too, but a narrow screen leaves
      // the row no room for it beside the default badge.
      await startCardPayment(page, language, { amount })
      await tapPayByCard(page, language)
      await textOf(
        page,
        translate(language, "paymentWait.cardPaid.error.unavailable")
      ).waitFor()
      await shoot("edge-not-installed")
    },
  },
  {
    name: "demo",
    shots: ["edge-demo"],
    bare: true,
    async capture(page, language, shoot) {
      await completeOnboarding(page, language)
      // The demo café takes card payments already.
      await generateDemoData(page, language, 1)
      await page.goto("/")
      await startCardPayment(page, language, { amount })
      await tapPayByCard(page, language)
      await textOf(
        page,
        translate(language, "paymentWait.cardPaid.error.demo")
      ).waitFor()
      await shoot("edge-demo")
    },
  },
]
