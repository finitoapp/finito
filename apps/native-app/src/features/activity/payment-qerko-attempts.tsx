import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  deriveQerkoPaymentAttemptState,
  type QerkoPaymentAttemptState,
  QerkoProvidersJson,
} from "@payky/core/modules/payment/payment-qerko-payment-utils"
import { qerkoPaymentAttemptsByPaymentIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { Text, YStack } from "tamagui"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

const attemptStateKeys = {
  started: "paymentDetail.qerkoAttempts.state.started",
  processing: "paymentDetail.qerkoAttempts.state.processing",
  paid: "paymentDetail.qerkoAttempts.state.paid",
  failed: "paymentDetail.qerkoAttempts.state.failed",
} satisfies Record<QerkoPaymentAttemptState, TranslationKey>

/** Qerko's provider types; one Payky does not know shows as Qerko names it. */
const providerKeys: Readonly<Record<string, TranslationKey | undefined>> = {
  CARD: "paymentDetail.qerkoProvider.card",
  MEAL_TICKET: "paymentDetail.qerkoProvider.mealTicket",
  VOUCHER: "paymentDetail.qerkoProvider.voucher",
  BANK_TRANSFER: "paymentDetail.qerkoProvider.bankTransfer",
  INVOICE: "paymentDetail.qerkoProvider.invoice",
}

/**
 * Every Qerko payment of a payment, as web's `PaymentQerkoAttempts`
 * (qerko/0013). Nothing when the payment never went through Qerko.
 */
export function PaymentQerkoAttempts({
  paymentId,
}: {
  readonly paymentId: PaymentId
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const attempts = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId)
  ).data
  if (attempts.length === 0) return null

  return (
    <YStack gap={4}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.medium}
      >
        {t("paymentDetail.qerkoAttempts.title")}
      </Text>
      {attempts.map((attempt) => {
        const decoded =
          attempt.providers === null
            ? null
            : QerkoProvidersJson.safeDecode(attempt.providers)
        const providers = decoded?.success
          ? decoded.data.map((type) => {
              const key = providerKeys[type]
              return key === undefined ? type : t(key)
            })
          : []
        return (
          <Text
            key={attempt.id}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {formatDateTime(new Date(attempt.startedAt), locale)} ·{" "}
            {t(attemptStateKeys[deriveQerkoPaymentAttemptState(attempt)])}
            {providers.length > 0 ? ` (${providers.join(", ")})` : null}
          </Text>
        )
      })}
    </YStack>
  )
}
