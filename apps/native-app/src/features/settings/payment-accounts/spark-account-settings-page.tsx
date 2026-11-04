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
  type MasterKey,
  SparkMnemonicSchema,
  type SparkSecret,
  sparkMnemonicToSecret,
  sparkSecretToMnemonic,
} from "@payky/core/modules/shared/key-derivation"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import { createDefaultSparkPaymentWallet } from "@payky/core/spark/spark-wallet"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right"
import Clock3 from "lucide-react-native/icons/clock-3"
import KeyRound from "lucide-react-native/icons/key-round"
import ReceiptText from "lucide-react-native/icons/receipt-text"
import Wallet from "lucide-react-native/icons/wallet"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { OptionToggleGroup } from "../../../components/option-toggle-group.tsx"
import { PasswordTextarea } from "../../../components/password-textarea.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx"
import {
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Field as UiField,
} from "../../../components/ui/field.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useAccess } from "../../../core/use-access.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { BitcoinBalance } from "../../shared/bitcoin-amount.tsx"
import { useSparkBalance } from "../../shared/use-spark-balance.ts"

const privacyModeQueryKey = (
  activeAccountId: string,
  sparkAccountId: AccountId
) => ["spark-account-privacy-mode", activeAccountId, sparkAccountId] as const

export function SparkAccountSettingsPage() {
  const { t } = useTranslation()
  return (
    <Screen>
      <FadeHeader title={t("settings.bitcoin.wallet.spark")} />
      <SparkAccountSettingsBody />
    </Screen>
  )
}

/** The page's content, also the Bitcoin screen's Spark half (settings/0002). */
export function SparkAccountSettingsBody() {
  const { accountId } = useAccess()
  return <SparkAccountSettings key={accountId} activeAccountId={accountId} />
}

function SparkAccountSettings({
  activeAccountId,
}: {
  readonly activeAccountId: string
}) {
  const { masterKey } = useAtomValue(accountAtom)
  const { data } = useEvoluQuery(sparkAccountQuery)
  const [account] = data

  return (
    <SparkAccountSettingsContent
      key={account?.id ?? "no-spark-account"}
      accountId={account?.id}
      secret={account?.secret ?? null}
      masterKey={masterKey}
      activeAccountId={activeAccountId}
    />
  )
}

function SparkAccountSettingsContent({
  accountId,
  secret,
  masterKey,
  activeAccountId,
}: {
  readonly accountId: AccountId | undefined
  readonly secret: SparkSecret | null
  readonly masterKey: MasterKey
  readonly activeAccountId: string
}) {
  const { t } = useTranslation()
  const isDefaultWallet =
    secret === null || secret === deriveDefaultSparkWalletSecret(masterKey)

  return (
    <>
      {accountId === undefined ? null : (
        <SparkWalletBalance accountId={accountId} />
      )}
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
            {secret === null || accountId === undefined ? null : (
              <SparkWalletSummary
                key={accountId}
                secret={secret}
                isDefaultWallet={isDefaultWallet}
              />
            )}

            {secret === null ? null : (
              <UiField>
                <FieldLabel>
                  {t("settings.sparkAccount.mnemonic.label")}
                </FieldLabel>
                <PasswordTextarea
                  value={sparkSecretToMnemonic(secret)}
                  hideLabel={t("passwordTextarea.hide")}
                  showLabel={t("passwordTextarea.show")}
                  disabled
                  contextMenuHidden
                />
                <FieldDescription>
                  {t("settings.sparkAccount.mnemonic.description")}
                </FieldDescription>
              </UiField>
            )}

            <Collapsible>
              <CollapsibleTrigger>
                <AdvancedSettingsLabel
                  label={t("settings.sparkAccount.advanced")}
                />
              </CollapsibleTrigger>
              <CollapsibleContent pt="4">
                <FieldGroup>
                  {secret === null || accountId === undefined ? null : (
                    <SparkPrivacyMode
                      key={`${accountId}:privacy`}
                      activeAccountId={activeAccountId}
                      sparkAccountId={accountId}
                      secret={secret}
                    />
                  )}
                  {accountId === undefined ? null : (
                    <SparkSyncPointerField
                      key={accountId}
                      accountId={accountId}
                    />
                  )}
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}

/**
 * Fazole's wallet screen for the Spark wallet, as the Linky wallet's: the
 * balance alone, "Withdraw funds" while there is anything to withdraw, then
 * the rows for the withdrawals and the wallet's transactions.
 */
function SparkWalletBalance({ accountId }: { readonly accountId: AccountId }) {
  const { t } = useTranslation()
  const balance = useSparkBalance(accountId)
  return (
    <YStack gap={24}>
      <YStack py={16}>
        <BitcoinBalance sats={balance ?? 0} testID="spark-balance" />
      </YStack>
      {balance !== null && balance > 0 ? (
        <Button
          size="lg"
          iconStart={ArrowUpRight}
          label={t("settings.cashuAccount.withdraw")}
          testID="spark-withdraw"
          onPress={() => router.push("/withdraw/new")}
        />
      ) : null}
      <VerticalNav
        items={[
          {
            kind: "link",
            href: "/withdraw",
            icon: <Icon icon={Clock3} color="muted-foreground" />,
            label: t("settings.withdrawals.title"),
          },
          {
            kind: "link",
            href: "/settings/payment-accounts/spark/transactions",
            icon: <Icon icon={ReceiptText} color="muted-foreground" />,
            label: t("withdraw.transactions.title"),
          },
        ]}
      />
    </YStack>
  )
}

function SparkWalletSummary({
  secret,
  isDefaultWallet,
}: {
  readonly secret: SparkSecret
  readonly isDefaultWallet: boolean
}) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const WalletIcon = isDefaultWallet ? KeyRound : Wallet
  const currentTitle = t(
    isDefaultWallet
      ? "settings.sparkAccount.wallet.payky.title"
      : "settings.sparkAccount.wallet.custom.title"
  )
  const currentDescription = t(
    isDefaultWallet
      ? "settings.sparkAccount.wallet.payky.description"
      : "settings.sparkAccount.wallet.custom.description"
  )

  return (
    <UiField>
      <FieldLabel>{t("settings.sparkAccount.wallet.label")}</FieldLabel>
      <XStack items="center" gap="3" p="3" rounded="lg" bg="neutral-soft">
        <Icon icon={WalletIcon} color="muted-foreground" />
        <YStack flex={1} gap="1">
          <Text fontWeight="600">{currentTitle}</Text>
          <Text fontSize={13} color="muted-foreground">
            {currentDescription}
          </Text>
        </YStack>
        <Button
          size="sm"
          label={t("settings.sparkAccount.wallet.change")}
          variant="outline"
          onPress={() => setDialogOpen(true)}
        />
      </XStack>

      <ChangeSparkWalletModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        currentSecret={secret}
        isDefaultWallet={isDefaultWallet}
      />
    </UiField>
  )
}

type SparkWalletKind = "payky" | "custom"

function ChangeSparkWalletModal({
  open,
  onClose,
  currentSecret,
  isDefaultWallet,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly currentSecret: SparkSecret
  readonly isDefaultWallet: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
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
    onClose()
  }

  const switchWallet = async () => {
    if (!canSwitch) return
    const selectedTarget = target
    const selectedMnemonic = parsed.success ? parsed.data : null
    close()

    await runToast(async (run) => {
      if (selectedTarget === "payky") {
        await run.ok(selectDefaultSparkWallet())
      } else if (selectedMnemonic !== null) {
        await run.ok(selectCustomSparkWallet({ mnemonic: selectedMnemonic }))
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
        <YStack gap="4">
          <OptionToggleGroup<SparkWalletKind>
            value={target}
            options={[
              {
                value: "payky",
                icon: KeyRound,
                title: t("settings.sparkAccount.wallet.payky.title"),
                description: t(
                  isDefaultWallet
                    ? "settings.sparkAccount.wallet.changeDialog.inUse"
                    : "settings.sparkAccount.wallet.payky.description"
                ),
              },
              {
                value: "custom",
                icon: Wallet,
                title: t("settings.sparkAccount.wallet.custom.title"),
                description: t(
                  "settings.sparkAccount.wallet.custom.description"
                ),
              },
            ]}
            onChange={setTarget}
          />

          {target === "custom" ? (
            <UiField>
              <FieldLabel>
                {t("settings.sparkAccount.mnemonic.label")}
              </FieldLabel>
              <PasswordTextarea
                key={open ? "open" : "closed"}
                value={mnemonic}
                hideLabel={t("passwordTextarea.hide")}
                showLabel={t("passwordTextarea.show")}
                invalid={mnemonicErrorKey !== null}
                contextMenuHidden
                onChangeText={setMnemonic}
              />
              <FieldDescription>
                {t("settings.sparkAccount.wallet.changeDialog.wordCount", {
                  value: wordCount,
                })}
              </FieldDescription>
              <FieldError>
                {mnemonicErrorKey === null ? undefined : t(mnemonicErrorKey)}
              </FieldError>
            </UiField>
          ) : null}

          <YStack gap="2">
            <Text color="muted-foreground">
              {`• ${t("settings.sparkAccount.wallet.warning.invoices")}`}
            </Text>
            <Text color="muted-foreground">
              {`• ${t("settings.sparkAccount.wallet.warning.funds")}`}
            </Text>
          </YStack>
        </YStack>
        <DialogFooter>
          <Button
            size="lg"
            w="100%"
            label={t("settings.sparkAccount.wallet.cancel")}
            variant="outline"
            onPress={close}
          />
          <Button
            size="lg"
            w="100%"
            label={t("settings.sparkAccount.wallet.switch")}
            disabled={!canSwitch}
            onPress={() => void switchWallet()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdvancedSettingsLabel({ label }: { readonly label: string }) {
  return (
    <XStack items="center" justify="space-between" w="100%">
      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
        {label}
      </Text>
      <CollapsibleChevron color="muted-foreground" />
    </XStack>
  )
}

function SparkPrivacyMode({
  activeAccountId,
  sparkAccountId,
  secret,
}: {
  readonly activeAccountId: string
  readonly sparkAccountId: AccountId
  readonly secret: SparkSecret
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const queryKey = privacyModeQueryKey(activeAccountId, sparkAccountId)
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      await using wallet = await createDefaultSparkPaymentWallet(secret)
      return (await wallet.getWalletSettings())?.privateEnabled ?? false
    },
  })
  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await using wallet = await createDefaultSparkPaymentWallet(secret)
      const settings = await wallet.setPrivacyEnabled(enabled)
      if (!settings) throw new Error("Failed to save Spark privacy mode.")
      return settings.privateEnabled
    },
    onSuccess: async (privateEnabled) => {
      await queryClient.cancelQueries({ queryKey, exact: true })
      queryClient.setQueryData(queryKey, privateEnabled)
    },
    onError: () => toast.error(t("app.saveFailed")),
  })
  const privacyMode = query.data ?? false
  const choice = useInlineChoice(privacyMode, async (enabled) => {
    try {
      await mutation.mutateAsync(enabled)
      return true
    } catch {
      return false
    }
  })
  const description = query.isError
    ? t("settings.sparkAccount.privacyMode.loadError")
    : query.isPending
      ? t("settings.sparkAccount.privacyMode.loading")
      : t("settings.sparkAccount.privacyMode.description")

  return (
    <YStack gap="2">
      <XStack gap="3" items="center">
        <Switch
          aria-label={t("settings.sparkAccount.privacyMode.label")}
          checked={choice.value}
          disabled={query.isPending || query.isError || mutation.isPending}
          onCheckedChange={(next) => {
            void choice.choose(next)
          }}
        />
        <YStack flex={1}>
          <Text fontWeight="600">
            {t("settings.sparkAccount.privacyMode.label")}
          </Text>
          <Text fontSize={13} color="muted-foreground">
            {description}
          </Text>
        </YStack>
      </XStack>
    </YStack>
  )
}

function SparkSyncPointerField({
  accountId,
}: {
  readonly accountId: AccountId
}) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const { data: pointers } = useEvoluQuery(
    sparkAccountSyncPointerByAccountIdQuery(accountId)
  )
  const [pointer] = pointers

  return (
    <InlineEditField
      label={t("settings.sparkAccount.syncPointer.label")}
      description={t("settings.sparkAccount.syncPointer.description")}
      placeholder="yyyy-MM-dd"
      keyboardType="numbers-and-punctuation"
      defaultValue={pointer?.lastSyncedAt ?? TimestampMs(Date.now())}
      codec={timestampMsDateCodec}
      errorKey="settings.sparkAccount.syncPointer.invalid"
      onSave={(nextLastSyncedAt) =>
        runToast(async (run) => {
          await run.ok(
            updateSparkAccountSyncPointer({
              id: accountId,
              lastSyncedAt: nextLastSyncedAt,
            })
          )
        })
      }
    />
  )
}
