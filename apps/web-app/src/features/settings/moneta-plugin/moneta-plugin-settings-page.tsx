import { sqliteFalse, sqliteTrue } from "@evolu/common"
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
import { Plug, TriangleAlert, Unplug } from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { PasswordTextarea } from "@/components/password-textarea.tsx"
import { Alert, AlertDescription } from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { ServiceProxyRequiredAlert } from "@/features/settings/privacy/service-proxy-required-alert.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { InlineEditCheckbox } from "@/features/shared/forms/inline-edit-checkbox.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmedRun } from "@/hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useCanReachBanks } from "@/hooks/use-service-proxy.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatAddressGroups } from "@/lib/format-utils.ts"

/**
 * The MONETA plugin (moneta/0009): connect a VIP API token to the fiat bank
 * account, then tune how it syncs. Connecting asks the bank, which a browser
 * reaches only through the service proxy the device allowed
 * (`useCanReachBanks`); without it the page shows but cannot connect.
 */
export function MonetaPluginSettingsPage() {
  const { t } = useTranslation()
  const canReachBanks = useCanReachBanks()
  const [plugin] = useEvoluQuery(fiatBankAccountMonetaPluginQuery).data
  const [account] = useEvoluQuery(fiatBankAccountQuery).data
  const accountIban =
    account !== undefined && isMonetaBankIban(account.iban)
      ? account.iban
      : null

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.monetaPlugin.title")} />
      <div className="flex flex-col gap-5">
        {!canReachBanks ? (
          <ServiceProxyRequiredAlert
            title={t("settings.monetaPlugin.nativeRuntimeWarning.title")}
            description={t(
              "settings.monetaPlugin.nativeRuntimeWarning.description"
            )}
          />
        ) : null}
        {accountIban === null ? (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>
              {t("settings.monetaPlugin.notMonetaIbanWarning")}
            </AlertDescription>
          </Alert>
        ) : null}
        {plugin !== undefined ? (
          <>
            <MonetaPluginConnectedCard
              iban={plugin.iban}
              token={plugin.token}
              accountIban={account?.iban ?? null}
            />
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
            disabled={!canReachBanks}
          />
        ) : null}
      </div>
    </>
  )
}

function MonetaPluginConnectedCard({
  iban,
  token,
  accountIban,
}: {
  readonly iban: Iban
  readonly token: string
  readonly accountIban: Iban | null
}) {
  const { t } = useTranslation()
  const confirmedRun = useConfirmedRun()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.monetaPlugin.connected.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">
            {t("settings.monetaPlugin.connected.iban")}
          </dt>
          <dd className="font-mono">{formatAddressGroups(iban)}</dd>
          <dt className="text-muted-foreground">
            {t("settings.monetaPlugin.connected.token")}
          </dt>
          <dd className="truncate font-mono">{maskMonetaToken(token)}</dd>
        </dl>
        {accountIban !== null && accountIban !== iban ? (
          <p className="flex items-start gap-1.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t("settings.monetaPlugin.connected.ibanMismatch", {
              iban: formatAddressGroups(iban),
            })}
          </p>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void confirmedRun(
              {
                title: t("settings.monetaPlugin.disconnect.confirm.title"),
                description: t(
                  "settings.monetaPlugin.disconnect.confirm.description"
                ),
                confirmLabel: t(
                  "settings.monetaPlugin.disconnect.confirm.confirm"
                ),
                cancelLabel: t(
                  "settings.monetaPlugin.disconnect.confirm.cancel"
                ),
                variant: "destructive",
              },
              disconnectMonetaPlugin()
            )
          }
        >
          <Unplug data-icon="inline-start" />
          {t("settings.monetaPlugin.disconnect.action")}
        </Button>
      </CardFooter>
    </Card>
  )
}

function MonetaPluginSettingsCard({
  isActive,
  numberOfSecondsBetweenChecks,
}: {
  readonly isActive: boolean
  readonly numberOfSecondsBetweenChecks: PositiveInteger
}) {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const [pointer] = useEvoluQuery(
    monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
  ).data
  // Without a pointer the first sync reads from two months back, so that is
  // the date the field shows.
  const lastSyncedDate =
    pointer?.lastSyncedDate ?? monetaFirstSyncStartDate(new Date())

  const save = async (input: {
    readonly isActive?: typeof sqliteTrue | typeof sqliteFalse
    readonly numberOfSecondsBetweenChecks?: PositiveInteger
  }) => {
    await using run = appRun()
    await run.ok(saveMonetaPlugin(input))
  }

  return (
    <Card>
      <CardContent>
        <FieldGroup>
          <InlineEditCheckbox
            label={t("settings.monetaPlugin.active.label")}
            description={t("settings.monetaPlugin.active.description")}
            defaultValue={isActive}
            onSave={(next) =>
              save({ isActive: next ? sqliteTrue : sqliteFalse })
            }
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
            inputMode="numeric"
            defaultValue={numberOfSecondsBetweenChecks}
            codec={monetaCheckIntervalCodec}
            errorKey="settings.monetaPlugin.interval.invalid"
            onSave={(next) => save({ numberOfSecondsBetweenChecks: next })}
          />

          <InlineEditField
            label={t("settings.monetaPlugin.lastSyncedDate.label")}
            description={t("settings.monetaPlugin.lastSyncedDate.description")}
            type="date"
            defaultValue={lastSyncedDate}
            codec={dateCodec}
            errorKey="settings.monetaPlugin.lastSyncedDate.invalid"
            onSave={async (next) => {
              await using run = appRun()
              await run.ok(
                updateMonetaPluginSyncPointer({ lastSyncedDate: next })
              )
            }}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

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
  const { t } = useTranslation()
  const tokenInputId = useId()
  const [token, setToken] = useState("")
  const [tokenError, setTokenError] = useState<TranslationKey | null>(null)
  const [connectError, setConnectError] = useState<MonetaConnectError | null>(
    null
  )
  const { pending, saved, resetSaved, submit } = useSettingsForm()
  const errorMessage =
    tokenError !== null
      ? t(tokenError)
      : connectError !== null
        ? t(monetaConnectErrorKeys[connectError.type], {
            iban: formatAddressGroups(iban),
          })
        : null

  return (
    <FormCard
      title={t(
        isConnected
          ? "settings.monetaPlugin.connect.replaceTitle"
          : "settings.monetaPlugin.connect.title"
      )}
      description={t("settings.monetaPlugin.connect.description")}
      savedMessage={saved ? t("settings.monetaPlugin.connect.saved") : null}
      submitLabel={
        <>
          <Plug data-icon="inline-start" />
          {t("settings.monetaPlugin.connect.submit")}
        </>
      }
      pending={pending || disabled}
      onSubmit={(event) => {
        event.preventDefault()
        setTokenError(null)
        setConnectError(null)
        resetSaved()

        const parsed = parseMonetaToken(token)
        if (!parsed.ok) {
          setTokenError(parsed.errorKey)
          return
        }

        void submit(async () => {
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
            setToken("")
          })
          return connected
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={errorMessage !== null}>
          <FieldLabel htmlFor={tokenInputId}>
            {t("settings.monetaPlugin.token.label")}
          </FieldLabel>
          <PasswordTextarea
            id={tokenInputId}
            value={token}
            hideLabel={t("passwordTextarea.hide")}
            showLabel={t("passwordTextarea.show")}
            disabled={pending || disabled}
            aria-invalid={errorMessage !== null}
            autoComplete="off"
            onChange={(event) => {
              setToken(event.currentTarget.value)
              setTokenError(null)
              setConnectError(null)
              resetSaved()
            }}
          />
          <FieldDescription>{formatAddressGroups(iban)}</FieldDescription>
          <FieldError>{errorMessage}</FieldError>
        </Field>
      </FieldGroup>
    </FormCard>
  )
}
