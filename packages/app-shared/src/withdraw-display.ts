import { hexToNpub } from "@payky/core/integrations/nostr/npub"
import type {
  WithdrawalTarget,
  WithdrawalView,
} from "@payky/core/modules/withdraw/withdraw-queries"
import { shortenMiddle } from "@payky/core/utils/shorten-middle"
import type { TranslationKey } from "./i18n/resources.ts"
import type { WithdrawMethod } from "./withdraw-flow.ts"

/** The wallet a withdrawal left. */
export const withdrawalMethod = (target: WithdrawalTarget): WithdrawMethod =>
  target.kind === "cashu" || target.kind === "cashuSend" ? "cashu" : "spark"

export const withdrawalKindKeys = {
  onchain: "withdraw.kind.onchain",
  lightning: "withdraw.kind.lightning",
  cashu: "withdraw.kind.cashu",
  cashuSend: "withdraw.kind.cashuSend",
} satisfies Record<WithdrawalTarget["kind"], TranslationKey>

/** A Linky recipient as named: the address, else the npub. */
export const cashuSendRecipientText = (
  target: Extract<WithdrawalTarget, { kind: "cashuSend" }>
): string => target.recipientAddress ?? hexToNpub(target.recipientPubkey)

/** A done on-chain withdrawal has only left the wallet; the chain may still be confirming it. */
export const withdrawalStatusKey = (view: WithdrawalView): TranslationKey => {
  if (view.state.status === "done") {
    return view.target.kind === "onchain"
      ? "withdraw.status.sent"
      : "withdraw.status.done"
  }
  return view.state.status === "failed"
    ? "withdraw.status.failed"
    : "withdraw.status.pending"
}

/** The destination as a person would retype it, for "New withdrawal". */
export const withdrawalDestination = (target: WithdrawalTarget): string =>
  target.kind === "onchain"
    ? target.onchainAddress
    : target.kind === "cashuSend"
      ? cashuSendRecipientText(target)
      : (target.lightningAddress ?? target.lnInvoice)

export const shortWithdrawalDestination = (target: WithdrawalTarget): string =>
  (target.kind === "lightning" || target.kind === "cashu") &&
  target.lightningAddress !== null
    ? target.lightningAddress
    : target.kind === "cashuSend" && target.recipientAddress !== null
      ? target.recipientAddress
      : shortenMiddle(withdrawalDestination(target), 10, 6)

/**
 * What "New withdrawal" prefills: an address can take another payment, but a
 * Lightning invoice is single-use and has most likely expired by now.
 */
export const reusableWithdrawalDestination = (
  target: WithdrawalTarget
): string | null =>
  target.kind === "onchain"
    ? target.onchainAddress
    : target.kind === "cashuSend"
      ? cashuSendRecipientText(target)
      : target.lightningAddress

type FailureReason = Extract<
  WithdrawalView["state"],
  { status: "failed" }
>["reason"]

export const withdrawalFailureKeys = {
  manual: "withdraw.detail.failed.manual",
  rejected: "withdraw.detail.failed.rejected",
  returned: "withdraw.detail.failed.returned",
  "not-created": "withdraw.detail.failed.notCreated",
} satisfies Record<FailureReason, TranslationKey>
