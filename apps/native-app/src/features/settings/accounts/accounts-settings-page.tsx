import { formatDateTime } from "@payky/app-shared/format-date"
import {
  accountListQuery,
  createAccountMasterKey,
  createOrSelectAccount,
  removeDeviceAccount,
  selectAccount,
} from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import Check from "lucide-react-native/icons/check"
import KeyRound from "lucide-react-native/icons/key-round"
import MonitorSmartphone from "lucide-react-native/icons/monitor-smartphone"
import Plus from "lucide-react-native/icons/plus"
import QrCode from "lucide-react-native/icons/qr-code"
import Trash from "lucide-react-native/icons/trash"
import { useEffect, useState } from "react"
import { Image } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
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
import { RestoreAccountStep } from "../../shared/restore-account-step.tsx"
import { useRestoreAccount } from "../../shared/use-restore-account.ts"

/**
 * Which accounts this device has and which one is active, plus the ways to
 * add another or open this one elsewhere. Switching and removing are governed
 * by the active account's `admin`; the other account's PIN is never asked
 * (access/0002).
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
  const [restoreOpen, setRestoreOpen] = useState(false)
  // `/pair`'s "restore with the recovery phrase instead" comes back here.
  const { restore } = useLocalSearchParams<{ restore?: string }>()
  useEffect(() => {
    if (restore !== "1") return
    setRestoreOpen(true)
    router.setParams({ restore: undefined })
  }, [restore])
  const restoring = useRestoreAccount("settings")
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
      icon: (
        <AccountAvatar
          name={account.name}
          active={active}
          picture={account.nostrPicture}
        />
      ),
      label: (
        <YStack gap="1">
          <Text
            fontSize="sm"
            lineHeight="sm"
            fontWeight="600"
            numberOfLines={1}
          >
            {account.name}
          </Text>
          <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
            {`${t("settings.accounts.list.createdAt")} ${formatDateTime(new Date(account.createdAt), language)}`}
          </Text>
        </YStack>
      ),
      action: active ? (
        <Badge
          variant="secondary"
          label={t("settings.accounts.list.active")}
          icon={Check}
        />
      ) : (
        <XStack items="center" gap="1">
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
            size="icon-sm"
            aria-label={t("settings.accounts.list.remove")}
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
      <YStack gap={24}>
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
                <YStack gap="1">
                  <Text fontWeight="600">{t("accountChoice.new.title")}</Text>
                  <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                    {t("accountChoice.new.description")}
                  </Text>
                </YStack>
              ),
              disabled: busy,
              onPress: () => {
                void createNew()
              },
            },
            {
              id: "restore",
              kind: "button",
              icon: <Icon icon={KeyRound} color="muted-foreground" />,
              label: (
                <YStack gap="1">
                  <Text fontWeight="600">
                    {t("accountChoice.restore.title")}
                  </Text>
                  <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                    {t("accountChoice.restore.description")}
                  </Text>
                </YStack>
              ),
              disabled: busy || restoring.pending,
              onPress: () => setRestoreOpen((open) => !open),
            },
            {
              id: "transfer",
              kind: "button",
              icon: <Icon icon={QrCode} color="muted-foreground" />,
              label: (
                <YStack gap="1">
                  <Text fontWeight="600">
                    {t("accountChoice.transfer.title")}
                  </Text>
                  <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                    {t("accountChoice.transfer.description")}
                  </Text>
                </YStack>
              ),
              disabled: busy,
              onPress: () => {
                router.push("/pair")
              },
            },
          ]}
        />
        {restoreOpen ? (
          <RestoreAccountStep
            error={restoring.error}
            pending={restoring.pending}
            onRestore={(phrase) => {
              if (stale()) return
              void restoring.restore(phrase)
            }}
          />
        ) : null}

        <VerticalNav
          title={t("settings.accounts.elsewhere.title")}
          items={[
            {
              kind: "button",
              icon: <Icon icon={MonitorSmartphone} color="muted-foreground" />,
              label: (
                <YStack gap="1">
                  <Text fontWeight="600">
                    {t("accountTransfer.settings.source.title")}
                  </Text>
                  <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                    {t("accountTransfer.settings.source.description")}
                  </Text>
                </YStack>
              ),
              disabled: busy,
              onPress: () => router.push("/settings/access/add-device"),
            },
          ]}
        />
      </YStack>
    </Screen>
  )
}

/** The last published picture, or the account's initial when unavailable. */
function AccountAvatar({
  name,
  active,
  picture,
}: {
  readonly name: string
  readonly active: boolean
  readonly picture: string | null
}) {
  const theme = useTheme()
  const [failedPicture, setFailedPicture] = useState<string | null>(null)

  if (picture !== null && picture !== failedPicture) {
    return (
      <Image
        source={{ uri: picture }}
        accessibilityIgnoresInvertColors
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.muted.val,
        }}
        onError={() => setFailedPicture(picture)}
      />
    )
  }

  return (
    <YStack
      w={36}
      h={36}
      shrink={0}
      rounded="full"
      items="center"
      justify="center"
      bg={active ? "primary" : "muted"}
      aria-hidden
    >
      <Text
        fontWeight="600"
        color={active ? "primary-foreground" : "muted-foreground"}
        textTransform="uppercase"
      >
        {name.slice(0, 1)}
      </Text>
    </YStack>
  )
}
