import { formatMintLabel } from "@payky/app-shared/cashu-withdraw-flow"
import type { CashuSendQuote } from "@payky/core/modules/withdraw/withdraw-cashu-send-actions"
import { Text, YStack } from "tamagui"
import { DetailRow } from "../../components/detail-row.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { Mono, SatsWithFiat } from "./withdraw-parts.tsx"
import { WithdrawReviewCard } from "./withdraw-review-step.tsx"

/**
 * The review of ecash to a Linky contact (withdraw/0015): who gets it, from
 * which mint, the amount, the most the swap's fee can take and the total,
 * then the same confirm controls as a melt's. Nothing here expires: a new
 * quote only reads the balance again.
 */
export function CashuSendReviewStep({
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
  readonly quote: CashuSendQuote
  /** The merchant's own note, saved with the withdrawal. */
  readonly comment: string | null
  readonly confirming: boolean
  readonly requoting: boolean
  readonly confirmError: string | null
  readonly uncertain: boolean
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly onNewQuote: () => void
  readonly onOpenHistory: () => void
}) {
  const { t } = useTranslation()
  const { recipient } = quote

  return (
    <WithdrawReviewCard
      recipientComment={null}
      comment={comment}
      error={confirmError}
      nearlyExpired={false}
      expired={false}
      confirming={confirming}
      requoting={requoting}
      uncertain={uncertain}
      onBack={onBack}
      onConfirm={onConfirm}
      onNewQuote={onNewQuote}
      onOpenHistory={onOpenHistory}
    >
      <YStack gap="3">
        <DetailRow label={t("withdraw.review.destination")} stacked>
          {recipient.address === null ? (
            <Mono value={recipient.npub} />
          ) : (
            <YStack gap="1">
              <Text>{recipient.address}</Text>
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {t("withdraw.destination.kind.linkyContact")}
              </Text>
            </YStack>
          )}
        </DetailRow>
        <DetailRow label={t("withdraw.detail.mint")} stacked>
          <Text>{formatMintLabel(quote.mint)}</Text>
        </DetailRow>
        <DetailRow label={t("withdraw.review.amount")}>
          <SatsWithFiat sats={quote.amountSats} />
        </DetailRow>
        <DetailRow label={t("withdraw.cashu.send.review.fee")}>
          <SatsWithFiat sats={quote.cost.maxFee} />
        </DetailRow>
        <DetailRow label={t("withdraw.review.total")} emphasize>
          <SatsWithFiat sats={quote.amountSats + quote.cost.maxFee} />
        </DetailRow>
        <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
          {t("withdraw.cashu.send.review.note")}
        </Text>
      </YStack>
    </WithdrawReviewCard>
  )
}
