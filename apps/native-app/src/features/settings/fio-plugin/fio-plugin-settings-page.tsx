import { sqliteFalse, sqliteTrue } from "@evolu/common"
import {
  dateCodec,
  positiveIntegerCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import { legacyFiatBankAccountId } from "@payky/core/modules/account/account-utils"
import {
  saveFioPlugin,
  updateFioPluginSyncPointer,
} from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import {
  fiatBankAccountFioPluginQuery,
  fioPluginSyncPointerByPluginIdQuery,
} from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { fioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-utils"
import {
  type DateString,
  DateStringSchema,
  PositiveInteger,
} from "@payky/core/modules/shared/schema"
import { format, subDays } from "date-fns"
import { YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { useAccess } from "../../../core/use-access.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useCanReachBanks } from "../../../hooks/use-service-proxy.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { ServiceProxyRequiredAlert } from "../privacy/service-proxy-required-alert.tsx"
import { FioTokenForm } from "./fio-token-form.tsx"
import { FioTokenList } from "./fio-token-list.tsx"

const defaultNumberOfSecondsBetweenChecks = 30
const defaultSyncLookbackDays = 1
const getDefaultLastSyncedDate = (): DateString =>
  DateStringSchema.decode(format(subDays(new Date(), 1), "yyyy-MM-dd"))

/**
 * The FIO bank plugin, as web's `FioPluginSettingsPage`. Each setting writes
 * on its own; tokens are a separate form and list, reachable whether or not
 * the plugin row exists. The app's web build reaches the bank only through
 * the service proxy, so until the device allows it there it shows the
 * runtime warning, which leads to the privacy settings, and cannot turn the
 * sync on.
 */
export function FioPluginSettingsPage() {
  const { accountId } = useAccess()
  return <FioPluginSettings key={accountId} />
}

function FioPluginSettings() {
  const { t } = useTranslation()
  const canReachBank = useCanReachBanks()

  return (
    <Screen>
      <FadeHeader title={t("settings.fioPlugin.title")} />
      {canReachBank ? null : (
        <ServiceProxyRequiredAlert
          title={t("settings.fioPlugin.nativeRuntimeWarning.title")}
          description={t("settings.fioPlugin.nativeRuntimeWarning.description")}
        />
      )}
      <FioPluginForm canReachBank={canReachBank} />
      <FioTokenForm />
      <FioTokenList />
    </Screen>
  )
}

function FioPluginForm({
  canReachBank,
}: {
  /** Without it the sync cannot run here, so it cannot be turned on. */
  readonly canReachBank: boolean
}) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [plugin] = useEvoluQuery(fiatBankAccountFioPluginQuery).data
  const [pointer] = useEvoluQuery(
    fioPluginSyncPointerByPluginIdQuery(fioPluginId)
  ).data
  const [bankAccount] = useEvoluQuery(fiatBankAccountQuery).data
  const lastSyncedDate = pointer?.lastSyncedDate ?? getDefaultLastSyncedDate()

  const isActive = plugin?.isActive === sqliteTrue
  const numberOfSecondsBetweenChecks = PositiveInteger(
    plugin?.numberOfSecondsBetweenChecks ?? defaultNumberOfSecondsBetweenChecks
  )
  const syncLookbackDays = PositiveInteger(
    plugin?.syncLookbackDays ?? defaultSyncLookbackDays
  )

  /**
   * `saveFioPlugin` upserts the whole row, so a partial save would reset the
   * fields it leaves out. Each control sends the current settings with its
   * own field replaced.
   */
  const savePlugin = (changed: {
    readonly isActive?: boolean
    readonly numberOfSecondsBetweenChecks?: PositiveInteger
    readonly syncLookbackDays?: PositiveInteger
  }) =>
    runToast(async (run) => {
      await run.ok(
        saveFioPlugin({
          // With no bank account yet, the plugin waits on the placeholder id
          // until `saveFiatBankAccount` points it at the real one.
          accountId: bankAccount?.id ?? legacyFiatBankAccountId,
          numberOfSecondsBetweenChecks:
            changed.numberOfSecondsBetweenChecks ??
            numberOfSecondsBetweenChecks,
          syncLookbackDays: changed.syncLookbackDays ?? syncLookbackDays,
          isActive: (changed.isActive ?? isActive) ? sqliteTrue : sqliteFalse,
        })
      )
    })

  const activeChoice = useInlineChoice(isActive, (next) =>
    savePlugin({ isActive: next })
  )

  return (
    <YStack gap="3">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fioPlugin.form.title")}</CardTitle>
          <CardDescription>
            {t("settings.fioPlugin.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <Switch
                aria-label={t("settings.fioPlugin.active.label")}
                checked={activeChoice.value}
                disabled={activeChoice.saving || !canReachBank}
                onCheckedChange={(next) => {
                  void activeChoice.choose(next)
                }}
              />
              <YStack flex={1} gap="1">
                <FieldLabel>{t("settings.fioPlugin.active.label")}</FieldLabel>
                <FieldDescription>
                  {t("settings.fioPlugin.active.description")}
                </FieldDescription>
              </YStack>
            </Field>

            <InlineEditField
              label={t("settings.fioPlugin.interval.label")}
              description={t("settings.fioPlugin.interval.description")}
              keyboardType="number-pad"
              defaultValue={numberOfSecondsBetweenChecks}
              codec={positiveIntegerCodec}
              errorKey="settings.fioPlugin.interval.invalid"
              onSave={(next) =>
                savePlugin({ numberOfSecondsBetweenChecks: next })
              }
            />

            <InlineEditField
              label={t("settings.fioPlugin.syncLookbackDays.label")}
              description={t("settings.fioPlugin.syncLookbackDays.description")}
              keyboardType="number-pad"
              defaultValue={syncLookbackDays}
              codec={positiveIntegerCodec}
              errorKey="settings.fioPlugin.syncLookbackDays.invalid"
              onSave={(next) => savePlugin({ syncLookbackDays: next })}
            />

            <InlineEditField
              label={t("settings.fioPlugin.lastSyncedDate.label")}
              description={t("settings.fioPlugin.lastSyncedDate.description")}
              placeholder="yyyy-MM-dd"
              keyboardType="numbers-and-punctuation"
              defaultValue={lastSyncedDate}
              codec={dateCodec}
              errorKey="settings.fioPlugin.lastSyncedDate.invalid"
              onSave={(next) =>
                runToast(async (run) => {
                  await run.ok(
                    updateFioPluginSyncPointer({
                      id: fioPluginId,
                      lastSyncedDate: next,
                    })
                  )
                })
              }
            />
          </FieldGroup>
        </CardContent>
      </Card>
    </YStack>
  )
}
