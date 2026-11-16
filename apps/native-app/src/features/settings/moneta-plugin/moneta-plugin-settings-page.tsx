import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { formatAddressGroups } from "@payky/app-shared/format-text"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { dateCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  monetaCheckIntervalCodec,
  monetaConnectErrorKeys,
  parseMonetaToken,
} from "@payky/app-shared/moneta-plugin-form"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import {
  connectMonetaPlugin,
  disconnectMonetaPlugin,
  type MonetaConnectError,
  saveMonetaPlugin,
  updateMonetaPluginSyncPointer,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import {
  fiatBankAccountMonetaPluginQuery,
  monetaPluginSyncPointerByPluginIdQuery,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import {
  defaultMonetaPluginCheckIntervalSeconds,
  estimateMonetaDailyCalls,
  MONETA_DAILY_CALL_LIMIT,
  maskMonetaToken,
  monetaFirstSyncStartDate,
  monetaPluginId,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-utils"
import { isMonetaBankIban } from "@payky/core/modules/shared/iban-utils"
import type { Iban, PositiveInteger } from "@payky/core/modules/shared/schema"
import Plug from "lucide-react-native/icons/plug"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import Unplug from "lucide-react-native/icons/unplug"
import { useState } from "react"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { PasswordTextarea } from "../../../components/password-textarea.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { useAccess } from "../../../core/use-access.ts"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useCanReachBanks } from "../../../hooks/use-service-proxy.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { ServiceProxyRequiredAlert } from "../privacy/service-proxy-required-alert.tsx"

/**
 * The MONETA plugin (moneta/0009), as web's `MonetaPluginSettingsPage`:
 * connect a VIP API token to the fiat bank account, then tune how it syncs.
 * The app's web build reaches the bank only through the service proxy, so
 * until the device allows it there it shows the runtime warning, which
 * leads to the privacy settings, and cannot connect. Disconnecting deletes
 * the screen's subject, so it is the full-width destructive button under the
 * cards rather than web's outline button in the connected card's footer.
 */
export function MonetaPluginSettingsPage() {
  const { accountId } = useAccess()
  return <MonetaPluginSettings key={accountId} />
}

function MonetaPluginSettings() {
  const { t } = useTranslation()
  const canReachBank = useCanReachBanks()
  const [plugin] = useEvoluQuery(fiatBankAccountMonetaPluginQuery).data
  const [account] = useEvoluQuery(fiatBankAccountQuery).data
  const accountIban =
    account !== undefined && isMonetaBankIban(account.iban)
      ? account.iban
      : null

  return (
    <Screen>
      <FadeHeader title={t("settings.monetaPlugin.title")} />
      {canReachBank ? null : (
        <ServiceProxyRequiredAlert
          title={t("settings.monetaPlugin.nativeRuntimeWarning.title")}
          description={t(
            "settings.monetaPlugin.nativeRuntimeWarning.description"
          )}
        />
      )}
      {accountIban === null ? (
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertDescription>
            {t("settings.monetaPlugin.notMonetaIbanWarning")}
          </AlertDescription>
        </Alert>
      ) : null}
      {plugin !== undefined &&
      account !== undefined &&
      account.iban !== plugin.iban ? (
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertDescription>
            {t("settings.monetaPlugin.connected.ibanMismatch", {
              iban: formatAddressGroups(plugin.iban),
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {plugin !== undefined ? (
        <>
          <MonetaPluginConnectedCard iban={plugin.iban} token={plugin.token} />
          <MonetaPluginSettingsCard
            isActive={plugin.isActive === sqliteTrue}
            numberOfSecondsBetweenChecks={plugin.numberOfSecondsBetweenChecks}
          />
        </>
      ) : null}
      {account !== undefined && accountIban !== null ? (
        <MonetaPluginConnectForm
          accountId={account.id}
          iban={accountIban}
          isConnected={plugin !== undefined}
          disabled={!canReachBank}
        />
      ) : null}
      {plugin !== undefined ? <MonetaPluginDisconnectButton /> : null}
    </Screen>
  )
}

function MonetaPluginConnectedCard({
  iban,
  token,
}: {
  readonly iban: Iban
  readonly token: string
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.monetaPlugin.connected.title")}</CardTitle>
      </CardHeader>
      <CardContent gap={8}>
        <DetailRow
          label={t("settings.monetaPlugin.connected.iban")}
          value={formatAddressGroups(iban)}
        />
        <DetailRow
          label={t("settings.monetaPlugin.connected.token")}
          value={maskMonetaToken(token)}
        />
      </CardContent>
    </Card>
  )
}

function MonetaPluginDisconnectButton() {
  const { t } = useTranslation()
  const confirmedRun = useConfirmedRun()

  return (
    <Button
      variant="destructive"
      iconStart={Unplug}
      label={t("settings.monetaPlugin.disconnect.action")}
      onPress={() =>
        void confirmedRun(
          {
            title: t("settings.monetaPlugin.disconnect.confirm.title"),
            description: t(
              "settings.monetaPlugin.disconnect.confirm.description"
            ),
            confirmLabel: t("settings.monetaPlugin.disconnect.confirm.confirm"),
            cancelLabel: t("settings.monetaPlugin.disconnect.confirm.cancel"),
            variant: "destructive",
          },
          disconnectMonetaPlugin()
        )
      }
    />
  )
}

function MonetaPluginSettingsCard({
  isActive,
  numberOfSecondsBetweenChecks,
}: {
  readonly isActive: boolean
  readonly numberOfSecondsBetweenChecks: PositiveInteger
}) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [pointer] = useEvoluQuery(
    monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
  ).data
  // Without a pointer the first sync reads from two months back, so that is
  // the date the field shows.
  const lastSyncedDate =
    pointer?.lastSyncedDate ?? monetaFirstSyncStartDate(new Date())

  const save = (input: {
    readonly isActive?: typeof sqliteTrue | typeof sqliteFalse
    readonly numberOfSecondsBetweenChecks?: PositiveInteger
  }) =>
    runToast(async (run) => {
      await run.ok(saveMonetaPlugin(input))
    })

  const activeChoice = useInlineChoice(isActive, (next) =>
    save({ isActive: next ? sqliteTrue : sqliteFalse })
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.monetaPlugin.settings.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SwitchRow
            label={t("settings.monetaPlugin.active.label")}
            description={t("settings.monetaPlugin.active.description")}
            checked={activeChoice.value}
            disabled={activeChoice.saving}
            onCheckedChange={(next) => {
              void activeChoice.choose(next)
            }}
          />

          <InlineEditField
            label={t("settings.monetaPlugin.interval.label")}
            description={
              numberOfSecondsBetweenChecks <
              defaultMonetaPluginCheckIntervalSeconds
                ? t("settings.monetaPlugin.interval.estimate", {
                    calls: estimateMonetaDailyCalls(
                      numberOfSecondsBetweenChecks
                    ),
                    limit: MONETA_DAILY_CALL_LIMIT,
                  })
                : t("settings.monetaPlugin.interval.description")
            }
            keyboardType="number-pad"
            defaultValue={numberOfSecondsBetweenChecks}
            codec={monetaCheckIntervalCodec}
            errorKey="settings.monetaPlugin.interval.invalid"
            onSave={(next) => save({ numberOfSecondsBetweenChecks: next })}
          />

          <InlineEditField
            label={t("settings.monetaPlugin.lastSyncedDate.label")}
            description={t("settings.monetaPlugin.lastSyncedDate.description")}
            placeholder="yyyy-MM-dd"
            keyboardType="numbers-and-punctuation"
            defaultValue={lastSyncedDate}
            codec={dateCodec}
            errorKey="settings.monetaPlugin.lastSyncedDate.invalid"
            onSave={(next) =>
              runToast(async (run) => {
                await run.ok(
                  updateMonetaPluginSyncPointer({ lastSyncedDate: next })
                )
              })
            }
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

/**
 * The token lives in this component's state only, is entered with secure
 * text entry, and is cleared once connected, as Fio's.
 */
function MonetaPluginConnectForm({
  accountId,
  iban,
  isConnected,
  disabled,
}: {
  readonly accountId: AccountId
  readonly iban: Iban
  readonly isConnected: boolean
  readonly disabled: boolean
}) {
  const runToast = useRunToast()
  const toast = useToast()
  const { t } = useTranslation()
  const [token, setToken] = useState("")
  const [revealed, setRevealed] = useState(false)
  const [tokenError, setTokenError] = useState<TranslationKey | null>(null)
  const [connectError, setConnectError] = useState<MonetaConnectError | null>(
    null
  )
  const [pending, setPending] = useState(false)
  const errorMessage =
    tokenError !== null
      ? t(tokenError)
      : connectError !== null
        ? t(monetaConnectErrorKeys[connectError.type], {
            iban: formatAddressGroups(iban),
          })
        : undefined

  const submit = async () => {
    setTokenError(null)
    setConnectError(null)
    const parsed = parseMonetaToken(token)
    if (!parsed.ok) {
      setTokenError(parsed.errorKey)
      return
    }
    setPending(true)
    let connected = false
    await runToast(async (run) => {
      const result = await run(
        connectMonetaPlugin({ accountId, iban, token: parsed.token })
      )
      if (!result.ok) {
        setConnectError(result.error)
        return
      }
      connected = true
    })
    setPending(false)
    if (!connected) return
    setToken("")
    setRevealed(false)
    toast.success(t("settings.monetaPlugin.connect.saved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t(
            isConnected
              ? "settings.monetaPlugin.connect.replaceTitle"
              : "settings.monetaPlugin.connect.title"
          )}
        </CardTitle>
        <CardDescription>
          {t("settings.monetaPlugin.connect.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("settings.monetaPlugin.token.label")}</FieldLabel>
            <PasswordTextarea
              shown={revealed}
              onShownChange={setRevealed}
              value={token}
              hideLabel={t("passwordTextarea.hide")}
              showLabel={t("passwordTextarea.show")}
              disabled={pending || disabled}
              invalid={errorMessage !== undefined}
              contextMenuHidden
              onChangeText={(text) => {
                setToken(text)
                setTokenError(null)
                setConnectError(null)
              }}
            />
            <FieldDescription>{formatAddressGroups(iban)}</FieldDescription>
            <FieldError>{errorMessage}</FieldError>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter justify="flex-end">
        <Button
          iconStart={Plug}
          label={t("settings.monetaPlugin.connect.submit")}
          pending={pending}
          disabled={disabled}
          onPress={() => void submit()}
        />
      </CardFooter>
    </Card>
  )
}
