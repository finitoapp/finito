import { restoredAccountAtom } from "@payky/app-shared/restored-account"
import { createOrSelectAccount } from "@payky/core/evolu/device-account"
import type { TransferPayload } from "@payky/core/integrations/nostr/nostr-account-transfer"
import { router } from "expo-router"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import {
  evoluCounterAtom,
  reloadAppEvoluAtom,
} from "../../atoms/evolu-counter.ts"
import { appDefaultTransports } from "../../core/app-brand.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * Adds an account another device or app handed over — the QR transfer
 * (account/0001) and the request to Payky (account/0008) — and continues on
 * `/restore-account`. A device that already has an account asks for `admin`
 * and a confirmation first; an account switch meanwhile drops the payload.
 * Resolves `false` when nothing was added.
 */
export function useAddTransferredAccount({
  source,
  confirmBeforeAdding,
}: {
  readonly source: "onboarding" | "settings"
  readonly confirmBeforeAdding: boolean
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const toast = useToast()
  const { require } = useRequirePermission()
  const store = useStore()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const setRestoredAccount = useSetAtom(restoredAccountAtom)

  return async (payload: TransferPayload): Promise<boolean> => {
    const stale = () => store.get(evoluCounterAtom) !== accountVersion
    if (stale()) return false
    if (confirmBeforeAdding) {
      if (!(await require("admin", "accountTransfer.target.confirm.confirm"))) {
        return false
      }
      const confirmed = await confirm({
        title: t("accountTransfer.target.confirm.title", {
          name: payload.accountName,
        }),
        description: t("accountTransfer.target.confirm.description", {
          name: payload.accountName,
        }),
        confirmLabel: t("accountTransfer.target.confirm.confirm"),
        cancelLabel: t("accountTransfer.target.confirm.cancel"),
      })
      if (!confirmed || stale()) return false
    }

    const previous = activeAccount.id
    const { created } = await createOrSelectAccount(
      deviceEvolu,
      payload.masterKey,
      {
        defaultTransports: appDefaultTransports,
        name: payload.accountName,
        transports: payload.transports,
      }
    )
    setRestoredAccount({ created, previous })
    reloadAppEvolu()
    toast.success(
      created
        ? t("accountTransfer.target.added", { name: payload.accountName })
        : t("accountTransfer.target.alreadyAdded")
    )
    router.replace({ pathname: "/restore-account", params: { source } })
    return true
  }
}
