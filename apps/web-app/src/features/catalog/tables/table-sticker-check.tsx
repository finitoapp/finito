import { brandSelfPayOrigins } from "@payky/app-shared/brand"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { deriveTableSelfPayRoot } from "@payky/core/modules/shared/key-derivation"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import {
  checkTableSelfPaySticker,
  type TableSelfPayStickerCheck,
} from "@payky/core/modules/table-self-pay/table-self-pay-sticker-utils"
import { useAtomValue } from "jotai"
import { CircleCheckIcon, ScanLineIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { Alert, AlertAction, AlertTitle } from "@/components/reui/alert.tsx"
import { ScanCodeScannerDialog } from "@/components/scan-code-scanner-dialog.tsx"
import { Button } from "@/components/ui/button.tsx"
import { appEnv } from "@/core/app-env.ts"
import { useSelfPayRelays } from "@/features/shared/use-self-pay-relays.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const stickerMessageKeys = {
  current: "catalog.tables.sticker.current",
  earlier: "catalog.tables.sticker.earlier",
  relaysChanged: "catalog.tables.sticker.relaysChanged",
  foreign: "catalog.tables.sticker.foreign",
  notTableCode: "catalog.tables.sticker.notTableCode",
} satisfies Record<TableSelfPayStickerCheck["kind"], TranslationKey>

export function TableStickerCheck() {
  const { t } = useTranslation()
  const { masterKey } = useAtomValue(accountAtom)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { addressRelays } = useSelfPayRelays()
  const [open, setOpen] = useState(false)
  const [verdict, setVerdict] = useState<TableSelfPayStickerCheck | null>(null)

  const describe = (result: TableSelfPayStickerCheck) =>
    "tableName" in result
      ? t(stickerMessageKeys[result.kind], { name: result.tableName })
      : t(stickerMessageKeys[result.kind])

  return (
    <>
      {verdict !== null && (
        <Alert variant={verdict.kind === "current" ? "success" : "warning"}>
          {verdict.kind === "current" ? (
            <CircleCheckIcon />
          ) : (
            <TriangleAlertIcon />
          )}
          <AlertTitle className="line-clamp-none">
            {describe(verdict)}
          </AlertTitle>
          <AlertAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setVerdict(null)
              }}
            >
              {t("catalog.tables.sticker.dismiss")}
            </Button>
          </AlertAction>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <ScanLineIcon data-icon="inline-start" />
        {t(
          verdict === null
            ? "catalog.tables.sticker.check"
            : "catalog.tables.sticker.next"
        )}
      </Button>
      <ScanCodeScannerDialog
        open={open}
        onOpenChange={setOpen}
        onScan={(scanned) => {
          setVerdict(
            checkTableSelfPaySticker({
              scanned,
              origins: [
                appEnv.VITE_PAYKY_SELF_PAY_ORIGIN,
                ...brandSelfPayOrigins,
              ],
              addressRelays,
              tables,
              root: deriveTableSelfPayRoot(masterKey),
            })
          )
        }}
      />
    </>
  )
}
