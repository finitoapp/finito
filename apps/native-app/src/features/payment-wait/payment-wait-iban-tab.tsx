import { formatAddressGroups } from "@payky/app-shared/format-text"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { activeFioPluginsQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { czechIbanToBban } from "@payky/core/modules/shared/iban-utils"
import { router } from "expo-router"
import Check from "lucide-react-native/icons/check"
import Info from "lucide-react-native/icons/info"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { CopyableQrCode } from "../../components/copyable-qr-code.tsx"
import { DetailRow } from "../../components/detail-row.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { useMonetaPaymentWatch } from "./use-moneta-payment-watch.ts"

interface MonetaPaymentWatchProps {
  readonly paymentId: PaymentId
  /** The bank account the transfer goes to. */
  readonly accountId: AccountId
  readonly createdAt: string | null
  /** The payment is still waiting for money. */
  readonly payable: boolean
}

/**
 * "Waiting for payment" while the transfer can still arrive and a bank
 * reports it by itself: the account has a FIO token (the sync job polls
 * it) or a MONETA one. MONETA's own watch speaks instead when it has
 * something to say (`MonetaPaymentWatchStatus`).
 */
function BankWatchStatus(props: MonetaPaymentWatchProps) {
  const { t } = useTranslation()
  const fioPlugins = useEvoluQuery(activeFioPluginsQuery).data
  const monetaPlugins = useEvoluQuery(activeMonetaPluginsQuery).data
  const monetaWatch = useMonetaPaymentWatch(props)
  if (monetaWatch.statusKey !== null)
    return <MonetaPaymentWatchStatus {...monetaWatch} />
  const watched =
    fioPlugins.some(
      ({ accountId, tokens }) =>
        accountId === props.accountId && tokens.length > 0
    ) || monetaPlugins.some(({ accountId }) => accountId === props.accountId)
  if (!props.payable || !watched) return null
  return (
    <XStack items="center" gap={8} testID="payment-bank-watch">
      <ActivityIndicator size="small" />
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {t("paymentWait.bankWatch.waiting")}
      </Text>
    </XStack>
  )
}

/** The bank's own check of the transfer, as web's: only with a MONETA token. */
function MonetaPaymentWatchStatus({
  result,
  statusKey,
}: ReturnType<typeof useMonetaPaymentWatch>) {
  const { t } = useTranslation()
  if (statusKey === null) return null

  const isWatching = result === "answered" || result === undefined

  return (
    <YStack items="center" gap={4} maxW={288}>
      <XStack items="flex-start" gap={6}>
        {isWatching ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon icon={TriangleAlert} size={16} color="warning" />
        )}
        <Text
          flex={1}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color={isWatching ? "muted-foreground" : "warning"}
        >
          {t(statusKey)}
        </Text>
      </XStack>
      {result === "unauthorized" ? (
        <Button
          variant="link"
          label={t("paymentWait.monetaWatch.openSettings")}
          onPress={() => {
            router.push("/settings/payment-accounts/iban/moneta-plugin")
          }}
        />
      ) : null}
    </YStack>
  )
}

/**
 * The bank QR and the manual "paid" action, as web's `IbanPaymentTab`, but
 * pared down for the counter: the QR in the account's default format alone
 * (`ibanDefaultQrFormat`, no format switch), "I received the transfer" as
 * the main button and "More information" beside it, a dialog with the
 * transfer's details (variable symbol, account, recipient) and the cancel
 * action, which the page then leaves out.
 * With a FIO or MONETA token on the account the bank reports the transfer
 * by itself, so a spinner says the app is waiting for it.
 */
export function IbanPaymentTab({
  paymentId,
  accountId,
  createdAt,
  payable,
  qrPayload,
  iban,
  recipient,
  variableSymbol,
  preparing,
  canMarkPaid,
  pending,
  errorKey,
  onMarkPaid,
  cancelPending,
  onCancel,
}: {
  readonly qrPayload: string | null
  readonly iban: string
  /** Whom the transfer goes to: the profile name, as the QR names it. */
  readonly recipient: string | null
  readonly variableSymbol: string | null
  readonly preparing: boolean
  readonly canMarkPaid: boolean
  readonly pending: boolean
  readonly errorKey: TranslationKey | null
  readonly onMarkPaid: () => void
  readonly cancelPending: boolean
  readonly onCancel: () => void
} & MonetaPaymentWatchProps) {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  // A Czech account reads as its number/bank code, as the customer types it.
  const czechAccount = czechIbanToBban(iban)

  return (
    <YStack w="100%" gap={12} items="center">
      {qrPayload !== null ? (
        <CopyableQrCode value={qrPayload} />
      ) : preparing ? (
        <XStack items="center" gap={8}>
          <ActivityIndicator />
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("paymentWait.preparing.iban")}
          </Text>
        </XStack>
      ) : null}
      <BankWatchStatus
        paymentId={paymentId}
        accountId={accountId}
        createdAt={createdAt}
        payable={payable}
      />
      <YStack w="100%" maxW={320} gap={8} pt={4}>
        <Button
          size="lg"
          iconStart={Check}
          label={
            pending
              ? t("paymentWait.ibanPaid.pending")
              : t("paymentWait.ibanPaid.action")
          }
          pending={pending}
          disabled={!canMarkPaid || cancelPending}
          onPress={onMarkPaid}
        />
        <Button
          size="lg"
          variant="secondary"
          iconStart={Info}
          label={t("paymentWait.ibanDetails.more")}
          onPress={() => setDetailsOpen(true)}
        />
      </YStack>
      {errorKey === null ? null : (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color="destructive"
          role="alert"
        >
          {t(errorKey)}
        </Text>
      )}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent closeLabel={t("dialog.close")}>
          <DialogHeader>
            <DialogTitle>{t("paymentWait.ibanDetails.title")}</DialogTitle>
          </DialogHeader>
          <YStack gap={12}>
            {variableSymbol === null ? null : (
              <DetailRow
                label={t("paymentWait.ibanDetails.variableSymbol.label")}
                value={variableSymbol}
              />
            )}
            {czechAccount === null ? (
              <DetailRow
                label={t("paymentWait.ibanDetails.iban.label")}
                value={formatAddressGroups(iban)}
                stacked
              />
            ) : (
              <DetailRow
                label={t("paymentWait.ibanDetails.account.label")}
                value={czechAccount}
              />
            )}
            {recipient === null ? null : (
              <DetailRow
                label={t("paymentWait.ibanDetails.recipient.label")}
                value={recipient}
              />
            )}
          </YStack>
          <Button
            variant="secondary"
            label={t("paymentWait.cancel")}
            pending={cancelPending}
            disabled={pending}
            onPress={() => {
              // Closed first: cancelling may ask for the PIN in a dialog of its own.
              setDetailsOpen(false)
              onCancel()
            }}
          />
        </DialogContent>
      </Dialog>
    </YStack>
  )
}
