import type { BankQrFormat } from "@payky/core/modules/account/account-types"
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
import { formatAddressGroups } from "@/lib/format-utils.ts"
import { guestBankQrFormat, otherBankQrFormat } from "./guest-bank-qr-format.ts"
import { formatGuestAmount, formatGuestBareAmount } from "./guest-format.ts"
import { useGuestClipboard } from "./use-guest-clipboard.ts"
import { useGuestTranslation } from "./use-guest-translation.ts"

function CopyRow({
  label,
  value,
  displayValue = value,
}: {
  readonly label: string
  readonly value: string
  readonly displayValue?: string
}) {
  const { t } = useGuestTranslation()
  const clipboard = useGuestClipboard()
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-all font-mono text-sm select-all">
          {displayValue}
        </div>
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

const canShareFile = (file: File): boolean =>
  navigator.canShare?.({ files: [file] }) === true

const offerToShare = async (file: File): Promise<boolean> => {
  try {
    await navigator.share({ files: [file] })
    return true
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError"
  }
}

const shareOrDownload = async (file: File, dataUrl: string) => {
  if (canShareFile(file) && (await offerToShare(file))) return
  downloadDataUrl(dataUrl, file.name)
}

const spaydType = "application/x-shortpaymentdescriptor"

const mainButtonClassName = "h-12 w-full max-w-64 text-base"

export function GuestBankPayment({
  bank,
  bill,
  amount,
  pointer,
}: {
  readonly bank: NonNullable<SelfPayView["bank"]>
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly amount: number
  readonly pointer: SelfPayPointer
}) {
  const { t, locale } = useGuestTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [chosenFormat, setChosenFormat] = useState<BankQrFormat | null>(null)
  const format = chosenFormat ?? guestBankQrFormat(locale, bank.qrFormat)
  const otherFormat = otherBankQrFormat(format, bank.qrFormat)
  const payload = useQuery({
    queryKey: ["selfPayBankQr", format, bank, bill.reference, amount, pointer],
    queryFn: () =>
      createSelfPayBankQrPayload({ format, bank, bill, amount, pointer }),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const qrFileName = `payment-${bill.reference}.png`
  const spaydFile =
    format === "spayd" && payload.data !== undefined
      ? new File([payload.data], `payment-${bill.reference}.spayd`, {
          type: spaydType,
        })
      : null
  const bankAppFile =
    spaydFile !== null && canShareFile(spaydFile) ? spaydFile : null
  const saveQrButton = (
    <Button
      type="button"
      variant={bankAppFile === null ? "default" : "outline"}
      size="lg"
      className={bankAppFile === null ? mainButtonClassName : "h-11"}
      disabled={qrImage === null}
      onClick={() => {
        if (qrImage !== null)
          void shareOrDownload(pngFileFromDataUrl(qrImage, qrFileName), qrImage)
      }}
    >
      <DownloadIcon />
      {t("selfPay.bank.saveQr")}
    </Button>
  )

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
      <p className="text-center text-sm text-muted-foreground">
        {t(
          bankAppFile === null
            ? "selfPay.bank.hint.save"
            : "selfPay.bank.hint.open"
        )}
      </p>
      {bankAppFile === null ? (
        saveQrButton
      ) : (
        <Button
          type="button"
          size="lg"
          className={mainButtonClassName}
          onClick={() => {
            void offerToShare(bankAppFile)
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
        variant="link"
        className="h-11"
        onClick={() => {
          setChosenFormat(otherFormat)
        }}
      >
        {t(
          otherFormat === "spayd"
            ? "selfPay.bank.format.showSpayd"
            : "selfPay.bank.format.showPayBySquare"
        )}
      </Button>
      {bankAppFile === null ? null : saveQrButton}
      <p className="w-full text-sm text-muted-foreground">
        {t("selfPay.bank.byHand")}
      </p>
      <div className="flex w-full flex-col divide-y divide-foreground/10">
        <CopyRow
          label={t("selfPay.bank.iban")}
          value={bank.iban}
          displayValue={formatAddressGroups(bank.iban)}
        />
        <CopyRow
          label={t("selfPay.bank.amount")}
          value={formatGuestBareAmount(amount, bill, locale)}
          displayValue={formatGuestAmount(amount, bill, locale)}
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
