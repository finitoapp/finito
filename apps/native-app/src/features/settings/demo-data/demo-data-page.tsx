import { insertDemoAccount } from "@payky/core/evolu/device-account"
import { runMutationWithCompletion } from "@payky/core/modules/shared/evolu-utils"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { router } from "expo-router"
import { useAtomValue, useSetAtom } from "jotai"
import DatabaseZap from "lucide-react-native/icons/database-zap"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import { reloadAppEvoluAtom } from "../../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { appDefaultTransports } from "../../../core/app-brand.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"

/**
 * Creates a demo account and switches to it; `DemoDataSeed` then fills it
 * with its fictional history (demo-data/0001). Existing accounts are never
 * written to, and the demo account never syncs.
 */
export function DemoDataPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const confirm = useConfirm()
  const runToast = useRunToast()
  const [pending, setPending] = useState(false)
  const accountName = t("settings.demoData.accountName")

  const create = async () => {
    if (pending) return
    const confirmed = await confirm({
      title: t("settings.demoData.confirm.title"),
      description: t("settings.demoData.confirm.description"),
      confirmLabel: t("settings.demoData.confirm.confirm"),
      cancelLabel: t("settings.demoData.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    setPending(true)
    await runToast(async () => {
      await runMutationWithCompletion((options) =>
        insertDemoAccount(
          deviceEvolu,
          NonEmptyString255(accountName),
          appDefaultTransports,
          options
        )
      )
      reloadAppEvolu()
      router.replace("/")
      return undefined
    })
    setPending(false)
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.demoData.title")} />
      <YStack gap={20}>
        {account.demo === null ? null : (
          <Alert variant="info" icon={DatabaseZap}>
            <AlertTitle>{t("settings.demoData.current.title")}</AlertTitle>
            <AlertDescription>
              {t("settings.demoData.current.description")}
            </AlertDescription>
          </Alert>
        )}
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertTitle>{t("settings.demoData.warning.title")}</AlertTitle>
          <AlertDescription>
            <YStack gap={8} pl={20}>
              {(
                [
                  t("settings.demoData.warning.newAccount", {
                    name: accountName,
                  }),
                  t("settings.demoData.warning.irreversible"),
                  t("settings.demoData.warning.relays"),
                  t("settings.demoData.warning.services"),
                  t("settings.demoData.warning.duration"),
                ] as const
              ).map((item, index) => (
                <Text
                  key={item}
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                  // Web's <strong> around the relays item.
                  fontWeight={index === 2 ? fontWeight.bold : fontWeight.normal}
                >
                  {`• ${item}`}
                </Text>
              ))}
            </YStack>
          </AlertDescription>
        </Alert>
        <Button
          size="lg"
          label={t(
            pending
              ? "settings.demoData.action.pending"
              : "settings.demoData.action"
          )}
          variant="destructive"
          pending={pending}
          onPress={() => {
            void create()
          }}
        />
      </YStack>
    </Screen>
  )
}
