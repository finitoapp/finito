import {
  type BankQrFormat,
  BankQrFormatSchema,
} from "@payky/core/modules/account/account-types"
import { minorUnitsToFixedDecimalString } from "@payky/core/modules/shared/money"
import { Integer } from "@payky/core/modules/shared/schema"
import { createSelfPayBankQrPayload } from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import {
  formatSelfPayBankMessage,
  type SelfPayPointer,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import type {
  SelfPayView,
  SelfPayViewBill,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { useQuery } from "@tanstack/react-query"
import { CheckIcon, CopyIcon, DownloadIcon, LandmarkIcon } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { guestToggleClassName } from "./guest-pick-styles.ts"
import { useGuestClipboard } from "./use-guest-clipboard.ts"
import { useGuestTranslation } from "./use-guest-translation.ts"

function CopyRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  const { t } = useGuestTranslation()
  const clipboard = useGuestClipboard()
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-all font-mono text-sm select-all">{value}</div>
        {clipboard.state === "failed" ? (
          <p className="text-xs text-destructive">{t("selfPay.copy.failed")}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={t("selfPay.bank.copy", { field: label })}
        onClick={() => clipboard.copy(value)}
      >
        {clipboard.state === "copied" ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

const pngFileFromDataUrl = (dataUrl: string, name: string): File =>
  new File(
    [
      Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (char) =>
        char.charCodeAt(0)
      ),
    ],
    name,
    { type: "image/png" }
  )

const downloadDataUrl = (dataUrl: string, name: string) => {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = name
  link.click()
}

const shareOrDownload = async (file: File, dataUrl: string) => {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
    }
  }
  downloadDataUrl(dataUrl, file.name)
}

const spaydType = "application/x-shortpaymentdescriptor"

const openInBankApp = (spayd: string, name: string) =>
  shareOrDownload(
    new File([spayd], name, { type: spaydType }),
    `data:${spaydType};charset=utf-8,${encodeURIComponent(spayd)}`
  )

export function GuestBankPayment({
  bank,
  bill,
  amount,
  pointer,
}: {
  readonly bank: NonNullable<SelfPayView["bank"]>
  readonly bill: SelfPayViewBill
  readonly amount: number
  readonly pointer: SelfPayPointer
}) {
  const { t } = useGuestTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [format, setFormat] = useState<BankQrFormat>(bank.qrFormat)
  const payBySquare =
    bank.qrFormat === "spayd" ? "payBySquare1_2_0" : bank.qrFormat
  const payload = useQuery({
    queryKey: ["selfPayBankQr", format, bank, bill.reference, amount, pointer],
    queryFn: () =>
      createSelfPayBankQrPayload({ format, bank, bill, amount, pointer }),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const qrFileName = `payment-${bill.reference}.png`
  const spayd = format === "spayd" ? payload.data : undefined

  useEffect(() => {
    const canvas = canvasRef.current
    setQrImage(
      payload.data === undefined || canvas === null
        ? null
        : canvas.toDataURL("image/png")
    )
  }, [payload.data])

  return (
    <div className="flex flex-col items-center gap-3">
      <ToggleGroup<BankQrFormat>
        value={[format]}
        onValueChange={([next]) => {
          const parsed = BankQrFormatSchema.safeParse(next)
          if (parsed.success) setFormat(parsed.data)
        }}
        variant="outline"
        className="w-full max-w-64"
      >
        <ToggleGroupItem
          value="spayd"
          className={`${guestToggleClassName} flex-1`}
        >
          {t("selfPay.bank.format.spayd")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value={payBySquare}
          className={`${guestToggleClassName} flex-1`}
        >
          {t("selfPay.bank.format.payBySquare")}
        </ToggleGroupItem>
      </ToggleGroup>
      {spayd === undefined ? null : (
        <Button
          type="button"
          size="lg"
          className="h-12 w-full max-w-64 text-base"
          onClick={() => {
            void openInBankApp(spayd, `payment-${bill.reference}.spayd`)
          }}
        >
          <LandmarkIcon />
          {t("selfPay.bank.openInApp")}
        </Button>
      )}
      <div className="aspect-square w-full max-w-64 rounded-xl bg-white p-4 ring-1 ring-foreground/10">
        {payload.data === undefined ? null : (
          <QRCodeCanvas
            ref={canvasRef}
            value={payload.data}
            size={512}
            hidden
          />
        )}
        {qrImage === null ? null : (
          <img src={qrImage} alt={t("selfPay.bank.qr")} className="size-full" />
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={qrImage === null}
        onClick={() => {
          if (qrImage !== null)
            void shareOrDownload(
              pngFileFromDataUrl(qrImage, qrFileName),
              qrImage
            )
        }}
      >
        <DownloadIcon />
        {t("selfPay.bank.saveQr")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("selfPay.bank.hint")}
      </p>
      <div className="flex w-full flex-col divide-y divide-foreground/10">
        <CopyRow label={t("selfPay.bank.account")} value={bank.iban} />
        <CopyRow
          label={t("selfPay.bank.amount")}
          value={minorUnitsToFixedDecimalString({
            value: Integer(amount),
            currency: bill.currency,
          })}
        />
        <CopyRow
          label={t("selfPay.bank.variableSymbol")}
          value={bill.reference}
        />
        <CopyRow
          label={t("selfPay.bank.message")}
          value={formatSelfPayBankMessage({ pointer })}
        />
      </div>
    </div>
  )
}
