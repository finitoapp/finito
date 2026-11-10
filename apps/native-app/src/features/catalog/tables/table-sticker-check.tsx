import { brandSelfPayOrigins } from "@payky/app-shared/brand"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { deriveTableSelfPayRoot } from "@payky/core/modules/shared/key-derivation"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import {
  checkTableSelfPaySticker,
  type TableSelfPayStickerCheck,
} from "@payky/core/modules/table-self-pay/table-self-pay-sticker-utils"
import { useAtomValue } from "jotai"
import CircleCheck from "lucide-react-native/icons/circle-check"
import ScanLine from "lucide-react-native/icons/scan-line"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { accountAtom } from "../../../atoms/account.ts"
import { ScanCodeScanner } from "../../../components/scan-code-scanner.tsx"
import {
  Alert,
  AlertAction,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { nativeEnv } from "../../../core/native-env.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { useSelfPayRelays } from "../../shared/use-self-pay-relays.ts"

const stickerMessageKeys = {
  current: "catalog.tables.sticker.current",
  earlier: "catalog.tables.sticker.earlier",
  relaysChanged: "catalog.tables.sticker.relaysChanged",
  foreign: "catalog.tables.sticker.foreign",
  notTableCode: "catalog.tables.sticker.notTableCode",
} satisfies Record<TableSelfPayStickerCheck["kind"], TranslationKey>

/** Checks a scanned table sticker, as web's `TableStickerCheck`: the verdict stays until it is dismissed. */
export function TableStickerCheck() {
  const { t } = useTranslation()
  const { masterKey } = useAtomValue(accountAtom)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { addressRelays } = useSelfPayRelays()
  const [scanning, setScanning] = useState(false)
  const [verdict, setVerdict] = useState<TableSelfPayStickerCheck | null>(null)

  const describe = (result: TableSelfPayStickerCheck) =>
    "tableName" in result
      ? t(stickerMessageKeys[result.kind], { name: result.tableName })
      : t(stickerMessageKeys[result.kind])

  return (
    <>
      {verdict !== null && (
        <Alert
          variant={verdict.kind === "current" ? "success" : "warning"}
          icon={verdict.kind === "current" ? CircleCheck : TriangleAlert}
        >
          <AlertTitle numberOfLines={0} testID="table-sticker-verdict">
            {describe(verdict)}
          </AlertTitle>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              label={t("catalog.tables.sticker.dismiss")}
              onPress={() => {
                setVerdict(null)
              }}
            />
          </AlertAction>
        </Alert>
      )}
      <Button
        variant="outline"
        iconStart={ScanLine}
        label={t(
          verdict === null
            ? "catalog.tables.sticker.check"
            : "catalog.tables.sticker.next"
        )}
        onPress={() => {
          setScanning((on) => !on)
        }}
      />
      {scanning ? (
        <ScanCodeScanner
          onScan={(scanned) => {
            setScanning(false)
            setVerdict(
              checkTableSelfPaySticker({
                scanned,
                origins: [
                  nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN,
                  ...brandSelfPayOrigins,
                ],
                addressRelays,
                tables,
                root: deriveTableSelfPayRoot(masterKey),
              })
            )
          }}
        />
      ) : null}
    </>
  )
}
