import { useAtomValue } from "jotai"
import { Text, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { TransportAddForm } from "../../shared/evolu-transports/transport-add-form.tsx"
import { TransportToggleList } from "../../shared/evolu-transports/transport-toggle-list.tsx"
import { RecoveryBackupCard } from "./recovery-backup-card.tsx"

/** Recovery phrase and Evolu sync transports of the active account, like web's Security & Sync. */
export function SecuritySettingsPage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)
  const isDemo = account.demo !== null

  return (
    <Screen>
      <FadeHeader title={t("settings.security.title")} />
      <RecoveryBackupCard key={account.id} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.security.transports.title")}</CardTitle>
          <CardDescription>
            {t("settings.security.transports.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <YStack gap={20}>
            {isDemo ? (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("settings.security.transports.demo")}
              </Text>
            ) : null}
            <TransportToggleList
              key={account.id}
              accountId={account.id}
              disabled={isDemo}
            />
            {isDemo ? null : <TransportAddForm accountId={account.id} />}
          </YStack>
        </CardContent>
        <CardFooter>
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
          >
            {t("settings.security.transports.footer")}
          </Text>
        </CardFooter>
      </Card>
    </Screen>
  )
}
