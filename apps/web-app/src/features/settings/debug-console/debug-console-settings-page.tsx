import {
  type ConsoleFilter,
  filterConsoleEntries,
  formatConsoleArgs,
  formatConsoleEntry,
  formatConsoleGroup,
} from "@payky/app-shared/console-history"
import type { DmInbox } from "@payky/core/integrations/nostr/nostr-support-chat"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  ChevronRight,
  Copy,
  Download,
  Pause,
  Play,
  Send,
  Trash2,
} from "lucide-react"
import { Suspense, useEffect, useId, useMemo, useState } from "react"
import { toast } from "sonner"

import type { ConsoleOutputHistoryEntry } from "@/atoms/console.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import { Label } from "@/components/ui/label.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { CashuShardDebugCard } from "@/features/settings/debug-console/cashu-shard-debug-card.tsx"
import {
  DebugConsoleFilters,
  emptyConsoleFilter,
} from "@/features/settings/debug-console/debug-console-filters.tsx"
import {
  saveConsoleLog,
  useFormatConsoleLog,
  useFormatSupportLog,
} from "@/features/settings/debug-console/debug-console-log.ts"
import {
  dmInboxQueryKey,
  useDeliverSupportMessage,
  useDmRelayList,
  useSupportTeam,
} from "@/features/settings/support/use-support-chat.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useConsoleHistory } from "@/hooks/use-console.ts"
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts"
import { useNostrIdentity } from "@/hooks/use-nostr-profile.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { copyToClipboard } from "@/lib/clipboard.ts"
import { cn } from "@/lib/utils.ts"

const searchDebounceMs = 200

export function DebugConsoleSettingsPage() {
  const { t } = useTranslation()
  const consoleHistory = useConsoleHistory()
  const formatLog = useFormatConsoleLog()
  const sendToSupport = useSendToSupport()
  const [isPaused, setIsPaused] = useState(false)
  const [showPayload, setShowPayload] = useState(false)
  const showPayloadId = useId()
  const [entries, setEntries] = useState<
    ReadonlyArray<ConsoleOutputHistoryEntry>
  >(() => consoleHistory.getEntries())
  const [filter, setFilter] = useState<ConsoleFilter>(emptyConsoleFilter)
  const searchText = useDebouncedValue(filter.text, searchDebounceMs)
  const { minLevel, sources } = filter
  const shownEntries = useMemo(
    () =>
      filterConsoleEntries(entries, { minLevel, sources, text: searchText }),
    [entries, minLevel, sources, searchText]
  )
  const visibleEntries = useMemo(
    () => shownEntries.toReversed(),
    [shownEntries]
  )

  useEffect(() => {
    if (isPaused) return

    setEntries(consoleHistory.getEntries())

    return consoleHistory.subscribe(() => {
      setEntries(consoleHistory.getEntries())
    })
  }, [consoleHistory, isPaused])

  const clearEntries = () => {
    consoleHistory.clearEntries()
    setEntries([])
  }

  const copyShown = () =>
    copyToClipboard(formatLog(shownEntries), {
      copied: t("settings.debugConsole.copied"),
      failed: t("settings.debugConsole.copyFailed"),
    })

  // Export holds every buffered entry, whatever the filters or pause show
  // (settings/0006): support wants the context, not the excerpt.
  const exportAll = async () => {
    try {
      const saved = await saveConsoleLog(formatLog(consoleHistory.getEntries()))
      if (saved !== null) toast.success(t("settings.debugConsole.exported"))
    } catch {
      toast.error(t("settings.debugConsole.exportFailed"))
    }
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.debugConsole.title")} />

      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <CashuShardDebugCard />
        </Suspense>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("settings.debugConsole.history.title")}</CardTitle>
          {entries.length > 0 ? (
            <CardAction
              className="font-mono text-xs tabular-nums text-muted-foreground"
              data-testid="debug-console-counter"
            >
              {t("settings.debugConsole.filter.counter", {
                shown: shownEntries.length,
                total: entries.length,
              })}
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPaused((value) => !value)
              }}
            >
              {isPaused ? <Play /> : <Pause />}
              {isPaused
                ? t("settings.debugConsole.resume")
                : t("settings.debugConsole.pause")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void copyShown()}
              disabled={shownEntries.length === 0}
            >
              <Copy />
              {t("settings.debugConsole.copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void exportAll()}
            >
              <Download />
              {t("settings.debugConsole.export")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void sendToSupport.send(shownEntries)}
              disabled={shownEntries.length === 0 || sendToSupport.sending}
            >
              <Send />
              {t("settings.debugConsole.sendToSupport")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearEntries}
              disabled={entries.length === 0}
            >
              <Trash2 />
              {t("settings.debugConsole.clear")}
            </Button>
            <Label htmlFor={showPayloadId} className="ml-auto gap-2 text-xs">
              <Switch
                id={showPayloadId}
                size="sm"
                checked={showPayload}
                onCheckedChange={setShowPayload}
              />
              {t("settings.debugConsole.showPayload")}
            </Label>
          </div>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("settings.debugConsole.empty")}
            </p>
          ) : (
            <>
              <DebugConsoleFilters
                entries={entries}
                filter={filter}
                onFilterChange={setFilter}
              />
              {visibleEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-center text-sm text-muted-foreground">
                    {t("settings.debugConsole.filter.noMatches")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter(emptyConsoleFilter)}
                  >
                    {t("settings.debugConsole.filter.clear")}
                  </Button>
                </div>
              ) : (
                // Keyed by the switch, so flipping it resets every row the
                // user opened or closed by hand.
                <div
                  key={String(showPayload)}
                  className={cn(
                    "flex flex-col",
                    showPayload ? "gap-0.5" : "gap-0"
                  )}
                  data-testid="debug-console-entries"
                >
                  {visibleEntries.map((entry) => (
                    <ConsoleEntryRow
                      key={entry.id}
                      entry={entry}
                      defaultOpen={showPayload}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/**
 * Sends the shown log to the support chat once confirmed (support/0005), as
 * the chat sends a message, so the chat shows it when it opens. The chat's
 * route asks for `settings` where this screen asks for `admin`, so the send
 * asks for it too.
 */
function useSendToSupport() {
  const { t } = useTranslation()
  const { require } = useRequirePermission()
  const confirm = useConfirmDialog()
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const { pubkey } = useNostrIdentity()
  const team = useSupportTeam()
  const dmRelayList = useDmRelayList({ pubkey, team: team.data })
  const deliver = useDeliverSupportMessage()
  const formatSupportLog = useFormatSupportLog()
  const [sending, setSending] = useState(false)

  const send = async (entries: ReadonlyArray<ConsoleOutputHistoryEntry>) => {
    // What was shown when tapped, not what arrives while confirming.
    const text = formatSupportLog(entries)
    if (!(await require("settings", "access.action.sendLogToSupport"))) return
    const confirmed = await confirm({
      title: t("settings.debugConsole.sendToSupport.confirm.title"),
      description: t("settings.debugConsole.sendToSupport.confirm.description"),
      confirmLabel: t("settings.debugConsole.sendToSupport.confirm.action"),
      cancelLabel: t("settings.debugConsole.sendToSupport.confirm.cancel"),
    })
    if (!confirmed) return

    setSending(true)
    await Promise.all([
      runToast(async (run) => {
        // Without the team (Payky's API down) there is nobody to send to.
        const loaded = team.data ?? (await team.refetch()).data
        if (loaded === undefined) return "settings.debugConsole.sendFailed"
        const result = await deliver(run, {
          text,
          team: loaded,
          inbox: queryClient.getQueryData<DmInbox>(dmInboxQueryKey(pubkey)),
        })
        if (!result.ok) return "settings.debugConsole.sendFailed"
        toast.success(t("settings.debugConsole.sent"))
      }),
      // Like every message to support, so support can reply (support/0004).
      dmRelayList.ensure(),
    ])
    setSending(false)
  }

  return { send, sending }
}

/**
 * One entry: a single log line that opens to its payload. The switch above
 * the log sets whether rows start open; each can still be toggled.
 */
function ConsoleEntryRow({
  entry,
  defaultOpen,
}: {
  readonly entry: ConsoleOutputHistoryEntry
  readonly defaultOpen: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const path = entry.path.length > 0 ? entry.path.join("/") : null
  const payload = formatConsoleArgs(entry.args)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<article />}
      className={cn(
        "rounded-sm px-1 font-mono text-[10px] leading-4",
        open ? "bg-muted/40 pb-1" : "hover:bg-muted/40"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          <time
            className="shrink-0 tabular-nums text-muted-foreground"
            dateTime={new Date(entry.createdAt).toISOString()}
          >
            {formatConsoleEntryTime(entry.createdAt)}
          </time>
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase leading-none",
              methodClassNames[entry.method]
            )}
          >
            {entry.method}
          </span>
          {path ? (
            // Cut on the line, whole once the row opens.
            <span
              className={cn(
                "text-muted-foreground",
                open ? "min-w-0 flex-1 break-all" : "shrink-0"
              )}
              title={open ? undefined : path}
            >
              {open ? path : formatConsoleGroup(entry.path)}
            </span>
          ) : null}
          {open ? null : (
            <span className="min-w-0 flex-1 truncate">
              {payload.replace(/\s+/g, " ")}
            </span>
          )}
        </CollapsibleTrigger>
        {/* Opened rows only, so a closed one stays a line of text. */}
        {open ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            // The line's own height, so opening a row does not grow it.
            className="-my-0.5 size-5 shrink-0"
            aria-label={t("settings.debugConsole.copyEntry")}
            onClick={() =>
              void copyToClipboard(formatConsoleEntry(entry), {
                copied: t("settings.debugConsole.copied"),
                failed: t("settings.debugConsole.copyFailed"),
              })
            }
          >
            <Copy className="size-3" />
          </Button>
        ) : null}
      </div>
      <CollapsibleContent>
        <pre className="mt-0.5 ml-4.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-background px-1.5 py-1">
          {payload}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

const defaultMethodClassName = "bg-foreground/10 text-foreground"

const methodClassNames = {
  trace: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  debug: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  log: defaultMethodClassName,
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  error: "bg-destructive/15 text-destructive",
} satisfies Record<ConsoleOutputHistoryEntry["method"], string>

function formatConsoleEntryTime(createdAt: number): string {
  return format(createdAt, "HH:mm:ss.SSS")
}
