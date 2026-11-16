import { brandName, paykyBrand } from "@payky/app-shared/brand"
import { formatDateTime } from "@payky/app-shared/format-date"
import {
  accountListQuery,
  createAccountMasterKey,
  createOrSelectAccount,
  removeDeviceAccount,
  selectAccount,
} from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { router } from "expo-router"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import Check from "lucide-react-native/icons/check"
import LogIn from "lucide-react-native/icons/log-in"
import MonitorSmartphone from "lucide-react-native/icons/monitor-smartphone"
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
import { useDeviceEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { useCanRequestAccountFromPayky } from "../../shared/use-can-request-account-from-payky.ts"
import { AccountAvatar } from "../account-avatar.tsx"

/**
 * Which accounts this device has and which one is active, plus the ways to
 * add another or open this one elsewhere. Switching and removing are governed
 * by the active account's `admin`; the other account's PIN is never asked
 * (access/0002). Each account shows its picture (`AccountAvatar`); the active
 * one is marked by its row's tint and the Active badge.
 */
export function AccountsSettingsPage() {
  const { language, t } = useTranslation()
  const confirm = useConfirm()
  const { require } = useRequirePermission()
  const store = useStore()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)
  const reload = useSetAtom(reloadAppEvoluAtom)
  const { data: accounts } = useDeviceEvoluQuery(accountListQuery)
  const [busy, setBusy] = useState(false)
  // The row names Payky only when the chooser will offer it (account/0008).
  const canRequestFromPayky = useCanRequestAccountFromPayky()
  const sourceApp = brandName(paykyBrand)
  const stale = () => store.get(evoluCounterAtom) !== accountVersion

  const activate = async (accountId: DeviceAccountId) => {
    if (accountId === activeAccount.id || stale()) return
    if (!(await require("admin", "access.action.switchAccount"))) return
    if (stale()) return
    selectAccount(deviceEvolu, accountId)
    reload()
  }

  const remove = async (accountId: DeviceAccountId, name: string) => {
    if (accountId === activeAccount.id || stale()) return
    if (!(await require("admin", "access.action.removeAccount"))) return
    // Confirmed because there is no undo: the row is only soft-deleted and
    // the way back is re-entering the recovery phrase.
    const confirmed = await confirm({
      title: t("settings.accounts.remove.confirm.title", { name }),
      description: t("settings.accounts.remove.confirm.description"),
      confirmLabel: t("settings.accounts.remove.confirm.confirm"),
      cancelLabel: t("settings.accounts.remove.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed || stale()) return
    removeDeviceAccount(deviceEvolu, accountId)
  }

  const createNew = async () => {
    if (busy || stale()) return
    const confirmed = await confirm({
      title: t("settings.accounts.create.confirm.title"),
      description: t("settings.accounts.create.confirm.description", {
        name: activeAccount.name,
      }),
      confirmLabel: t("settings.accounts.create.confirm.confirm"),
      cancelLabel: t("settings.accounts.create.confirm.cancel"),
    })
    if (!confirmed || stale()) return
    setBusy(true)
    try {
      await createOrSelectAccount(deviceEvolu, createAccountMasterKey(), {
        defaultTransports: appDefaultTransports,
      })
      reload()
    } finally {
      setBusy(false)
    }
  }

  const accountItems = accounts.map((account) => {
    const active = account.id === activeAccount.id
    return {
      id: account.id,
      kind: "static" as const,
      active,
      icon: <AccountAvatar picture={account.nostrPicture} size={36} />,
      label: (
        <RowLabel
          title={account.name}
          description={`${t("settings.accounts.list.createdAt")} ${formatDateTime(new Date(account.createdAt), language)}`}
        />
      ),
      action: active ? (
        <Badge
          variant="secondary"
          label={t("settings.accounts.list.active")}
          icon={Check}
        />
      ) : (
        <XStack items="center" gap={4}>
          <Button
            size="sm"
            label={t("settings.accounts.list.switch")}
            variant="outline"
            disabled={busy}
            onPress={() => {
              void activate(account.id)
            }}
          />
          <Button
            size="sm"
            label={t("settings.accounts.list.remove")}
            variant="ghost"
            iconStart={Trash}
            disabled={busy}
            onPress={() => {
              void remove(account.id, account.name)
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
        title={t("settings.accounts.list.title")}
        items={accountItems}
        empty={t("settings.accounts.list.empty")}
        testID="account-list"
      />

      <VerticalNav
        title={t("settings.accounts.add.title")}
        items={[
          {
            id: "new",
            kind: "button",
            icon: <Icon icon={Plus} color="muted-foreground" />,
            label: (
              <RowLabel
                title={t("accountChoice.new.title")}
                description={t("accountChoice.new.description")}
              />
            ),
            disabled: busy,
            onPress: () => {
              void createNew()
            },
          },
          {
            id: "existing",
            kind: "button",
            icon: <Icon icon={LogIn} color="muted-foreground" />,
            label: (
              <RowLabel
                title={t("accountChoice.existing.title")}
                description={
                  canRequestFromPayky
                    ? t("accountChoice.existing.descriptionWithPayky", {
                        sourceApp,
                      })
                    : t("accountChoice.existing.description")
                }
              />
            ),
            disabled: busy,
            // The chooser of onboarding/0011, as onboarding shows it.
            onPress: () => router.push("/settings/accounts/open"),
          },
        ]}
      />

      <VerticalNav
        title={t("settings.accounts.elsewhere.title")}
        items={[
          {
            kind: "button",
            icon: <Icon icon={MonitorSmartphone} color="muted-foreground" />,
            label: (
              <RowLabel
                title={t("accountTransfer.settings.source.title")}
                description={t("accountTransfer.settings.source.description")}
              />
            ),
            disabled: busy,
            onPress: () => router.push("/settings/access/add-device"),
          },
        ]}
      />
    </Screen>
  )
}

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
