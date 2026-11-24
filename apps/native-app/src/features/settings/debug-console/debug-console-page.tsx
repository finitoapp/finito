import {
  type ConsoleFilter,
  type ConsoleOutputHistoryEntry,
  filterConsoleEntries,
  formatConsoleArgs,
  formatConsoleEntry,
  formatConsoleGroup,
} from "@payky/app-shared/console-history"
import type { DmInbox } from "@payky/core/integrations/nostr/nostr-support-chat"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import Copy from "lucide-react-native/icons/copy"
import Download from "lucide-react-native/icons/download"
import Pause from "lucide-react-native/icons/pause"
import Play from "lucide-react-native/icons/play"
import Send from "lucide-react-native/icons/send"
import SquareTerminal from "lucide-react-native/icons/square-terminal"
import Trash from "lucide-react-native/icons/trash"
import { Suspense, useEffect, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { Text, View, XStack, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { nativeConsoleHistory } from "../../../core/native-runtime.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard.ts"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useNostrIdentity } from "../../../hooks/use-nostr-profile.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
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

/** The last captured console entries, newest first; in memory only, gone on restart. */
export function DebugConsolePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const copyToClipboard = useCopyToClipboard()
  const sendToSupport = useSendToSupport()
  const [paused, setPaused] = useState(false)
  const [showPayload, setShowPayload] = useState(false)
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
            <XStack ml="auto" items="center" gap={8}>
              <Switch
                aria-label={t("settings.debugConsole.showPayload")}
                checked={showPayload}
                onCheckedChange={setShowPayload}
              />
              <Text fontSize={fontSize.xs} fontWeight="600">
                {t("settings.debugConsole.showPayload")}
              </Text>
            </XStack>
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
                // Keyed by the switch, so flipping it resets every row the
                // user opened or closed by hand, and no row animates.
                <YStack
                  key={String(showPayload)}
                  gap={showPayload ? 2 : 0}
                  testID="debug-console-entries"
                >
                  {visibleEntries.map((entry) => (
                    <ConsoleEntryRow
                      key={entry.id}
                      entry={entry}
                      defaultOpen={showPayload}
                    />
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

/** Web's `ConsoleEntryRow`: a single log line that opens to its payload. */
function ConsoleEntryRow({
  entry,
  defaultOpen,
}: {
  readonly entry: ConsoleOutputHistoryEntry
  readonly defaultOpen: boolean
}) {
  const { t } = useTranslation()
  const copyToClipboard = useCopyToClipboard()
  const [open, setOpen] = useState(defaultOpen)
  const payload = formatConsoleArgs(entry.args)
  // Cut on the line, whole once the row opens.
  const group = open ? entry.path.join("/") : formatConsoleGroup(entry.path)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* One line of small text, as a plain log reads; open, its payload under it. */}
      <YStack px={4} py={1} rounded={4} bg={open ? "neutral-soft" : undefined}>
        <XStack minW={0} gap={6} items="center">
          <CollapsibleTrigger
            flex={1}
            minW={0}
            flexDirection="row"
            items="center"
            gap={6}
          >
            <View rotate={open ? "90deg" : "0deg"}>
              <Icon icon={ChevronRight} size={12} color="muted-foreground" />
            </View>
            <Text {...compactText} color="muted-foreground">
              {format(entry.createdAt, "HH:mm:ss.SSS")}
            </Text>
            <Text
              {...compactText}
              fontWeight="700"
              color={methodColors[entry.method]}
            >
              {entry.method.toUpperCase()}
            </Text>
            {group.length > 0 ? (
              <Text
                {...compactText}
                flex={open ? 1 : undefined}
                minW={0}
                color="muted-foreground"
                numberOfLines={open ? undefined : 1}
              >
                {group}
              </Text>
            ) : null}
            {open ? null : (
              <Text {...compactText} flex={1} minW={0} numberOfLines={1}>
                {payload.replace(/\s+/g, " ")}
              </Text>
            )}
          </CollapsibleTrigger>
          {/* Opened rows only, and over the line's height, which it keeps. */}
          {open ? (
            <View my={-6}>
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
            </View>
          ) : null}
        </XStack>
        <CollapsibleContent>
          <YStack
            mt={2}
            mb={3}
            ml={18}
            maxH={192}
            overflow="hidden"
            rounded={4}
            bg="background"
          >
            <ScrollView
              nestedScrollEnabled
              style={{ maxHeight: 192 }}
              contentContainerStyle={{
                paddingHorizontal: 6,
                paddingVertical: 4,
              }}
            >
              <Text {...compactText} select="text">
                {payload}
              </Text>
            </ScrollView>
          </YStack>
        </CollapsibleContent>
      </YStack>
    </Collapsible>
  )
}

/** A row's text: smaller than the kit's `xs`, the line height left to the font. */
const compactText = {
  fontSize: 10,
  style: { fontFamily: "monospace" },
} as const
