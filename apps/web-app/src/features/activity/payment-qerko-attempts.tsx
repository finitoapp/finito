import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  deriveQerkoPaymentAttemptState,
  type QerkoPaymentAttemptState,
  QerkoProvidersJson,
} from "@payky/core/modules/payment/payment-qerko-payment-utils"
import { qerkoPaymentAttemptsByPaymentIdQuery } from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime } from "@/lib/format-utils.ts"

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
 * Every Qerko payment of a payment, oldest first (qerko/0013): when it
 * started, how it stands or ended, and what paid it. Nothing when the
 * payment never went through Qerko.
 */
export function PaymentQerkoAttempts({
  paymentId,
}: {
  readonly paymentId: PaymentId
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: attempts } = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId)
  )
  if (attempts.length === 0) return null

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {t("paymentDetail.qerkoAttempts.title")}
      </span>
      <ul className="flex flex-col gap-0.5 text-muted-foreground">
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
            <li key={attempt.id}>
              {formatDateTime(new Date(attempt.startedAt), locale)} ·{" "}
              {t(attemptStateKeys[deriveQerkoPaymentAttemptState(attempt)])}
              {providers.length > 0 ? ` (${providers.join(", ")})` : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
