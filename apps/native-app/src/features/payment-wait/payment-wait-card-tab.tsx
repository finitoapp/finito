import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import CreditCard from "lucide-react-native/icons/credit-card"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import { Text, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/**
 * The card tab, as web's `CardPaymentTab`: one 56-high button with a card
 * icon that opens the terminal; the page says what to do above the cancel.
 * While the last attempt's outcome is unknown, the device it went to can ask
 * SwitchioPay about it (payment/0019), as a refund's attempt can be asked
 * about in `payment-refunds.tsx`; web has no such lookup.
 */
export function CardPaymentTab({
  canPayCard,
  pending,
  errorKey,
  hasAccount,
  unresolvedTransactionId,
  onPayCard,
  asking,
  onAskTerminal,
}: {
  readonly canPayCard: boolean
  readonly pending: boolean
  readonly errorKey: TranslationKey | null
  readonly hasAccount: boolean
  /** Set while the last attempt's outcome is unknown. */
  readonly unresolvedTransactionId: string | null
  readonly onPayCard: () => void
  /** Whether SwitchioPay is being asked about the unknown attempt. */
  readonly asking: boolean
  /** Asks SwitchioPay about the unknown attempt; null where it cannot. */
  readonly onAskTerminal: (() => void) | null
}) {
  const { t } = useTranslation()

  return (
    <YStack w="100%" gap={12} items="center" py={16}>
      <Button
        size="lg"
        h={56}
        px={32}
        iconStart={CreditCard}
        label={
          pending
            ? t("paymentWait.cardPaid.pending")
            : t("paymentWait.cardPaid.action")
        }
        pending={pending}
        disabled={!canPayCard}
        onPress={onPayCard}
      />
      {/* The attempt is written unresolved before the terminal opens, so
          while it runs the marker names the attempt itself. */}
      {unresolvedTransactionId !== null && !pending ? (
        <>
          <Text
            maxW={288}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
            text="center"
            role="alert"
          >
            {t("paymentWait.cardPaid.unresolved", {
              transactionId: unresolvedTransactionId,
            })}
          </Text>
          {onAskTerminal === null ? null : (
            <Button
              variant="outline"
              iconStart={RotateCw}
              pending={asking}
              disabled={pending}
              label={t("paymentWait.cardPaid.check")}
              onPress={onAskTerminal}
            />
          )}
        </>
      ) : errorKey !== null ? (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color="destructive"
          text="center"
          role="alert"
        >
          {t(errorKey)}
        </Text>
      ) : null}
      {hasAccount ? null : (
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          text="center"
        >
          {t("paymentWait.cardPaid.unavailable")}
        </Text>
      )}
    </YStack>
  )
}
