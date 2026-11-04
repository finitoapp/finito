import { formatMintLabel } from "@payky/app-shared/cashu-withdraw-flow"
import type { CashuWithdrawalQuote } from "@payky/core/modules/withdraw/withdraw-cashu-actions"
import { Text, YStack } from "tamagui"
import { DetailRow } from "../../components/detail-row.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { BitcoinAmount } from "../shared/bitcoin-amount.tsx"
import { Collapsible, LightningAddress, Mono } from "./withdraw-parts.tsx"
import {
  EXPIRY_WARNING_MS,
  ExpiryRow,
  useMsLeft,
  WithdrawReviewCard,
} from "./withdraw-review-step.tsx"

/** A Cashu melt review: mint fees, remainder, expiry and confirm controls. */
export function CashuWithdrawReviewStep({
  quote,
  comment,
  confirming,
  requoting,
  confirmError,
  uncertain,
  onBack,
  onConfirm,
  onNewQuote,
  onOpenHistory,
}: {
  readonly quote: CashuWithdrawalQuote
  /** The merchant's own note, saved with the withdrawal. */
  readonly comment: string | null
  readonly confirming: boolean
  readonly requoting: boolean
  readonly confirmError: string | null
  /** A melt may or may not have been sent: nothing may be confirmed again from here. */
  readonly uncertain: boolean
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly onNewQuote: () => void
  readonly onOpenHistory: () => void
}) {
  const { t } = useTranslation()
  const msLeft = useMsLeft(quote.expiresAt)
  const expired = msLeft <= 0
  const error =
    confirmError ??
    (expired ? t("withdraw.error.lightningInvoiceExpired") : null)

  return (
    <WithdrawReviewCard
      recipientComment={quote.recipientComment}
      comment={comment}
      error={error}
      nearlyExpired={msLeft <= EXPIRY_WARNING_MS}
      expired={expired}
      confirming={confirming}
      requoting={requoting}
      uncertain={uncertain}
      onBack={onBack}
      onConfirm={onConfirm}
      onNewQuote={onNewQuote}
      onOpenHistory={onOpenHistory}
    >
      <YStack gap="3">
        <DetailRow label={t("withdraw.detail.mint")} stacked>
          <Text>{formatMintLabel(quote.mint)}</Text>
        </DetailRow>
        <DetailRow label={t("withdraw.review.destination")} stacked>
          {quote.lightningAddress !== null ? (
            <LightningAddress address={quote.lightningAddress} />
          ) : (
            <Text>{t("withdraw.destination.kind.lightningInvoice")}</Text>
          )}
        </DetailRow>
        {quote.recipientText === null ? null : (
          <DetailRow label={t("withdraw.review.recipientText")} stacked>
            <Text>{quote.recipientText}</Text>
          </DetailRow>
        )}
        <DetailRow label={t("withdraw.review.amount")}>
          <BitcoinAmount sats={quote.amountSats} />
        </DetailRow>
        <DetailRow label={t("withdraw.cashu.review.feeReserve")}>
          <BitcoinAmount sats={quote.cost.feeReserve} />
        </DetailRow>
        {quote.cost.inputFee > 0 ? (
          <DetailRow label={t("withdraw.cashu.review.inputFee")}>
            <BitcoinAmount sats={quote.cost.inputFee} />
          </DetailRow>
        ) : null}
        <DetailRow label={t("withdraw.review.maxTotal")} emphasize>
          <BitcoinAmount sats={quote.cost.maxTotal} />
        </DetailRow>
        <ExpiryRow msLeft={msLeft} />
        <Text color="muted-foreground">
          {t("withdraw.cashu.review.remainder")}
        </Text>
        <Collapsible label={t("withdraw.review.showInvoice")}>
          <Mono value={quote.invoice} />
        </Collapsible>
      </YStack>
    </WithdrawReviewCard>
  )
}
