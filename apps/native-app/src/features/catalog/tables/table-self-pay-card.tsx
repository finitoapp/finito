import type { TranslationKey } from "@payky/app-shared/i18n/resources"
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
import type { GuestsCannotPayReason } from "@payky/core/modules/table-self-pay/table-self-pay-reach-utils"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import ExternalLink from "lucide-react-native/icons/external-link"
import Printer from "lucide-react-native/icons/printer"
import RefreshCw from "lucide-react-native/icons/refresh-cw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { type ComponentRef, useRef } from "react"
import { Linking, View as NativeView } from "react-native"
import { Text, View, XStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { QrCode } from "../../../components/qr-code.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { nativeEnv } from "../../../core/native-env.ts"
import { nativeConsole } from "../../../core/native-runtime.ts"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { printSticker } from "../../../platform/print-sticker"
import { fontSize, fontWeight, radius } from "../../../theme/tokens.ts"
import { useSelfPayRelays } from "../../shared/use-self-pay-relays.ts"
import { useGuestsCannotPayReason } from "./use-guests-cannot-pay-reason.ts"

/** Native counterpart of web's `TableSelfPayCard`. */
export function TableSelfPayCard({
  table,
  onSave,
}: {
  readonly table: TableRow
  readonly onSave: (selfPayEnabled: 0 | 1) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const { masterKey } = useAtomValue(accountAtom)
  const toast = useToast()
  const confirmedRun = useConfirmedRun()
  const { addressRelays } = useSelfPayRelays()
  const keys = deriveTableSelfPayKeys(
    deriveTableSelfPayRoot(masterKey),
    table.id,
    table.selfPayEpoch ?? 0
  )
  const address = createTableSelfPayAddress(
    nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_ORIGIN,
    { ...keys, relays: addressRelays }
  )
  const guestsCannotPayReason = useGuestsCannotPayReason(keys.viewKey)
  const stickerRef = useRef<ComponentRef<typeof NativeView>>(null)
  const selfPay = useInlineChoice(table.selfPayEnabled === 1, (checked) =>
    onSave(checked ? 1 : 0)
  )

  const printTableSticker = async () => {
    try {
      await printSticker(stickerRef, `${table.code}.png`)
    } catch (error) {
      nativeConsole.error("Failed to share the table sticker", error)
      toast.error(t("catalog.tables.selfPay.print.failed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.tables.selfPay.title")}</CardTitle>
        <CardDescription>
          {t("catalog.tables.selfPay.description")}
        </CardDescription>
      </CardHeader>
      <CardContent gap={16}>
        <Field orientation="horizontal">
          <Switch
            aria-label={t("catalog.tables.selfPay.enabled")}
            checked={selfPay.value}
            disabled={selfPay.saving}
            onCheckedChange={(checked) => {
              void selfPay.choose(checked)
            }}
          />
          <FieldContent>
            <FieldLabel>{t("catalog.tables.selfPay.enabled")}</FieldLabel>
            <FieldDescription>
              {t("catalog.tables.selfPay.bankNote")}
            </FieldDescription>
          </FieldContent>
        </Field>
        {table.selfPayEnabled === 1 ? (
          <>
            {guestsCannotPayReason === null ? null : (
              <GuestsCannotPayAlert
                reason={guestsCannotPayReason}
                tableId={table.id}
              />
            )}
            <NativeView
              ref={stickerRef}
              collapsable={false}
              style={{ alignSelf: "center" }}
            >
              <View
                w={224}
                items="center"
                gap={8}
                p={16}
                rounded={radius.xl}
                borderWidth={1}
                borderColor="card-ring"
                style={{ backgroundColor: "#fff" }}
              >
                <View
                  w="100%"
                  aspectRatio={1}
                  accessible
                  role="img"
                  aria-label={t("catalog.tables.selfPay.qr", {
                    name: table.name,
                  })}
                >
                  <QrCode value={address} />
                </View>
                <XStack w="100%" items="baseline" justify="space-between">
                  <Text
                    flexShrink={1}
                    fontSize={fontSize.sm}
                    lineHeight={fontSize.sm}
                    fontWeight={fontWeight.medium}
                    style={{ color: "#000" }}
                  >
                    {table.name}
                  </Text>
                  <Text
                    fontSize={fontSize.sm}
                    lineHeight={fontSize.sm}
                    fontWeight={fontWeight.medium}
                    style={{ color: "#000", fontFamily: "monospace" }}
                  >
                    {table.code}
                  </Text>
                </XStack>
              </View>
            </NativeView>
            <XStack flexWrap="wrap" justify="center" gap={8}>
              <Button
                variant="outline"
                label={t("catalog.tables.selfPay.open")}
                iconStart={ExternalLink}
                onPress={() => {
                  void Linking.openURL(address)
                }}
              />
              <Button
                variant="outline"
                label={t("catalog.tables.selfPay.print")}
                iconStart={Printer}
                onPress={() => {
                  void printTableSticker()
                }}
              />
              <Button
                variant="outline"
                label={t("catalog.tables.selfPay.regenerate")}
                iconStart={RefreshCw}
                onPress={() => {
                  void confirmedRun(
                    {
                      title: t(
                        "catalog.tables.selfPay.regenerate.confirm.title",
                        { name: table.name }
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
              />
            </XStack>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

const guestsCannotPayKeys = {
  noPaymentMethod: {
    title: "catalog.tables.selfPay.noPaymentMethod.title",
    description: "catalog.tables.selfPay.noPaymentMethod.description",
  },
  noRelayAccepted: {
    title: "catalog.tables.selfPay.noRelayAccepted.title",
    description: "catalog.tables.selfPay.noRelayAccepted.description",
  },
} satisfies Record<
  GuestsCannotPayReason,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

function GuestsCannotPayAlert({
  reason,
  tableId,
}: {
  readonly reason: GuestsCannotPayReason
  readonly tableId: TableId
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const keys = guestsCannotPayKeys[reason]

  return (
    <Alert variant="warning" icon={TriangleAlert}>
      <AlertTitle numberOfLines={0}>{t(keys.title)}</AlertTitle>
      <AlertDescription>
        {t(keys.description)}
        {reason === "noPaymentMethod" ? (
          <Button
            variant="link"
            label={t("catalog.tables.selfPay.noPaymentMethod.link")}
            onPress={() => router.push("/settings/payment-accounts")}
          />
        ) : (
          <Button
            variant="outline"
            h={44}
            label={t("catalog.tables.selfPay.noRelayAccepted.retry")}
            iconStart={RefreshCw}
            onPress={() => {
              void runToast(async (run) => {
                await run.ok(requestTableSelfPayPublish(tableId))
              })
            }}
          />
        )}
      </AlertDescription>
    </Alert>
  )
}
