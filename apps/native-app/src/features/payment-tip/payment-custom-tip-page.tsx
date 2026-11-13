import { calculatePaymentAmounts } from "@payky/core/modules/payment/payment-tip-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useLocalSearchParams } from "expo-router"
import { atom } from "jotai"
import { useState } from "react"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import { Screen } from "../../components/screen.tsx"
import { useCreateTerminalPayment } from "../../hooks/use-create-terminal-payment.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { AmountKeypad } from "../shared/amount-keypad.tsx"
import { parseTipSearch } from "./tip-search.ts"

/**
 * Web's custom tip screen: the tip typed on the keypad home charges from,
 * into an atom of this screen's own, so leaving it forgets the tip and
 * leaves home's amount alone.
 */
export function PaymentCustomTipPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const search = parseTipSearch(useLocalSearchParams())
  const createTerminalPayment = useCreateTerminalPayment()
  const [tipInputAtom] = useState(() => atom(""))

  if (search === null)
    return <RouteMessage>{t("paymentTip.invalidLink")}</RouteMessage>
  const { amount, currency, billId } = search

  const handleContinue = async (tipAmount: NonNegativeInteger) => {
    await createTerminalPayment({
      ...calculatePaymentAmounts({ amount, tipAmount }),
      currency,
      billId,
    })
  }

  return (
    <Screen>
      <FadeHeader />
      <YStack flex={1}>
        <AmountKeypad
          amountInputAtom={tipInputAtom}
          currency={currency}
          submitLabel={t("paymentTip.continue")}
          onSubmit={handleContinue}
          header={
            <YStack items="center" gap={4}>
              <Text
                fontSize={fontSize.base}
                lineHeight={fontSize.base}
                fontWeight={fontWeight.semibold}
              >
                {t("paymentTip.custom.label")}
              </Text>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("paymentTip.custom.orderTotal", {
                  amount: formatMoney(
                    { value: NonNegativeInteger(amount), currency },
                    locale
                  ),
                })}
              </Text>
            </YStack>
          }
        />
      </YStack>
    </Screen>
  )
}
