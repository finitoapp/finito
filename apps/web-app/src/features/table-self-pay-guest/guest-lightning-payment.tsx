import { useNow } from "@payky/app-shared/use-now"
import { parseLightningInvoice } from "@payky/core/modules/shared/lightning-invoice-utils"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  createSelfPayLightningRequest,
  type SelfPaySignedRate,
} from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import type { SelfPayPointer } from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import type {
  SelfPayView,
  SelfPayViewBill,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import {
  createGuestLightningInvoice,
  prepareGuestInvoiceWallet,
} from "@payky/core/spark/spark-guest-invoice"
import { useMutation } from "@tanstack/react-query"
import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button.tsx"
import { createE2eGuestInvoiceWallet } from "@/platform/e2e-guest-invoice-wallet.ts"
import { useGuestStatus } from "./guest-status.tsx"
import { useGuestClipboard } from "./use-guest-clipboard.ts"
import { useGuestTranslation } from "./use-guest-translation.ts"

const invoiceExpiresAt = (invoice: string | undefined): TimestampMs | null => {
  if (invoice === undefined) return null
  const parsed = parseLightningInvoice(invoice)
  return parsed.ok ? TimestampMs(parsed.value.expiresAt) : null
}

export function GuestLightningPayment({
  lightning,
  bill,
  rate,
  amount,
  pointer,
}: {
  readonly lightning: NonNullable<SelfPayView["lightning"]>
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly rate: SelfPaySignedRate | null
  readonly amount: number
  readonly pointer: SelfPayPointer
}) {
  const { t } = useGuestTranslation()
  const announce = useGuestStatus()
  const clipboard = useGuestClipboard()
  const invoice = useMutation({
    mutationFn: (usableRate: SelfPaySignedRate) =>
      createGuestLightningInvoice({
        ...createSelfPayLightningRequest({
          bill,
          amount,
          pointer,
          rate: usableRate,
        }),
        receiverIdentityPubkey: lightning.identityPublicKey,
        wallet: prepareGuestInvoiceWallet(createE2eGuestInvoiceWallet()),
      }),
  })
  const expiresAt = invoiceExpiresAt(invoice.data)
  const now = useNow([expiresAt])
  const isExpired = expiresAt !== null && now.getTime() > expiresAt
  const expiredText = t("selfPay.lightning.expired")

  useEffect(() => {
    if (isExpired) announce(expiredText)
  }, [announce, expiredText, isExpired])

  if (isExpired) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="flex items-center gap-2 text-sm">
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-destructive"
          />
          {expiredText}
        </p>
        <Button
          type="button"
          size="lg"
          className="h-11"
          onClick={() => {
            if (rate === null) {
              invoice.reset()
            } else {
              invoice.mutate(rate)
            }
          }}
        >
          <ZapIcon />
          {t("selfPay.lightning.restart")}
        </Button>
      </div>
    )
  }

  if (invoice.data !== undefined) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-full max-w-64 rounded-xl bg-white p-4 ring-1 ring-foreground/10">
          <QRCodeSVG
            value={`lightning:${invoice.data}`}
            className="size-full"
            aria-label={t("selfPay.lightning.qr")}
            role="img"
          />
        </div>
        <Button
          nativeButton={false}
          render={<a href={`lightning:${invoice.data}`} />}
          size="lg"
          className="h-11"
        >
          <ZapIcon />
          {t("selfPay.lightning.open")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => clipboard.copy(invoice.data)}
        >
          {clipboard.state === "copied" ? <CheckIcon /> : <CopyIcon />}
          {t("selfPay.lightning.copy")}
        </Button>
        {clipboard.state === "failed" ? (
          <p className="text-center text-sm text-destructive">
            {t("selfPay.copy.failed")}
          </p>
        ) : null}
        <p className="w-full break-all rounded-lg bg-muted p-2 font-mono text-xs select-all">
          {invoice.data}
        </p>
      </div>
    )
  }

  if (rate === null) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {t("selfPay.lightning.unavailable")}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        type="button"
        size="lg"
        className="h-11"
        disabled={invoice.isPending}
        onClick={() => {
          invoice.mutate(rate)
        }}
      >
        {invoice.isPending ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <ZapIcon />
        )}
        {invoice.isPending
          ? t("selfPay.lightning.creating")
          : t("selfPay.lightning.create")}
      </Button>
      {invoice.isError ? (
        <p className="text-center text-sm text-destructive">
          {t("selfPay.lightning.error")}
        </p>
      ) : null}
    </div>
  )
}
