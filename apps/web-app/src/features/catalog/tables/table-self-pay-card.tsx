import { Capacitor } from "@capacitor/core"
import {
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
} from "@payky/core/modules/shared/key-derivation"
import type { TableRow } from "@payky/core/modules/table/table"
import {
  regenerateTableSelfPayQr,
  requestTableSelfPayPublish,
} from "@payky/core/modules/table/table-actions"
import type { TableId } from "@payky/core/modules/table/table-types"
import { createTableSelfPayAddress } from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import { Link } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
  ExternalLinkIcon,
  PrinterIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useRef } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Button, buttonVariants } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { appEnv } from "@/core/app-env.ts"
import { renderTableStickerPng } from "@/features/catalog/tables/table-sticker-png.ts"
import {
  useBankAccountIsOn,
  useGuestsCannotPayReason,
} from "@/features/catalog/tables/use-guests-cannot-pay-reason.ts"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useSelfPayRelays } from "@/features/shared/use-self-pay-relays.ts"
import { useConfirmedRun } from "@/hooks/use-confirmed-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { sharePngImage } from "@/platform/share-image.ts"

export function TableSelfPayCard({
  table,
  onSave,
}: {
  readonly table: TableRow
  readonly onSave: (selfPayEnabled: 0 | 1) => Promise<void>
}) {
  const { t } = useTranslation()
  const { masterKey } = useAtomValue(accountAtom)
  const console = useConsole()
  const confirmedRun = useConfirmedRun()
  const { addressRelays } = useSelfPayRelays()
  const keys = deriveTableSelfPayKeys(
    deriveTableSelfPayRoot(masterKey),
    table.id,
    table.selfPayEpoch ?? 0
  )
  const address = createTableSelfPayAddress(appEnv.VITE_PAYKY_SELF_PAY_ORIGIN, {
    ...keys,
    relays: addressRelays,
  })
  const guestsCannotPayReason = useGuestsCannotPayReason(keys.viewKey)
  const qrRef = useRef<SVGSVGElement>(null)

  const printSticker = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.print()
      return
    }

    const qr = qrRef.current
    if (qr === null) {
      return
    }
    try {
      await sharePngImage({
        filename: `${table.code}.png`,
        base64Png: await renderTableStickerPng({
          qr,
          heading: t("catalog.tables.selfPay.scanToPay"),
          name: table.name,
          code: table.code,
        }),
      })
    } catch (error) {
      console.error("Failed to share the table sticker", error)
      toast.error(t("catalog.tables.selfPay.print.failed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPay.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InlineEditSwitch
          label={t("catalog.tables.selfPay.enabled")}
          description={t("catalog.tables.selfPay.enabled.description")}
          defaultValue={table.selfPayEnabled === 1}
          onSave={(checked) => onSave(checked ? 1 : 0)}
        />
        {table.selfPayEnabled === 1 ? (
          <>
            {guestsCannotPayReason === "noPaymentMethod" ? (
              <NoPaymentMethodAlert
                title={t("catalog.tables.selfPay.noPaymentMethod.title")}
              />
            ) : null}
            {guestsCannotPayReason === "noRelayAccepted" ? (
              <NoRelayAcceptedAlert tableId={table.id} />
            ) : null}
            <figure className="self-pay-sticker mx-auto flex w-56 flex-col items-center gap-2 rounded-xl bg-white p-4 text-black ring-1 ring-foreground/10">
              <p className="text-base font-semibold">
                {t("catalog.tables.selfPay.scanToPay")}
              </p>
              <QRCodeSVG
                ref={qrRef}
                value={address}
                className="size-full"
                role="img"
                aria-label={t("catalog.tables.selfPay.qr", {
                  name: table.name,
                })}
              />
              <figcaption className="flex w-full items-baseline justify-between text-sm font-medium">
                <span>{table.name}</span>
                <span className="font-mono">{table.code}</span>
              </figcaption>
            </figure>
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href={address}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                {t("catalog.tables.selfPay.open")}
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void printSticker()
                }}
              >
                <PrinterIcon data-icon="inline-start" />
                {t("catalog.tables.selfPay.print")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void confirmedRun(
                    {
                      title: t(
                        "catalog.tables.selfPay.regenerate.confirm.title",
                        {
                          name: table.name,
                        }
                      ),
                      description: t(
                        "catalog.tables.selfPay.regenerate.confirm.description"
                      ),
                      confirmLabel: t(
                        "catalog.tables.selfPay.regenerate.confirm.confirm"
                      ),
                      cancelLabel: t(
                        "catalog.tables.selfPay.regenerate.confirm.cancel"
                      ),
                    },
                    regenerateTableSelfPayQr(table)
                  )
                }}
              >
                <RefreshCwIcon data-icon="inline-start" />
                {t("catalog.tables.selfPay.regenerate")}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function NoPaymentMethodAlert({ title }: { readonly title: string }) {
  const { t } = useTranslation()
  const bankAccountIsOn = useBankAccountIsOn()

  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertTitle className="line-clamp-none">{title}</AlertTitle>
      <AlertDescription>
        <p>{t("catalog.tables.selfPay.noPaymentMethod.description")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/settings/payment-accounts"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("catalog.tables.selfPay.noPaymentMethod.link")}
          </Link>
          {bankAccountIsOn && (
            <Link
              to="/settings/payment-accounts/iban"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("catalog.tables.selfPay.noPaymentMethod.bankLink")}
            </Link>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

function NoRelayAcceptedAlert({ tableId }: { readonly tableId: TableId }) {
  const { t } = useTranslation()
  const runToast = useRunToast()

  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertTitle className="line-clamp-none">
        {t("catalog.tables.selfPay.noRelayAccepted.title")}
      </AlertTitle>
      <AlertDescription>
        <p>{t("catalog.tables.selfPay.noRelayAccepted.description")}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => {
              void runToast(async (run) => {
                await run.ok(requestTableSelfPayPublish(tableId))
              })
            }}
          >
            <RefreshCwIcon data-icon="inline-start" />
            {t("catalog.tables.selfPay.noRelayAccepted.retry")}
          </Button>
          <Link
            to="/settings/security"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("catalog.tables.selfPay.noRelayAccepted.link")}
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  )
}
