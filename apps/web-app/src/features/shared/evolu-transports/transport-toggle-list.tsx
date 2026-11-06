import { sqliteFalse, sqliteTrue } from "@evolu/common"
import {
  orderDefaultTransportsFirst,
  splitTransportUrl,
} from "@payky/app-shared/evolu-transports"
import {
  accountTransportsQuery,
  setAccountEvoluTransportActive,
} from "@payky/core/evolu/device-account"
import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import { runMutationWithCompletion } from "@payky/core/modules/shared/evolu-utils"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { Switch } from "@/components/ui/switch.tsx"
import { appDefaultTransports } from "@/core/app-brand.ts"
import { TransportSyncStatus } from "@/features/shared/evolu-transports/transport-sync-status.tsx"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

interface TransportToggleListProps {
  readonly accountId: DeviceAccountId
  readonly disabled?: boolean
}

export function TransportToggleList({
  accountId,
  disabled = false,
}: TransportToggleListProps) {
  const { t } = useTranslation()
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const runToast = useRunToast()
  const { data: transports } = useDeviceEvoluQuery(
    accountTransportsQuery(accountId)
  )
  const orderedTransports = orderDefaultTransportsFirst(
    transports,
    appDefaultTransports
  )
  const [pendingTransportId, setPendingTransportId] = useState<string | null>(
    null
  )

  if (transports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("settings.security.transports.empty")}
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {orderedTransports.map((transport) => (
        <TransportListItem
          key={transport.id}
          isActive={transport.isActive}
          disabled={disabled || pendingTransportId !== null}
          url={transport.url}
          onToggle={async (isActive) => {
            setPendingTransportId(transport.id)
            await runToast(async () => {
              await runMutationWithCompletion((options) =>
                setAccountEvoluTransportActive(
                  deviceEvolu,
                  { id: transport.id, isActive },
                  options
                )
              )
              reloadAppEvolu()
            })
            setPendingTransportId(null)
          }}
        />
      ))}
    </ul>
  )
}

interface TransportListItemProps {
  readonly isActive: 0 | 1
  readonly disabled: boolean
  readonly url: string
  readonly onToggle: (isActive: 0 | 1) => Promise<void>
}

function TransportListItem({
  isActive,
  disabled,
  url,
  onToggle,
}: TransportListItemProps) {
  const { t } = useTranslation()
  const active = isActive === sqliteTrue

  return (
    <li className="flex flex-col gap-2 p-3">
      <TransportUrl url={url} muted={!active} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {active ? (
            <TransportSyncStatus url={url} />
          ) : (
            <p className="text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="mr-1.5 inline-block size-2 rounded-full border border-muted-foreground"
              />
              {t("settings.security.transports.inactive")}
            </p>
          )}
        </div>
        <Switch
          aria-label={t("settings.security.transports.toggle", { url })}
          checked={active}
          disabled={disabled}
          onCheckedChange={(checked) => {
            void onToggle(checked ? sqliteTrue : sqliteFalse)
          }}
        />
      </div>
    </li>
  )
}

interface TransportUrlProps {
  readonly url: string
  readonly muted: boolean
}

/**
 * The URL with its `wss://` scheme toned down — every transport has it — and
 * the owner-id placeholder shown as what it stands for instead of raw
 * template syntax.
 */
function TransportUrl({ url, muted }: TransportUrlProps) {
  const { t } = useTranslation()
  const { scheme, parts } = splitTransportUrl(url)

  return (
    <p
      className={cn(
        "font-mono text-sm font-medium break-all",
        muted && "text-muted-foreground"
      )}
    >
      {scheme === null ? null : (
        <span className="text-muted-foreground">{scheme}</span>
      )}
      {parts.map((part, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one URL never reorder.
        <span key={index}>
          {index === 0 ? null : (
            <span className="mx-0.5 rounded bg-muted px-1 py-0.5 font-sans text-xs font-normal text-muted-foreground">
              {t("settings.security.transports.accountId")}
            </span>
          )}
          {part}
        </span>
      ))}
    </p>
  )
}
