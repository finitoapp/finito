import {
  formatAddressGroups,
  formatCountdown,
} from "@payky/app-shared/format-text"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  isExitSpeedUnavailable,
  quoteConfirmDeadline,
} from "@payky/app-shared/withdraw-flow"
import type {
  LightningWithdrawalQuote,
  OnchainWithdrawalQuote,
  WithdrawalQuote,
} from "@payky/core/modules/withdraw/withdraw-actions"
import {
  computeTotalDebitedSats,
  withdrawalRecipientSats,
} from "@payky/core/modules/withdraw/withdraw-utils"
import type { SparkExitSpeed } from "@payky/core/spark/spark-wallet"
import ArrowLeft from "lucide-react-native/icons/arrow-left"
import RefreshCw from "lucide-react-native/icons/refresh-cw"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { DetailRow } from "../../components/detail-row.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import { FieldError, FieldGroup } from "../../components/ui/field.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../lib/format-money.ts"
import { BitcoinAmount } from "../shared/bitcoin-amount.tsx"
import { Collapsible, LightningAddress, Mono } from "./withdraw-parts.tsx"

/** Spark documents no confirmation times per exit speed, so each option says what it trades off. */
const exitSpeedOptions: ReadonlyArray<{
  readonly value: SparkExitSpeed
  readonly label: TranslationKey
  readonly hint: TranslationKey
}> = [
  {
    value: "fast",
    label: "withdraw.review.speed.fast",
    hint: "withdraw.review.speed.fast.hint",
  },
  {
    value: "medium",
    label: "withdraw.review.speed.medium",
    hint: "withdraw.review.speed.medium.hint",
  },
  {
    value: "slow",
    label: "withdraw.review.speed.slow",
    hint: "withdraw.review.speed.slow.hint",
  },
]

/** Under this much time left the countdown turns into a warning. */
export const EXPIRY_WARNING_MS = 60_000

function OnchainReview({
  quote,
  exitSpeed,
  confirming,
  onExitSpeedChange,
}: {
  readonly quote: OnchainWithdrawalQuote
  readonly exitSpeed: SparkExitSpeed
  /** The fee shown must not change while a send is being confirmed. */
  readonly confirming: boolean
  readonly onExitSpeedChange: (exitSpeed: SparkExitSpeed) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const feeSats = quote.feeQuote[exitSpeed].totalFeeSats
  const totalSats = computeTotalDebitedSats({
    amountSats: quote.amountSats,
    withdrawAll: quote.withdrawAll,
    availableSats: quote.availableSats,
    feeSats,
  })

  return (
    <>
      <ToggleGroup<SparkExitSpeed>
        value={exitSpeed}
        onValueChange={onExitSpeedChange}
        variant="outline"
        spacing={0}
        orientation="vertical"
      >
        {exitSpeedOptions.map((option) => {
          const unavailable = isExitSpeedUnavailable(quote, option.value)
          const optionFee = quote.feeQuote[option.value].totalFeeSats
          return (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              disabled={unavailable || confirming}
              aria-label={`${t(option.label)}. ${t(option.hint)}. ${t("withdraw.sats", { amount: formatSatsAmount(optionFee, locale) })}`}
              h="auto"
              w="100%"
              justify="space-between"
              px="4"
              py="2"
            >
              <YStack flex={1} items="flex-start" gap="1">
                <Text>{t(option.label)}</Text>
                <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                  {t(option.hint)}
                </Text>
              </YStack>
              <BitcoinAmount sats={optionFee} size="xs" />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <YStack gap="3">
        <DetailRow label={t("withdraw.review.destination")} stacked>
          <Mono value={formatAddressGroups(quote.onchainAddress)} />
        </DetailRow>
        <DetailRow label={t("withdraw.review.amount")}>
          <BitcoinAmount sats={withdrawalRecipientSats(quote, exitSpeed)} />
        </DetailRow>
        <DetailRow label={t("withdraw.review.fee")}>
          <BitcoinAmount sats={feeSats} />
        </DetailRow>
        <DetailRow label={t("withdraw.review.total")} emphasize>
          <BitcoinAmount sats={totalSats} />
        </DetailRow>
      </YStack>
    </>
  )
}

function LightningReview({
  quote,
  msLeft,
}: {
  readonly quote: LightningWithdrawalQuote
  readonly msLeft: number
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const maxFee = formatSatsAmount(quote.maxFeeSats, locale)
  const invoiceDescription =
    quote.lightningAddress === null ? quote.invoice.description : null

  return (
    <YStack gap="3">
      <DetailRow label={t("withdraw.review.destination")} stacked>
        {quote.lightningAddress !== null ? (
          <LightningAddress address={quote.lightningAddress} />
        ) : (
          <Text>{t("withdraw.destination.kind.lightningInvoice")}</Text>
        )}
      </DetailRow>
      {quote.recipientText === null ? null : (
        <DetailRow
          label={t(
            invoiceDescription === null
              ? "withdraw.review.recipientText"
              : "withdraw.review.invoiceDescription"
          )}
          stacked
        >
          <Text>{quote.recipientText}</Text>
        </DetailRow>
      )}
      <DetailRow label={t("withdraw.review.amount")}>
        <BitcoinAmount sats={quote.amountSats} />
      </DetailRow>
      <DetailRow label={t("withdraw.review.lightningFee")}>
        {quote.invoice.sparkFallbackIdentity !== null
          ? t("withdraw.review.maxFeeSpark", { amount: maxFee })
          : t("withdraw.review.feeEstimate", {
              estimate: formatSatsAmount(quote.feeEstimateSats, locale),
              max: maxFee,
            })}
      </DetailRow>
      <DetailRow label={t("withdraw.review.maxTotal")} emphasize>
        <BitcoinAmount sats={quote.amountSats + quote.maxFeeSats} />
      </DetailRow>
      <ExpiryRow msLeft={msLeft} />
      <Text color="muted-foreground">{t("withdraw.review.remainder")}</Text>
      <Collapsible label={t("withdraw.review.showInvoice")}>
        <Mono value={quote.invoice.invoice} />
      </Collapsible>
    </YStack>
  )
}

/** How long the quote can still be confirmed, red in its last minute. */
export function ExpiryRow({ msLeft }: { readonly msLeft: number }) {
  const { t } = useTranslation()
  return (
    <DetailRow label={t("withdraw.review.expiresIn")}>
      <Text color={msLeft <= EXPIRY_WARNING_MS ? "destructive" : "color"}>
        {formatCountdown(msLeft)}
      </Text>
    </DetailRow>
  )
}

/** Milliseconds until `deadline`, ticking each second. */
export const useMsLeft = (deadline: number): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, deadline - now)
}

/** Shared Spark/Cashu review card; send handlers stay in their flow owners. */
export function WithdrawReviewCard({
  children,
  recipientComment = null,
  comment,
  error,
  nearlyExpired = false,
  expired = false,
  confirming,
  requoting,
  uncertain,
  onBack,
  onConfirm,
  onNewQuote,
  onOpenHistory,
}: {
  readonly children: ReactNode
  readonly recipientComment?: string | null
  readonly comment: string | null
  readonly error: string | null
  /** A quote that expires: unset for a send that holds until confirmed. */
  readonly nearlyExpired?: boolean
  readonly expired?: boolean
  readonly confirming: boolean
  readonly requoting: boolean
  /** A send may or may not have happened: nothing may be confirmed again from here. */
  readonly uncertain: boolean
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly onNewQuote: () => void
  readonly onOpenHistory: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("withdraw.review.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {children}
          {recipientComment === null ? null : (
            <DetailRow label={t("withdraw.review.recipientComment")} stacked>
              <Text>{recipientComment}</Text>
            </DetailRow>
          )}
          {comment === null ? null : (
            <DetailRow label={t("withdraw.review.comment")} stacked>
              <Text>{comment}</Text>
            </DetailRow>
          )}
          <Text color="muted-foreground">{t("withdraw.review.warning")}</Text>
          <FieldError>{error ?? undefined}</FieldError>
          {!uncertain && (error !== null || nearlyExpired) ? (
            <XStack>
              <Button
                size="default"
                variant="outline"
                iconStart={RefreshCw}
                label={t("withdraw.review.newQuote")}
                disabled={confirming || requoting}
                pending={requoting}
                onPress={onNewQuote}
              />
            </XStack>
          ) : null}
        </FieldGroup>
      </CardContent>
      <CardFooter gap="2">
        <Button
          size="default"
          variant="outline"
          iconStart={ArrowLeft}
          label={t("withdraw.review.back")}
          disabled={confirming}
          onPress={onBack}
        />
        {uncertain ? (
          <Button
            size="default"
            flex={1}
            label={t("withdraw.history.title")}
            onPress={onOpenHistory}
          />
        ) : (
          <Button
            size="default"
            flex={1}
            label={
              confirming
                ? t("withdraw.review.confirming")
                : t("withdraw.review.confirm")
            }
            pending={confirming}
            disabled={requoting || expired}
            onPress={onConfirm}
          />
        )}
      </CardFooter>
    </Card>
  )
}

export function WithdrawReviewStep({
  quote,
  recipientComment,
  comment,
  exitSpeed,
  confirming,
  requoting,
  confirmError,
  uncertain,
  onExitSpeedChange,
  onBack,
  onConfirm,
  onNewQuote,
  onOpenHistory,
}: {
  readonly quote: WithdrawalQuote
  /** The LUD-12 comment sent to the recipient. */
  readonly recipientComment: string | null
  /** The merchant's own note, saved with the withdrawal. */
  readonly comment: string | null
  readonly exitSpeed: SparkExitSpeed
  readonly confirming: boolean
  readonly requoting: boolean
  readonly confirmError: string | null
  /** A send may or may not have happened: nothing may be confirmed again from here. */
  readonly uncertain: boolean
  readonly onExitSpeedChange: (exitSpeed: SparkExitSpeed) => void
  readonly onBack: () => void
  readonly onConfirm: () => void
  readonly onNewQuote: () => void
  readonly onOpenHistory: () => void
}) {
  const { t } = useTranslation()
  const msLeft = useMsLeft(quoteConfirmDeadline(quote))
  const expired = msLeft <= 0
  const nearlyExpired = msLeft <= EXPIRY_WARNING_MS
  const error =
    confirmError ??
    (expired
      ? t(
          quote.kind === "lightning"
            ? "withdraw.error.lightningInvoiceExpired"
            : "withdraw.error.quoteExpired"
        )
      : null)

  return (
    <WithdrawReviewCard
      recipientComment={recipientComment}
      comment={comment}
      error={error}
      nearlyExpired={nearlyExpired}
      expired={expired}
      confirming={confirming}
      requoting={requoting}
      uncertain={uncertain}
      onBack={onBack}
      onConfirm={onConfirm}
      onNewQuote={onNewQuote}
      onOpenHistory={onOpenHistory}
    >
      {quote.kind === "onchain" ? (
        <OnchainReview
          quote={quote}
          exitSpeed={exitSpeed}
          confirming={confirming}
          onExitSpeedChange={onExitSpeedChange}
        />
      ) : (
        <LightningReview quote={quote} msLeft={msLeft} />
      )}
    </WithdrawReviewCard>
  )
}
