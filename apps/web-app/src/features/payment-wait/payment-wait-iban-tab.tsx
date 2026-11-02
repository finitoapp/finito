import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  AccountId,
  BankQrFormat,
} from "@payky/core/modules/account/account-types"
import {
  type BankQrPayload,
  isBankQrFormat,
} from "@payky/core/modules/payment/payment-iban-qr-payload-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { Link } from "@tanstack/react-router"
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { QrPaymentRequest } from "@/features/payment-wait/payment-wait-qr-request.tsx"
import type { IbanPaidTabProps } from "@/features/payment-wait/payment-wait-types.ts"
import { useMonetaPaymentWatch } from "@/features/payment-wait/use-moneta-payment-watch.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { copyToClipboard } from "@/lib/clipboard.ts"
import { formatAddressGroups } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

const paymentWaitQrFormatShortLabelKeys = {
  payBySquare1_0_0: "paymentWait.qrFormatShort.payBySquare1_0_0",
  payBySquare1_2_0: "paymentWait.qrFormatShort.payBySquare1_2_0",
  spayd: "paymentWait.qrFormatShort.spayd",
} satisfies Record<BankQrFormat, TranslationKey>

export function IbanPaymentTab({
  paymentId,
  accountId,
  createdAt,
  payable,
  defaultQrFormat,
  qrPayload,
  qrPayloads,
  iban,
  preparingMessageKey,
  selectedQrFormat,
  onSelectQrFormat,
  canMarkIbanPaid,
  ibanPaymentErrorKey,
  ibanPaymentPending,
  ibanVariableSymbol,
  onMarkIbanPaid,
}: {
  readonly defaultQrFormat: BankQrFormat
  readonly qrPayload: string | null
  readonly qrPayloads: ReadonlyArray<BankQrPayload>
  readonly iban: string | null
  readonly preparingMessageKey: TranslationKey | null
  readonly selectedQrFormat: BankQrFormat | null
  readonly onSelectQrFormat: (format: BankQrFormat) => void
} & IbanPaidTabProps &
  MonetaPaymentWatchProps) {
  const { t } = useTranslation()
  const activeQrFormat = selectedQrFormat ?? defaultQrFormat
  const [detailsVisible, setDetailsVisible] = useState(false)
  const hasDetails = iban !== null || ibanVariableSymbol !== null

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <QrPaymentRequest
        qrPayload={qrPayload}
        preparingMessageKey={preparingMessageKey}
      />
      <MonetaPaymentWatchStatus
        paymentId={paymentId}
        accountId={accountId}
        createdAt={createdAt}
        payable={payable}
      />
      {qrPayloads.length > 1 ? (
        <ToggleGroup<BankQrFormat>
          value={[activeQrFormat]}
          onValueChange={(value) => {
            const [nextFormat] = value
            if (isBankQrFormat(nextFormat)) {
              onSelectQrFormat(nextFormat)
            }
          }}
          variant="default"
          className="h-11 rounded-full border border-black/15 bg-background p-1 px-1.5 text-muted-foreground dark:border-white/15"
        >
          {qrPayloads.map((payload) => (
            <ToggleGroupItem
              key={payload.format}
              value={payload.format}
              aria-label={t(`paymentWait.qrFormat.${payload.format}`)}
              className="h-full min-w-12 -mx-0.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-foreground data-[state=on]:text-background aria-pressed:bg-foreground aria-pressed:text-background dark:data-[state=on]:bg-white dark:data-[state=on]:text-black dark:aria-pressed:bg-white dark:aria-pressed:text-black"
            >
              {t(paymentWaitQrFormatShortLabelKeys[payload.format])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      {detailsVisible && hasDetails ? (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {iban !== null ? (
            <CopyableDetailRow
              label={t("paymentWait.ibanDetails.iban.label")}
              value={iban}
              displayValue={formatAddressGroups(iban)}
              copyAriaLabel={t("paymentWait.ibanDetails.iban.copy")}
              copiedMessage={t("paymentWait.ibanDetails.iban.copied")}
              copyFailedMessage={t("paymentWait.ibanDetails.iban.copyError")}
            />
          ) : null}
          {ibanVariableSymbol !== null ? (
            <CopyableDetailRow
              label={t("paymentWait.ibanDetails.variableSymbol.label")}
              value={ibanVariableSymbol}
              copyAriaLabel={t("paymentWait.ibanDetails.variableSymbol.copy")}
              copiedMessage={t("paymentWait.ibanDetails.variableSymbol.copied")}
              copyFailedMessage={t(
                "paymentWait.ibanDetails.variableSymbol.copyError"
              )}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {hasDetails ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              detailsVisible
                ? t("paymentWait.ibanDetails.hide")
                : t("paymentWait.ibanDetails.show")
            }
            aria-pressed={detailsVisible}
            onClick={() => {
              setDetailsVisible((current) => !current)
            }}
          >
            {detailsVisible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!canMarkIbanPaid || ibanPaymentPending}
          onClick={onMarkIbanPaid}
        >
          {ibanPaymentPending ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <CheckIcon />
          )}
          {ibanPaymentPending
            ? t("paymentWait.ibanPaid.pending")
            : t("paymentWait.ibanPaid.action")}
        </Button>
      </div>
      {ibanPaymentErrorKey ? (
        <p className="text-sm font-medium text-destructive">
          {t(ibanPaymentErrorKey)}
        </p>
      ) : null}
    </div>
  )
}

interface MonetaPaymentWatchProps {
  readonly paymentId: PaymentId
  /** The bank account the transfer goes to. */
  readonly accountId: AccountId
  readonly createdAt: string | null
  /** The payment is still waiting for money. */
  readonly payable: boolean
}

/** The bank's own check of the transfer, when a MONETA token is connected. */
function MonetaPaymentWatchStatus(props: MonetaPaymentWatchProps) {
  const { t } = useTranslation()
  const { result, statusKey } = useMonetaPaymentWatch(props)
  if (statusKey === null) return null

  return (
    <p
      className={cn(
        "flex max-w-72 items-start gap-1.5 text-balance text-sm",
        result === "answered" || result === undefined
          ? "text-muted-foreground"
          : "text-warning"
      )}
      role="status"
    >
      {result === "answered" || result === undefined ? (
        <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
      ) : (
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        {t(statusKey)}
        {result === "unauthorized" ? (
          <>
            {" "}
            <Link
              to="/settings/payment-accounts/iban/moneta-plugin"
              className="underline underline-offset-2"
            >
              {t("paymentWait.monetaWatch.openSettings")}
            </Link>
          </>
        ) : null}
      </span>
    </p>
  )
}

function CopyableDetailRow({
  label,
  value,
  displayValue,
  copyAriaLabel,
  copiedMessage,
  copyFailedMessage,
}: {
  readonly label: string
  readonly value: string
  readonly displayValue?: string
  readonly copyAriaLabel: string
  readonly copiedMessage: string
  readonly copyFailedMessage: string
}) {
  const copyValue = () => {
    void copyToClipboard(value, {
      copied: copiedMessage,
      failed: copyFailedMessage,
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 px-3 py-2 dark:border-white/15">
      <span className="flex min-w-0 flex-col items-start text-left">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-sm">
          {displayValue ?? value}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={copyAriaLabel}
        onClick={copyValue}
      >
        <CopyIcon />
      </Button>
    </div>
  )
}
