import { maskFioToken } from "@payky/app-shared/fio-token"
import { deleteFioPluginToken } from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import { fioPluginTokensByPluginIdQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { fioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-utils"
import KeyRound from "lucide-react-native/icons/key-round"
import Trash from "lucide-react-native/icons/trash"
import { EmptyState } from "../../../components/empty-state.tsx"
import {
  SettingsTile,
  SettingsTileList,
} from "../../../components/settings-tile.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * The saved tokens, only ever shown masked (`maskFioToken`), each a
 * `SettingsTile` with a labelled remove that asks first. Web marks every
 * token with an "Active" badge; every saved token is in use, so the badge
 * says nothing and native leaves it out.
 */
export function FioTokenList() {
  const confirmedRun = useConfirmedRun()
  const { t } = useTranslation()
  const { data: tokens } = useEvoluQuery(
    fioPluginTokensByPluginIdQuery(fioPluginId)
  )

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
          <EmptyState
            icon={KeyRound}
            description={t("settings.fioPlugin.tokens.empty")}
          />
        ) : (
          <SettingsTileList>
            {tokens.map((token) => {
              const masked = maskFioToken(token.token)
              return (
                <SettingsTile
                  key={token.id}
                  icon={KeyRound}
                  title={t("settings.fioPlugin.tokens.item")}
                  description={masked}
                  trailing={
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart={Trash}
                      label={t("settings.fioPlugin.tokens.remove")}
                      onPress={() =>
                        void confirmedRun(
                          {
                            title: t(
                              "settings.fioPlugin.tokens.remove.confirm.title"
                            ),
                            description: t(
                              "settings.fioPlugin.tokens.remove.confirm.description",
                              { token: masked }
                            ),
                            confirmLabel: t(
                              "settings.fioPlugin.tokens.remove.confirm.confirm"
                            ),
                            cancelLabel: t(
                              "settings.fioPlugin.tokens.remove.confirm.cancel"
                            ),
                            variant: "destructive",
                          },
                          deleteFioPluginToken(token.id)
                        )
                      }
                    />
                  }
                />
              )
            })}
          </SettingsTileList>
        )}
      </CardContent>
    </Card>
  )
}
