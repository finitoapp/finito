import {
  type ConsoleFilter,
  type ConsoleOutputHistoryEntry,
  filterConsoleEntries,
  formatConsoleArgs,
  formatConsoleEntry,
} from "@payky/app-shared/console-history"
import type { DmInbox } from "@payky/core/integrations/nostr/nostr-support-chat"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import Copy from "lucide-react-native/icons/copy"
import Download from "lucide-react-native/icons/download"
import Pause from "lucide-react-native/icons/pause"
import Play from "lucide-react-native/icons/play"
import Send from "lucide-react-native/icons/send"
import SquareTerminal from "lucide-react-native/icons/square-terminal"
import Trash from "lucide-react-native/icons/trash"
import { Suspense, useEffect, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { nativeConsoleHistory } from "../../../core/native-runtime.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard.ts"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useNostrIdentity } from "../../../hooks/use-nostr-profile.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, shape } from "../../../theme/tokens.ts"
import { useDeliverSupportMessage } from "../support/use-send-support-message.ts"
import {
  dmInboxQueryKey,
  useDmRelayList,
  useSupportTeam,
} from "../support/use-support-chat.ts"
import {
  CashuShardDebugCard,
  CashuShardDebugCardSkeleton,
} from "./cashu-shard-debug-card.tsx"
import {
  DebugConsoleFilters,
  emptyConsoleFilter,
} from "./debug-console-filters.tsx"
import {
  formatDebugConsoleLog,
  formatDebugConsoleSupportLog,
  shareDebugConsoleLog,
} from "./debug-console-log.ts"

const searchDebounceMs = 200

const methodColors = {
  trace: "info",
  debug: "info",
  log: "color",
  info: "info",
  warn: "warning",
  error: "destructive",
} as const satisfies Record<ConsoleOutputHistoryEntry["method"], string>

const methodBackgrounds = {
  trace: "info-10",
  debug: "info-10",
  log: "muted-20",
  info: "info-10",
  warn: "warning-10",
  error: "destructive-10",
} as const satisfies Record<ConsoleOutputHistoryEntry["method"], string>

/** The last captured console entries, newest first; in memory only, gone on restart. */
export function DebugConsolePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const copyToClipboard = useCopyToClipboard()
  const sendToSupport = useSendToSupport()
  const [paused, setPaused] = useState(false)
  const [entries, setEntries] = useState<
    ReadonlyArray<ConsoleOutputHistoryEntry>
  >(() => nativeConsoleHistory.getEntries())
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
    if (paused) return
    setEntries(nativeConsoleHistory.getEntries())
    return nativeConsoleHistory.subscribe(() => {
      setEntries(nativeConsoleHistory.getEntries())
    })
  }, [paused])

  const copyShown = () =>
    copyToClipboard(formatDebugConsoleLog(shownEntries), {
      copied: t("settings.debugConsole.copied"),
      failed: t("settings.debugConsole.copyFailed"),
    })

  // Export holds every buffered entry, whatever the filters or pause show
  // (settings/0006): support wants the context, not the excerpt.
  const exportAll = async () => {
    try {
      const outcome = await shareDebugConsoleLog(
        formatDebugConsoleLog(nativeConsoleHistory.getEntries())
      )
      if (outcome === "unavailable")
        toast.error(t("settings.debugConsole.exportFailed"))
      else if (outcome === "saved")
        toast.success(t("settings.debugConsole.exported"))
      // `handedOff`: the share sheet closed, shared or dismissed alike
      // (expo-sharing tells them apart for no one), so no success to claim.
    } catch {
      toast.error(t("settings.debugConsole.exportFailed"))
    }
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.debugConsole.title")} />
      {__DEV__ ? (
        <Suspense fallback={<CashuShardDebugCardSkeleton />}>
          <CashuShardDebugCard />
        </Suspense>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.debugConsole.history.title")}</CardTitle>
          {entries.length > 0 ? (
            <CardAction>
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
                style={{ fontFamily: "monospace" }}
                testID="debug-console-counter"
              >
                {t("settings.debugConsole.filter.counter", {
                  shown: shownEntries.length,
                  total: entries.length,
                })}
              </Text>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent gap={16}>
          {/* One wrapping row, so another action fits without a relayout. */}
          <XStack flexWrap="wrap" items="center" gap={4}>
            <Button
              size="sm"
              label={t(
                paused
                  ? "settings.debugConsole.resume"
                  : "settings.debugConsole.pause"
              )}
              iconStart={paused ? Play : Pause}
              variant="ghost"
              onPress={() => setPaused((value) => !value)}
            />
            <Button
              size="sm"
              label={t("settings.debugConsole.copy")}
              iconStart={Copy}
              variant="ghost"
              disabled={shownEntries.length === 0}
              onPress={() => void copyShown()}
            />
            <Button
              size="sm"
              label={t("settings.debugConsole.export")}
              iconStart={Download}
              variant="ghost"
              onPress={() => void exportAll()}
            />
            <Button
              size="sm"
              label={t("settings.debugConsole.sendToSupport")}
              iconStart={Send}
              variant="ghost"
              disabled={shownEntries.length === 0 || sendToSupport.sending}
              onPress={() => void sendToSupport.send(shownEntries)}
            />
            <Button
              size="sm"
              label={t("settings.debugConsole.clear")}
              iconStart={Trash}
              variant="ghost"
              disabled={entries.length === 0}
              onPress={() => {
                nativeConsoleHistory.clearEntries()
                setEntries([])
              }}
            />
          </XStack>
          {entries.length === 0 ? (
            <EmptyState
              icon={SquareTerminal}
              description={t("settings.debugConsole.empty")}
            />
          ) : (
            <>
              <DebugConsoleFilters
                entries={entries}
                filter={filter}
                onFilterChange={setFilter}
              />
              {visibleEntries.length === 0 ? (
                <EmptyState
                  description={t("settings.debugConsole.filter.noMatches")}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      label={t("settings.debugConsole.filter.clear")}
                      onPress={() => setFilter(emptyConsoleFilter)}
                    />
                  }
                />
              ) : (
                <YStack gap={8} testID="debug-console-entries">
                  {visibleEntries.map((entry) => (
                    <ConsoleEntryCard key={entry.id} entry={entry} />
                  ))}
                </YStack>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Screen>
  )
}

/**
 * Web's `useSendToSupport`: sends the shown log to the support chat once
 * confirmed (support/0005), as the chat sends a message, so the chat shows it
 * when it opens. The chat's route asks for `settings` where this screen asks
 * for `admin`, so the send asks for it too.
 */
function useSendToSupport() {
  const { t } = useTranslation()
  const toast = useToast()
  const { require } = useRequirePermission()
  const confirm = useConfirm()
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const { pubkey } = useNostrIdentity()
  const team = useSupportTeam()
  const dmRelayList = useDmRelayList({ pubkey, team: team.data })
  const deliver = useDeliverSupportMessage()
  const [sending, setSending] = useState(false)

  const send = async (entries: ReadonlyArray<ConsoleOutputHistoryEntry>) => {
    // What was shown when tapped, not what arrives while confirming.
    const text = formatDebugConsoleSupportLog(entries, t)
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
        // Without the team (the API down) there is nobody to send to.
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

function ConsoleEntryCard({
  entry,
}: {
  readonly entry: ConsoleOutputHistoryEntry
}) {
  const { t } = useTranslation()
  const copyToClipboard = useCopyToClipboard()
  return (
    <YStack gap={4} px={12} py={8} rounded={shape.control} bg="neutral-soft">
      <XStack minW={0} gap={8} items="center">
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
          style={{ fontFamily: "monospace" }}
        >
          {format(entry.createdAt, "HH:mm:ss.SSS")}
        </Text>
        <Badge
          variant="secondary"
          label={entry.method.toUpperCase()}
          labelColor={methodColors[entry.method]}
          bg={methodBackgrounds[entry.method]}
        />
        <Text
          flex={1}
          minW={0}
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
          style={{ fontFamily: "monospace" }}
          numberOfLines={1}
        >
          {entry.path.join("/")}
        </Text>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("settings.debugConsole.copyEntry")}
          iconStart={Copy}
          onPress={() =>
            void copyToClipboard(formatConsoleEntry(entry), {
              copied: t("settings.debugConsole.copied"),
              failed: t("settings.debugConsole.copyFailed"),
            })
          }
        />
      </XStack>
      <YStack
        maxH={192}
        overflow="hidden"
        rounded={shape.control}
        bg="background"
      >
        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: 192 }}
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            style={{ fontFamily: "monospace" }}
            select="text"
          >
            {formatConsoleArgs(entry.args)}
          </Text>
        </ScrollView>
      </YStack>
    </YStack>
  )
}
