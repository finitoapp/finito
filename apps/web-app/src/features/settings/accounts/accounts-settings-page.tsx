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
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue, useSetAtom } from "jotai"
import { Check, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  VerticalNavRow,
  verticalNavShellClassName,
} from "@/components/vertical-nav.tsx"
import { appDefaultTransports } from "@/core/app-brand.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useActiveNostrProfile } from "@/hooks/use-nostr-profile.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/**
 * Settings → Accounts (account/0011): the accounts this device holds, each by
 * its picture and name, the active one marked; switching to one, removing
 * one, and adding another. Adding opens onboarding's welcome in a new, empty
 * account, which onboarding's Cancel setup leaves for the account before it.
 * Switching and removing are governed by the active account's `admin`; the
 * other account's PIN is never asked (access/0002).
 */
export function AccountsSettingsPage() {
  usePreloadEvoluQueries(accountsPageQueries)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const setOnboardingForm = useSetAtom(onboardingFormAtom)
  const confirm = useConfirmDialog()
  const { require } = useRequirePermission()
  const { data: accounts } = useDeviceEvoluQuery(accountListQuery)
  const [settings] = useEvoluQuery(settingsQuery).data
  const { data: devices } = useEvoluQuery(devicesQuery)
  const [busy, setBusy] = useState(false)
  // Only the active account asks relays; the others show the name and picture
  // they last had while active (account/0004, account/0011).
  const activeProfile = useActiveNostrProfile()

  const activateAccount = async (accountId: DeviceAccountId) => {
    if (accountId === activeAccount.id) return
    if (!(await require("admin", "access.action.switchAccount"))) return
    selectAccount(deviceEvolu, accountId)
    reloadAppEvolu()
  }

  const removeAccount = async (accountId: DeviceAccountId, name: string) => {
    if (!(await require("admin", "access.action.removeAccount"))) return
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
      if (backUp) void navigate({ to: "/settings/security/backup" })
      return
    }

    // Confirmed because there is no undo: the row is only soft-deleted, every
    // query filters it out, and the only way back is the recovery phrase or
    // another device's QR.
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
    if (!confirmed) return
    removeDeviceAccount(deviceEvolu, accountId)
    if (!active) return
    // The most recently used account left takes over; with none left, a new
    // empty one does, and onboarding starts on its welcome screen.
    setOnboardingForm(initialOnboardingFormState)
    void navigate({ to: "/" })
    reloadAppEvolu()
  }

  const addAccount = async () => {
    setBusy(true)
    try {
      await createOrSelectAccount(deviceEvolu, createAccountMasterKey(), {
        defaultTransports: appDefaultTransports,
      })
      setOnboardingForm(initialOnboardingFormState)
      reloadAppEvolu()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.accounts.title")} />
      <div className={verticalNavShellClassName} data-testid="account-list">
        {/* A real list, one item per account, with the add row below it. */}
        <ul className="divide-y">
          {accounts.map((account) => {
            const active = account.id === activeAccount.id
            const name =
              (active
                ? storableNostrName(activeProfile.data?.name ?? null)
                : null) ?? deviceAccountDisplayName(account)

            return (
              <li
                key={account.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  active && "bg-primary/5"
                )}
              >
                <AccountAvatar
                  name={name}
                  active={active}
                  picture={
                    active
                      ? (activeProfile.data?.picture ?? account.nostrPicture)
                      : account.nostrPicture
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {name}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {active ? (
                    <Badge variant="secondary">
                      <Check data-icon="inline-start" />
                      {t("settings.accounts.list.active")}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void activateAccount(account.id)}
                    >
                      {t("settings.accounts.list.switch")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t("settings.accounts.list.remove")}
                    onClick={() => {
                      void removeAccount(account.id, name)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
        <div className="border-t">
          <VerticalNavRow
            item={{
              kind: "button",
              onClick: busy ? undefined : () => void addAccount(),
              icon: <Plus className="text-muted-foreground" />,
              label: (
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    {t("settings.accounts.add.title")}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {t("settings.accounts.add.description")}
                  </span>
                </span>
              ),
            }}
          />
        </div>
      </div>
    </>
  )
}

/** The active account's devices and backup, which removing it reads. */
const accountsPageQueries = [settingsQuery, devicesQuery]

/**
 * The account's Nostr picture, or its initial when it has none, it is still
 * loading or the image fails to load.
 */
function AccountAvatar({
  name,
  active,
  picture,
}: {
  readonly name: string
  readonly active: boolean
  readonly picture: string | null
}) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null)

  if (picture !== null && picture !== failedPicture) {
    return (
      <img
        src={picture}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          "size-9 shrink-0 rounded-full bg-muted object-cover",
          active && "ring-2 ring-primary"
        )}
        onError={() => setFailedPicture(picture)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full font-semibold uppercase",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {name.slice(0, 1)}
    </span>
  )
}
