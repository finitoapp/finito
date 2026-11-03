import { maskFioToken } from "@payky/app-shared/fio-token"
import { deleteFioPluginToken } from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import { fioPluginTokensByPluginIdQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import type { FioPluginTokenId } from "@payky/core/modules/fio-plugin/fio-plugin-types"
import { fioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-utils"
import Trash from "lucide-react-native/icons/trash"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/** The saved tokens, only ever shown masked (`maskFioToken`). */
export function FioTokenList() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const { data: tokens } = useEvoluQuery(
    fioPluginTokensByPluginIdQuery(fioPluginId)
  )
  const [pendingTokenId, setPendingTokenId] = useState<FioPluginTokenId | null>(
    null
  )

  const remove = async (id: FioPluginTokenId) => {
    setPendingTokenId(id)
    await runToast(async (run) => {
      await run.ok(deleteFioPluginToken(id))
    })
    setPendingTokenId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.fioPlugin.tokens.title")}</CardTitle>
        <CardDescription>
          {t("settings.fioPlugin.tokens.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tokens.length === 0 ? (
          <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
            {t("settings.fioPlugin.tokens.empty")}
          </Text>
        ) : (
          <YStack gap="3">
            {tokens.map((token) => (
              <XStack
                key={token.id}
                items="center"
                gap="2"
                p="3"
                rounded="lg"
                bg="neutral-soft"
              >
                <YStack flex={1} gap="1">
                  <Text fontWeight="600">
                    {t("settings.fioPlugin.tokens.item")}
                  </Text>
                  <Text
                    fontSize={13}
                    color="muted-foreground"
                    numberOfLines={1}
                  >
                    {maskFioToken(token.token)}
                  </Text>
                </YStack>
                <Badge
                  variant="secondary"
                  label={t("settings.fioPlugin.tokens.active")}
                />
                <Button
                  size="sm"
                  iconStart={Trash}
                  label={t("settings.fioPlugin.tokens.remove")}
                  variant="outline"
                  pending={pendingTokenId === token.id}
                  disabled={pendingTokenId !== null}
                  onPress={() => {
                    void remove(token.id)
                  }}
                />
              </XStack>
            ))}
          </YStack>
        )}
      </CardContent>
    </Card>
  )
}
