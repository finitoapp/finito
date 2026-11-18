import {
  type ConsoleOutputHistoryEntry,
  formatConsoleArgs,
} from "@payky/app-shared/console-history"
import { format } from "date-fns"
import Pause from "lucide-react-native/icons/pause"
import Play from "lucide-react-native/icons/play"
import SquareTerminal from "lucide-react-native/icons/square-terminal"
import Trash from "lucide-react-native/icons/trash"
import { Suspense, useEffect, useState } from "react"
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
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, shape } from "../../../theme/tokens.ts"
import {
  CashuShardDebugCard,
  CashuShardDebugCardSkeleton,
} from "./cashu-shard-debug-card.tsx"

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
  const [paused, setPaused] = useState(false)
  const [entries, setEntries] = useState<
    ReadonlyArray<ConsoleOutputHistoryEntry>
  >(() => nativeConsoleHistory.getEntries())

  useEffect(() => {
    if (paused) return
    setEntries(nativeConsoleHistory.getEntries())
    return nativeConsoleHistory.subscribe(() => {
      setEntries(nativeConsoleHistory.getEntries())
    })
  }, [paused])

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
          <CardAction>
            <XStack gap={4}>
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
          </CardAction>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState
              icon={SquareTerminal}
              description={t("settings.debugConsole.empty")}
            />
          ) : (
            <YStack gap={8} testID="debug-console-entries">
              {entries.toReversed().map((entry, index) => (
                <YStack
                  // biome-ignore lint/suspicious/noArrayIndexKey: console entries do not expose stable ids
                  key={index}
                  gap={4}
                  px={12}
                  py={8}
                  rounded={shape.control}
                  bg="neutral-soft"
                >
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
                    {entry.path.length === 0 ? null : (
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
                    )}
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
              ))}
            </YStack>
          )}
        </CardContent>
      </Card>
    </Screen>
  )
}
