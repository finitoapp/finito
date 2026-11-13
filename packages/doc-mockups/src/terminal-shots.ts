/**
 * The screenshots of Finito's card terminal documentation (landing/0015),
 * apart from the marketing mockups' `ShotName`: the native app's screens on a
 * NEXGO N92 payment terminal next to SwitchioPay, captured at the terminal's
 * 720×1600 in the dark theme into
 * `apps/native-app/docs/terminal/<language>/<name>.webp` for en, cs and sk.
 * The landing's terminal page names its steps by these, and
 * `landing-terminal-shots.test.ts` fails when one is missing or unused.
 */
export const terminalShotNames = [
  // Turning card payments on.
  "settings-payments",
  "payment-methods-off",
  "payment-methods-on",
  "card-settings",
  // A payment.
  "pay-amount",
  "pay-tip",
  "pay-card-tab",
  "pay-waiting",
  "pay-received",
  "pay-detail",
  // A reversal before the closure and a refund to the card after it.
  "refund-button",
  "refund-reversal",
  "refund-running",
  "refund-reversed-detail",
  "refund-referral",
  "refund-partial",
  "refund-tip-only",
  "refund-referral-detail",
  "reversal-declined",
  // The closure.
  "closure-row",
  "closure-page",
  "closure-confirm",
  "closure-detail",
  // Edge cases.
  "edge-declined",
  "edge-unknown",
  "edge-unknown-resolved",
  "edge-charge-again",
  "edge-busy",
  "edge-not-installed",
  "edge-restored",
  "edge-canceled-but-paid",
  "edge-refund-unknown",
  "edge-closure-unknown",
  "edge-demo",
] as const

export type TerminalShotName = (typeof terminalShotNames)[number]

/** The size every terminal screenshot is captured at, in pixels. */
export const terminalShotWidth = 720
export const terminalShotHeight = 1600
