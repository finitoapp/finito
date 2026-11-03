import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { timestampMsDateCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  selectCustomSparkWallet,
  selectDefaultSparkWallet,
  updateSparkAccountSyncPointer,
} from "@payky/core/modules/account/account-actions"
import { sparkAccountQuery } from "@payky/core/modules/account/account-queries"
import { sparkAccountSyncPointerByAccountIdQuery } from "@payky/core/modules/account/account-spark-queries"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { normalizeMnemonic } from "@payky/core/modules/account/account-utils"
import {
  deriveDefaultSparkWalletSecret,
  SparkMnemonicSchema,
  type SparkSecret,
  sparkMnemonicToSecret,
  sparkSecretToMnemonic,
} from "@payky/core/modules/shared/key-derivation"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import { createDefaultSparkPaymentWallet } from "@payky/core/spark/spark-wallet"
import { useAtomValue } from "jotai"
import {
  ArrowUpFromLine,
  ChevronDown,
  KeyRound,
  type LucideIcon,
  Wallet,
} from "lucide-react"
import { Suspense, useEffect, useId, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { OptionToggleGroup } from "@/components/option-toggle-group.tsx"
import { PasswordTextarea } from "@/components/password-textarea.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { VerticalNav } from "@/components/vertical-nav.tsx"
import { InlineEditCheckbox } from "@/features/shared/forms/inline-edit-checkbox.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function SparkAccountSettingsPage() {
  const { t } = useTranslation()
  const mnemonicId = useId()
  const { data: accountData } = useEvoluQuery(sparkAccountQuery)
  const [account] = accountData
  const [privacyMode, setPrivacyMode] = useState(false)
  const [privacyModeError, setPrivacyModeError] =
    useState<TranslationKey | null>(null)
  const [privacyModePending, setPrivacyModePending] = useState(false)

  const { masterKey } = useAtomValue(accountAtom)

  const secret = account?.secret ?? null
  const isDefaultWallet =
    secret === null || secret === deriveDefaultSparkWalletSecret(masterKey)

  useEffect(() => {
    let active = true

    setPrivacyModeError(null)

    if (secret === null) {
      setPrivacyMode(false)
      setPrivacyModePending(false)
      return
    }

    const loadPrivacyMode = async () => {
      setPrivacyModePending(true)

      try {
        await using wallet = await createDefaultSparkPaymentWallet(secret)
        const walletSettings = await wallet.getWalletSettings()

        if (active) {
          setPrivacyMode(walletSettings?.privateEnabled ?? false)
        }
      } catch {
        if (active) {
          setPrivacyModeError("settings.sparkAccount.privacyMode.loadError")
        }
      } finally {
        if (active) {
          setPrivacyModePending(false)
        }
      }
    }

    void loadPrivacyMode()

    return () => {
      active = false
    }
  }, [secret])

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.paymentAccounts.method.spark")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.sparkAccount.form.title")}</CardTitle>
          <CardDescription>
            {t(
              isDefaultWallet
                ? "settings.sparkAccount.form.description"
                : "settings.sparkAccount.form.customDescription"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {secret !== null && (
              <SparkWalletSummary
                secret={secret}
                isDefaultWallet={isDefaultWallet}
              />
            )}

            {secret !== null && (
              <Field>
                <FieldLabel htmlFor={mnemonicId}>
                  {t("settings.sparkAccount.mnemonic.label")}
                </FieldLabel>
                <PasswordTextarea
                  id={mnemonicId}
                  value={sparkSecretToMnemonic(secret)}
                  hideLabel={t("passwordTextarea.hide")}
                  showLabel={t("passwordTextarea.show")}
                  readOnly
                  aria-readonly="true"
                  autoComplete="off"
                />
                <FieldDescription>
                  {t("settings.sparkAccount.mnemonic.description")}
                </FieldDescription>
              </Field>
            )}

            <Collapsible>
              <CollapsibleTrigger className="group/advanced-options flex w-full items-center justify-between text-left text-sm font-medium">
                {t("settings.sparkAccount.advanced")}
                <ChevronDown
                  className="size-4 transition-transform group-data-[panel-open]/advanced-options:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden h-(--collapsible-panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0">
                <div className="min-h-0 pt-5">
                  <FieldGroup>
                    <InlineEditCheckbox
                      label={t("settings.sparkAccount.privacyMode.label")}
                      description={
                        privacyModeError
                          ? t(privacyModeError)
                          : privacyModePending
                            ? t("settings.sparkAccount.privacyMode.loading")
                            : t("settings.sparkAccount.privacyMode.description")
                      }
                      defaultValue={privacyMode}
                      disabled={secret === null || privacyModePending}
                      onSave={async (nextPrivacyMode) => {
                        if (secret === null) return

                        await using wallet =
                          await createDefaultSparkPaymentWallet(secret)
                        const walletSettings =
                          await wallet.setPrivacyEnabled(nextPrivacyMode)

                        if (!walletSettings) {
                          throw new Error("Failed to save Spark privacy mode.")
                        }

                        setPrivacyMode(walletSettings.privateEnabled)
                      }}
                    />

                    {account !== undefined && (
                      // The pointer query is keyed by the account id, so it
                      // first loads when this panel opens or the wallet
                      // changes. Suspending here keeps that to this field
                      // instead of blanking the whole page.
                      <Suspense fallback={null}>
                        <SparkSyncPointerField accountId={account.id} />
                      </Suspense>
                    )}
                  </FieldGroup>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>
        </CardContent>
      </Card>
      {secret !== null && (
        <VerticalNav
          items={[
            {
              kind: "link",
              to: "/settings/payment-accounts/spark/withdrawals",
              icon: <ArrowUpFromLine className="text-muted-foreground" />,
              label: (
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    {t("settings.withdrawals.title")}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {t("settings.withdrawals.description")}
                  </span>
                </span>
              ),
            },
          ]}
        />
      )}
    </>
  )
}

type SparkWalletKind = "payky" | "custom"

const sparkWalletOptions = [
  {
    value: "payky",
    icon: KeyRound,
    title: "settings.sparkAccount.wallet.payky.title",
    description: "settings.sparkAccount.wallet.payky.description",
  },
  {
    value: "custom",
    icon: Wallet,
    title: "settings.sparkAccount.wallet.custom.title",
    description: "settings.sparkAccount.wallet.custom.description",
  },
] as const satisfies ReadonlyArray<{
  readonly value: SparkWalletKind
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly description: TranslationKey
}>

/**
 * Which wallet Spark payments go to, and the one way to change it: a dialog
 * covering every switch — to your own wallet, from one of your own to
 * another, and back to the Payky wallet.
 */
function SparkWalletSummary({
  secret,
  isDefaultWallet,
}: {
  readonly secret: SparkSecret
  readonly isDefaultWallet: boolean
}) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const current = isDefaultWallet
    ? sparkWalletOptions[0]
    : sparkWalletOptions[1]
  const CurrentIcon = current.icon

  return (
    <Field>
      <FieldLabel>{t("settings.sparkAccount.wallet.label")}</FieldLabel>
      <div className="flex items-center gap-4 rounded-lg border px-4 py-3">
        <CurrentIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{t(current.title)}</span>
          <span className="text-xs text-muted-foreground">
            {t(current.description)}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          {t("settings.sparkAccount.wallet.change")}
        </Button>
      </div>
      <ChangeSparkWalletDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentSecret={secret}
        isDefaultWallet={isDefaultWallet}
      />
    </Field>
  )
}

function ChangeSparkWalletDialog({
  open,
  onOpenChange,
  currentSecret,
  isDefaultWallet,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly currentSecret: SparkSecret
  readonly isDefaultWallet: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const mnemonicId = useId()
  // Your own wallet is preselected: changing the wallet most often means
  // bringing a new mnemonic, including when one of your own is active.
  const [target, setTarget] = useState<SparkWalletKind>("custom")
  const [mnemonic, setMnemonic] = useState("")

  const normalized = normalizeMnemonic(mnemonic)
  const wordCount = normalized === "" ? 0 : normalized.split(" ").length
  const parsed = SparkMnemonicSchema.safeParse(normalized)
  const isCurrentMnemonic =
    parsed.success && sparkMnemonicToSecret(parsed.data) === currentSecret
  const mnemonicErrorKey: TranslationKey | null = isCurrentMnemonic
    ? "settings.sparkAccount.wallet.changeDialog.current"
    : !parsed.success && wordCount >= 12
      ? "settings.sparkAccount.wallet.changeDialog.invalid"
      : null
  const canSwitch =
    target === "payky" ? !isDefaultWallet : parsed.success && !isCurrentMnemonic

  const close = () => {
    setTarget("custom")
    setMnemonic("")
    onOpenChange(false)
  }

  const switchWallet = async () => {
    if (!canSwitch) return
    close()

    await runToast(async (run) => {
      if (target === "payky") {
        await run.ok(selectDefaultSparkWallet())
      } else if (parsed.success) {
        await run.ok(selectCustomSparkWallet({ mnemonic: parsed.data }))
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings.sparkAccount.wallet.changeDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.sparkAccount.wallet.changeDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void switchWallet()
          }}
        >
          <OptionToggleGroup<SparkWalletKind>
            value={target}
            options={sparkWalletOptions.map((option) => ({
              value: option.value,
              icon: option.icon,
              title: t(option.title),
              description:
                option.value === "payky" && isDefaultWallet
                  ? t("settings.sparkAccount.wallet.changeDialog.inUse")
                  : t(option.description),
            }))}
            onChange={setTarget}
          />
          {target === "custom" && (
            <Field data-invalid={mnemonicErrorKey !== null}>
              <FieldLabel htmlFor={mnemonicId}>
                {t("settings.sparkAccount.mnemonic.label")}
              </FieldLabel>
              <PasswordTextarea
                id={mnemonicId}
                value={mnemonic}
                hideLabel={t("passwordTextarea.hide")}
                showLabel={t("passwordTextarea.show")}
                aria-invalid={mnemonicErrorKey !== null}
                autoComplete="off"
                onChange={(event) => setMnemonic(event.currentTarget.value)}
              />
              <FieldDescription>
                {t("settings.sparkAccount.wallet.changeDialog.wordCount", {
                  value: wordCount,
                })}
              </FieldDescription>
              <FieldError>
                {mnemonicErrorKey === null ? null : t(mnemonicErrorKey)}
              </FieldError>
            </Field>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("settings.sparkAccount.wallet.warning.invoices")}</li>
            <li>{t("settings.sparkAccount.wallet.warning.funds")}</li>
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t("settings.sparkAccount.wallet.cancel")}
            </Button>
            <Button type="submit" disabled={!canSwitch}>
              {t("settings.sparkAccount.wallet.switch")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Its own component because the pointer is keyed by the Spark account's id,
 * which derives from the wallet secret and so only exists once the account
 * does.
 */
function SparkSyncPointerField({
  accountId,
}: {
  readonly accountId: AccountId
}) {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const { data: pointers } = useEvoluQuery(
    sparkAccountSyncPointerByAccountIdQuery(accountId)
  )
  const [pointer] = pointers

  return (
    <InlineEditField
      label={t("settings.sparkAccount.syncPointer.label")}
      description={t("settings.sparkAccount.syncPointer.description")}
      type="date"
      defaultValue={pointer?.lastSyncedAt ?? TimestampMs(Date.now())}
      codec={timestampMsDateCodec}
      errorKey="settings.sparkAccount.syncPointer.invalid"
      onSave={async (nextLastSyncedAt) => {
        await using run = appRun()
        await run.ok(
          updateSparkAccountSyncPointer({
            id: accountId,
            lastSyncedAt: nextLastSyncedAt,
          })
        )
      }}
    />
  )
}
