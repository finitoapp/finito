import type { en } from "@payky/app-shared/i18n/en"

/**
 * The app's own labels and messages the card terminal page quotes
 * (landing/0015): its buttons, screens and the messages a step or an edge
 * case shows. Taken from the app's copy, as the privacy policy is
 * (landing/0014), so the page reads exactly what the screenshot beside it
 * shows, and follows when the app's wording changes.
 */
const terminalAppLabelKeys = [
  "nav.settings",
  "nav.activity",
  "home.pay",
  "access.permission.admin",
  "access.permission.refund",
  "access.permission.confirm",
  "settings.paymentAccounts.title",
  "settings.paymentAccounts.method.cardSwitchio",
  "settings.paymentAccounts.default",
  "settings.cardSwitchioAccount.closureLink",
  "settings.cardClosure.title",
  "settings.cardClosure.action",
  "settings.cardClosure.result.title",
  "settings.cardClosure.error.unknown",
  "paymentTip.title",
  "paymentWait.method.card",
  "paymentWait.cardPaid.action",
  "paymentWait.cardPaid.pending",
  "paymentWait.paid",
  "paymentWait.detail",
  "paymentWait.cardPaid.error.declined",
  "paymentWait.cardPaid.error.unavailable",
  "paymentWait.cardPaid.error.demo",
  "paymentWait.cardPaid.restored.paid",
  "paymentWait.cardPaid.retryUnresolved.title",
  "paymentDetail.refunds.action",
  "paymentDetail.collision.title",
  "refund.page.choice.whole",
  "refund.page.choice.part",
  "refund.page.choice.tip",
  "refund.dialog.method.cardSwitchio",
  "refund.switchio.pending",
  "refund.switchio.unresolved",
  "refund.switchio.pendingElsewhere",
  "refund.switchio.reversalDeclined.title",
  "refund.switchio.reversalDeclined.confirm",
  "refundDetail.card.kind.reversal",
  "refundDetail.card.kind.referralRefund",
] as const satisfies ReadonlyArray<keyof typeof en>

type TerminalAppLabelKey = (typeof terminalAppLabelKeys)[number]

/** The quoted labels out of one language's app copy. */
export const pickTerminalAppLabels = (
  labels: Readonly<Record<TerminalAppLabelKey, string>>
): Readonly<Record<TerminalAppLabelKey, string>> =>
  Object.fromEntries(
    terminalAppLabelKeys.map((key) => [key, labels[key]])
  ) as Record<TerminalAppLabelKey, string>
