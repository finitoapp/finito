import { accountRemovalStep } from "@payky/app-shared/account-removal"
import {
  initialOnboardingFormState,
  onboardingFormAtom,
} from "@payky/app-shared/onboarding-form-state"
import {
  accountListQuery,
  createAccountMasterKey,
  createOrSelectAccount,
  deviceAccountDisplayName,
  removeDeviceAccount,
  selectAccount,
  storableNostrName,
} from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { devicesQuery } from "@payky/core/modules/device/device-queries"
import { router } from "expo-router"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import Check from "lucide-react-native/icons/check"
import Plus from "lucide-react-native/icons/plus"
import Trash from "lucide-react-native/icons/trash"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import {
  evoluCounterAtom,
  reloadAppEvoluAtom,
} from "../../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { appDefaultTransports } from "../../../core/app-brand.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useDeviceEvoluQuery,
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useActiveNostrProfile } from "../../../hooks/use-nostr-profile.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { AccountAvatar } from "../account-avatar.tsx"

/**
 * Settings → Accounts (account/0011): the accounts this device holds, each by
 * its picture and name, the active one marked by its row's tint and the
 * Active badge; switching to one, removing one, and adding another. Adding
 * opens onboarding's welcome in a new, empty account, which onboarding's
 * Cancel setup leaves for the account before it. Switching and removing are
 * governed by the active account's `admin`; the other account's PIN is never
 * asked (access/0002).
 */
export function AccountsSettingsPage() {
  usePreloadEvoluQueries(accountsPageQueries)
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { require } = useRequirePermission()
  const store = useStore()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)
  const reload = useSetAtom(reloadAppEvoluAtom)
  const setOnboardingForm = useSetAtom(onboardingFormAtom)
  const { data: accounts } = useDeviceEvoluQuery(accountListQuery)
  const [settings] = useEvoluQuery(settingsQuery).data
  const { data: devices } = useEvoluQuery(devicesQuery)
  const [busy, setBusy] = useState(false)
  // Only the active account asks relays; the others show the name and picture
  // they last had while active (account/0004, account/0011).
  const activeProfile = useActiveNostrProfile()
  const stale = () => store.get(evoluCounterAtom) !== accountVersion

  const activate = async (accountId: DeviceAccountId) => {
    if (accountId === activeAccount.id || stale()) return
    if (!(await require("admin", "access.action.switchAccount"))) return
    if (stale()) return
    selectAccount(deviceEvolu, accountId)
    reload()
  }

  const remove = async (accountId: DeviceAccountId, name: string) => {
    if (stale()) return
    if (!(await require("admin", "access.action.removeAccount"))) return
    if (stale()) return
    const active = accountId === activeAccount.id
    const step = accountRemovalStep({
      active,
      demo: activeAccount.demo !== null,
      otherDevices: devices.filter(
        (device) => device.id !== activeAccount.device.id
      ).length,
      backupVerified:
        settings?.recoveryPhraseVerifiedAt !== null &&
        settings?.recoveryPhraseVerifiedAt !== undefined,
    })
    if (step === "backupFirst") {
      const backUp = await confirm({
        title: t("settings.accounts.remove.backupFirst.title"),
        description: t("settings.accounts.remove.backupFirst.description", {
          name,
        }),
        confirmLabel: t("settings.accounts.remove.backupFirst.confirm"),
        cancelLabel: t("settings.accounts.remove.confirm.cancel"),
      })
      if (backUp && !stale()) router.push("/settings/security/backup")
      return
    }
    // Confirmed because there is no undo: the row is only soft-deleted and
    // the way back is the recovery phrase, or another device's QR.
    const confirmed = await confirm({
      title: t("settings.accounts.remove.confirm.title", { name }),
      description: t(
        step === "otherDevices"
          ? "settings.accounts.remove.confirm.otherDevices"
          : "settings.accounts.remove.confirm.description"
      ),
      confirmLabel: t("settings.accounts.remove.confirm.confirm"),
      cancelLabel: t("settings.accounts.remove.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed || stale()) return
    removeDeviceAccount(deviceEvolu, accountId)
    if (!active) return
    // The most recently used account left takes over; with none left, a new
    // empty one does, and onboarding starts on its welcome screen.
    setOnboardingForm(initialOnboardingFormState)
    router.replace("/")
    reload()
  }

  const addAccount = async () => {
    if (busy || stale()) return
    setBusy(true)
    try {
      await createOrSelectAccount(deviceEvolu, createAccountMasterKey(), {
        defaultTransports: appDefaultTransports,
      })
      setOnboardingForm(initialOnboardingFormState)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const accountItems = accounts.map((account) => {
    const active = account.id === activeAccount.id
    const name =
      (active ? storableNostrName(activeProfile.data?.name ?? null) : null) ??
      deviceAccountDisplayName(account)
    const picture = active
      ? (activeProfile.data?.picture ?? account.nostrPicture)
      : account.nostrPicture
    return {
      id: account.id,
      kind: "static" as const,
      active,
      icon: <AccountAvatar picture={picture} size={36} />,
      label: (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          numberOfLines={1}
        >
          {name}
        </Text>
      ),
      action: (
        <XStack items="center" gap={4}>
          {active ? (
            <Badge
              variant="secondary"
              label={t("settings.accounts.list.active")}
              icon={Check}
            />
          ) : (
            <Button
              size="sm"
              label={t("settings.accounts.list.switch")}
              variant="outline"
              disabled={busy}
              onPress={() => {
                void activate(account.id)
              }}
            />
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            iconStart={Trash}
            aria-label={t("settings.accounts.list.remove")}
            disabled={busy}
            onPress={() => {
              void remove(account.id, name)
            }}
          />
        </XStack>
      ),
    }
  })

  return (
    <Screen>
      <FadeHeader title={t("settings.accounts.title")} />
      <VerticalNav
        items={[
          ...accountItems,
          {
            id: "add",
            kind: "button",
            icon: <Icon icon={Plus} color="muted-foreground" />,
            label: (
              <RowLabel
                title={t("settings.accounts.add.title")}
                description={t("settings.accounts.add.description")}
              />
            ),
            disabled: busy,
            onPress: () => {
              void addAccount()
            },
          },
        ]}
        testID="account-list"
      />
    </Screen>
  )
}

/** The active account's devices and backup, which removing it reads. */
const accountsPageQueries = [settingsQuery, devicesQuery]

/** A row's `sm` semibold title over its `xs` muted second line. */
function RowLabel({
  title,
  description,
}: {
  /** Both already translated. */
  readonly title: string
  readonly description: string
}) {
  return (
    <YStack gap={4}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {title}
      </Text>
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        color="muted-foreground"
      >
        {description}
      </Text>
    </YStack>
  )
}
