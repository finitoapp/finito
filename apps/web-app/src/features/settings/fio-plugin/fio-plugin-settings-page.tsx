import { Capacitor } from "@capacitor/core"
import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { maskFioToken, parseFioToken } from "@payky/app-shared/fio-token"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  dateCodec,
  positiveIntegerCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import { legacyFiatBankAccountId } from "@payky/core/modules/account/account-utils"
import {
  addFioPluginToken,
  deleteFioPluginToken,
  saveFioPlugin,
  updateFioPluginSyncPointer,
} from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import {
  fiatBankAccountFioPluginQuery,
  fioPluginSyncPointerByPluginIdQuery,
  fioPluginTokensByPluginIdQuery,
} from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import type { FioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-types"
import { fioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-utils"
import {
  type DateString,
  DateStringSchema,
  PositiveInteger,
} from "@payky/core/modules/shared/schema"
import { format, subDays } from "date-fns"
import { Plus, Trash2, TriangleAlert } from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { PasswordTextarea } from "@/components/password-textarea.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
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
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { InlineEditCheckbox } from "@/features/shared/forms/inline-edit-checkbox.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const defaultNumberOfSecondsBetweenChecks = 30
const defaultSyncLookbackDays = 1
const getDefaultLastSyncedDate = (): DateString =>
  DateStringSchema.decode(format(subDays(new Date(), 1), "yyyy-MM-dd"))

export function FioPluginSettingsPage() {
  const { t } = useTranslation()
  const isNativeRuntime = Capacitor.isNativePlatform()
  const { data } = useEvoluQuery(fiatBankAccountFioPluginQuery)
  const [plugin] = data

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.fioPlugin.title")} />
      <div className="flex flex-col gap-5">
        {!isNativeRuntime ? <FioPluginNativeRuntimeAlert /> : null}
        <FioPluginForm plugin={plugin} isNativeRuntime={isNativeRuntime} />
        {/*
         * Tokens are reachable whether or not the `fioPlugin` row exists —
         * they hang off the fixed `fioPluginId`, and `activeFioPluginsQuery`
         * inner-joins the plugin, so tokens saved first simply sit unused
         * until it is enabled. Keeping these mounted unconditionally also
         * means no query key appears mid-session, which is what used to make
         * their first render suspend on a promise React cannot cache.
         */}
        <FioPluginTokenForm fioPluginId={fioPluginId} />
        <FioPluginTokenList fioPluginId={fioPluginId} />
      </div>
    </>
  )
}

interface FioPluginFormProps {
  readonly isNativeRuntime: boolean
  readonly plugin:
    | {
        readonly id: FioPluginId
        readonly isActive: 0 | 1
        readonly numberOfSecondsBetweenChecks: number
        readonly syncLookbackDays: number | null
      }
    | undefined
}

function FioPluginNativeRuntimeAlert() {
  const { t } = useTranslation()

  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>
        {t("settings.fioPlugin.nativeRuntimeWarning.title")}
      </AlertTitle>
      <AlertDescription>
        {t("settings.fioPlugin.nativeRuntimeWarning.description")}
      </AlertDescription>
    </Alert>
  )
}

function FioPluginForm({ plugin, isNativeRuntime }: FioPluginFormProps) {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const pointerQuery = fioPluginSyncPointerByPluginIdQuery(fioPluginId)
  const { data: pointers } = useEvoluQuery(pointerQuery)
  const { data: bankAccounts } = useEvoluQuery(fiatBankAccountQuery)
  const [bankAccount] = bankAccounts
  const [pointer] = pointers
  const lastSyncedDate = pointer?.lastSyncedDate ?? getDefaultLastSyncedDate()

  const isActive = isNativeRuntime && plugin?.isActive === sqliteTrue
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
  const savePlugin = async (changed: {
    readonly isActive?: boolean
    readonly numberOfSecondsBetweenChecks?: PositiveInteger
    readonly syncLookbackDays?: PositiveInteger
  }) => {
    await using run = appRun()
    await run.ok(
      saveFioPlugin({
        // With no bank account yet, the plugin waits on the placeholder id
        // until `saveFiatBankAccount` points it at the real one.
        accountId: bankAccount?.id ?? legacyFiatBankAccountId,
        numberOfSecondsBetweenChecks:
          changed.numberOfSecondsBetweenChecks ?? numberOfSecondsBetweenChecks,
        syncLookbackDays: changed.syncLookbackDays ?? syncLookbackDays,
        isActive:
          (changed.isActive ?? plugin?.isActive === sqliteTrue)
            ? sqliteTrue
            : sqliteFalse,
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.fioPlugin.form.title")}</CardTitle>
        <CardDescription>
          {t("settings.fioPlugin.form.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <InlineEditCheckbox
            label={t("settings.fioPlugin.active.label")}
            description={t("settings.fioPlugin.active.description")}
            defaultValue={isActive}
            disabled={!isNativeRuntime}
            onSave={(nextIsActive) => savePlugin({ isActive: nextIsActive })}
          />

          <InlineEditField
            label={t("settings.fioPlugin.interval.label")}
            description={t("settings.fioPlugin.interval.description")}
            inputMode="numeric"
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
            inputMode="numeric"
            defaultValue={syncLookbackDays}
            codec={positiveIntegerCodec}
            errorKey="settings.fioPlugin.syncLookbackDays.invalid"
            onSave={(next) => savePlugin({ syncLookbackDays: next })}
          />

          <InlineEditField
            label={t("settings.fioPlugin.lastSyncedDate.label")}
            description={t("settings.fioPlugin.lastSyncedDate.description")}
            type="date"
            defaultValue={lastSyncedDate}
            codec={dateCodec}
            errorKey="settings.fioPlugin.lastSyncedDate.invalid"
            onSave={async (nextLastSyncedDate) => {
              await using run = appRun()
              await run.ok(
                updateFioPluginSyncPointer({
                  id: fioPluginId,
                  lastSyncedDate: nextLastSyncedDate,
                })
              )
            }}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

interface FioPluginTokenListProps {
  readonly fioPluginId: FioPluginId
}

/**
 * Adding a token is its own form on purpose. It used to be a field on the
 * basic-settings form, which meant every save wrote the token again: saving
 * without touching it appended a duplicate row, and changing it left the old
 * one in the sync job's rotation set, so the job kept retrying a revoked
 * token. See `addFioPluginToken`.
 */
function FioPluginTokenForm({ fioPluginId }: FioPluginTokenListProps) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const tokenInputId = useId()
  const [token, setToken] = useState("")
  const [tokenError, setTokenError] = useState<TranslationKey | null>(null)
  const { pending, saved, resetSaved, submit } = useSettingsForm()

  return (
    <FormCard
      title={t("settings.fioPlugin.tokens.add.title")}
      description={t("settings.fioPlugin.tokens.add.description")}
      savedMessage={saved ? t("settings.fioPlugin.tokens.add.saved") : null}
      submitLabel={
        <>
          <Plus data-icon="inline-start" />
          {t("settings.fioPlugin.tokens.add.submit")}
        </>
      }
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault()
        setTokenError(null)
        resetSaved()

        const tokenResult = parseFioToken(token)
        if (!tokenResult.ok) {
          setTokenError(tokenResult.errorKey)
          return
        }

        void submit(() =>
          runToast(async (run) => {
            await run.ok(
              addFioPluginToken({ fioPluginId, token: tokenResult.token })
            )
            setToken("")
          })
        )
      }}
    >
      <FieldGroup>
        <Field data-invalid={tokenError !== null}>
          <FieldLabel htmlFor={tokenInputId}>
            {t("settings.fioPlugin.token.label")}
          </FieldLabel>
          <PasswordTextarea
            id={tokenInputId}
            value={token}
            hideLabel={t("passwordTextarea.hide")}
            showLabel={t("passwordTextarea.show")}
            disabled={pending}
            aria-invalid={tokenError !== null}
            autoComplete="off"
            onChange={(event) => {
              setToken(event.currentTarget.value)
              setTokenError(null)
              resetSaved()
            }}
          />
          <FieldDescription>
            {t("settings.fioPlugin.token.description")}
          </FieldDescription>
          <FieldError>{tokenError ? t(tokenError) : null}</FieldError>
        </Field>
      </FieldGroup>
    </FormCard>
  )
}

function FioPluginTokenList({ fioPluginId }: FioPluginTokenListProps) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const tokensQuery = fioPluginTokensByPluginIdQuery(fioPluginId)
  const { data: tokens } = useEvoluQuery(tokensQuery)
  const [pendingTokenId, setPendingTokenId] = useState<string | null>(null)

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
          <p className="text-sm text-muted-foreground">
            {t("settings.fioPlugin.tokens.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t("settings.fioPlugin.tokens.item")}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {maskFioToken(token.token)}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {t("settings.fioPlugin.tokens.active")}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingTokenId !== null}
                    onClick={async () => {
                      setPendingTokenId(token.id)
                      await runToast(async (run) => {
                        await run.ok(deleteFioPluginToken(token.id))
                      })
                      setPendingTokenId(null)
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    {t("settings.fioPlugin.tokens.remove")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
