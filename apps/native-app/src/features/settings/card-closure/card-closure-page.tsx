import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import { cardSwitchioAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  type CloseCardSwitchioBatchError,
  closeCardSwitchioBatch,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-actions"
import {
  type CardSwitchioClosureListRow,
  cardSwitchioClosuresQuery,
  lastCardSwitchioClosurePerDeviceQuery,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-queries"
import type { CardSwitchioClosureId } from "@payky/core/modules/card-switchio-closure/card-switchio-closure-types"
import { Integer, TimestampMs } from "@payky/core/modules/shared/schema"
import { isSameDay, startOfTomorrow } from "date-fns"
import type { Href } from "expo-router"
import { useAtomValue } from "jotai"
import CalendarCheck from "lucide-react-native/icons/calendar-check"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { type ReactNode, Suspense, useState } from "react"
import { ActivityIndicator, FlatList } from "react-native"
import { Text, useTheme, View, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { LoadingView } from "../../../components/loading-view.tsx"
import { SafeAreaView } from "../../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  VerticalNavRow,
  VerticalNavTitle,
} from "../../../components/vertical-nav.tsx"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useInfiniteEvoluQuery } from "../../../hooks/use-infinite-evolu-query.ts"
import { useIsSwitchioInstalled } from "../../../hooks/use-is-switchio-installed.ts"
import { useOpenDetail } from "../../../hooks/use-open-detail.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"
import { shape } from "../../../theme/tokens.ts"

/**
 * `useInfinitePages`' default page, and the first page it asks for: one row
 * more than it shows, to tell whether another page follows.
 */
const HISTORY_PAGE_SIZE = 20

/** Every query the screen reads, started in one round trip. */
const cardClosurePageQueries = [
  cardSwitchioAccountQuery,
  lastCardSwitchioClosurePerDeviceQuery,
  cardSwitchioClosuresQuery(HISTORY_PAGE_SIZE + 1),
]

const closureErrorKeys = {
  CardSwitchioClosureAccountNotFound:
    "settings.cardClosure.error.accountMissing",
  SwitchioUnavailable: "settings.cardClosure.error.unavailable",
  SwitchioClosureFailed: "settings.cardClosure.error.failed",
  SwitchioResultUnreadable: "settings.cardClosure.error.unknown",
} satisfies Record<CloseCardSwitchioBatchError["type"], TranslationKey>

/** ECR's "terminal busy" bundle result code (section 3.3). */
const TERMINAL_BUSY_RESULT_CODE = 2

const closureErrorKey = (
  error: CloseCardSwitchioBatchError
): TranslationKey => {
  if (error.type === "SwitchioUnavailable" && error.reason === "demo") {
    return "settings.cardClosure.error.demo"
  }
  if (
    error.type === "SwitchioClosureFailed" &&
    error.resultCode === TERMINAL_BUSY_RESULT_CODE
  ) {
    return "settings.cardClosure.error.busy"
  }
  return closureErrorKeys[error.type]
}

/** The detail screen of one closure. */
export const cardClosureHref = (id: CardSwitchioClosureId): Href => ({
  pathname: "/settings/card-closure/[closureId]",
  params: { closureId: id },
})

/**
 * The daily closure of the SwitchioPay terminal (payment/0008, access/0011).
 * Finito only: web's Capacitor bridge takes card payments but does not close
 * batches. The button closes the terminal on this phone; the other devices'
 * closures are listed, never started, from here. One virtualized list, so
 * the history pages in as it scrolls: the cards above it are its header.
 */
export function CardClosurePage() {
  usePreloadEvoluQueries(cardClosurePageQueries)
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingHorizontal: screenPaddingX,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader title={t("settings.cardClosure.title")} />
      <Suspense fallback={<LoadingView />}>
        <CardClosureList />
      </Suspense>
    </SafeAreaView>
  )
}

function CardClosureList() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { rows, hasMore, isPending, loadMore } = useInfiniteEvoluQuery(
    [],
    cardSwitchioClosuresQuery
  )

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      data={rows}
      keyExtractor={(row) => row.id}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !isPending) loadMore()
      }}
      ListHeaderComponent={
        <YStack gap={16}>
          <ThisTerminalCard />
          <TerminalsCard />
          {/* The top of the history card, which its rows continue. */}
          <View
            bg="card"
            px={8}
            pt={8}
            borderTopLeftRadius={shape.card}
            borderTopRightRadius={shape.card}
          >
            <VerticalNavTitle role="heading">
              {t("settings.cardClosure.history.title")}
            </VerticalNavTitle>
          </View>
        </YStack>
      }
      ListEmptyComponent={
        <HistoryRowFrame>
          <Text
            px={12}
            py={12}
            color="muted-foreground"
            fontSize="sm"
            lineHeight="sm"
          >
            {t("settings.cardClosure.history.empty")}
          </Text>
        </HistoryRowFrame>
      }
      ListFooterComponent={
        // The bottom of the history card.
        <View
          bg="card"
          px={8}
          pb={8}
          borderBottomLeftRadius={shape.card}
          borderBottomRightRadius={shape.card}
        >
          {hasMore ? <ActivityIndicator style={{ padding: 16 }} /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <HistoryRowFrame>
          <HistoryRow row={item} locale={locale} />
        </HistoryRowFrame>
      )}
    />
  )
}

/** The history card's side padding and fill around one row. */
function HistoryRowFrame({ children }: { readonly children: ReactNode }) {
  return (
    <View bg="card" px={8}>
      {children}
    </View>
  )
}

function HistoryRow({
  row,
  locale,
}: {
  readonly row: CardSwitchioClosureListRow
  readonly locale: string
}) {
  const { t } = useTranslation()
  const closedAt = formatDateTime(new Date(row.closedAt), locale)
  return (
    <VerticalNavRow
      item={{
        kind: "link",
        href: cardClosureHref(row.id),
        accessibilityLabel: closedAt,
        label: (
          <XStack items="center" gap={12}>
            <YStack flex={1} minW={0} gap={2}>
              <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                {closedAt}
              </Text>
              <Text
                color="muted-foreground"
                fontSize="xs"
                lineHeight="xs"
                numberOfLines={1}
              >
                {[
                  row.deviceName ??
                    t("settings.cardClosure.terminals.unknownDevice"),
                  t("settings.cardClosure.result.batchAndShift", {
                    batch: String(row.batchNumber),
                    shift: String(row.shiftNumber),
                  }),
                ].join(" · ")}
              </Text>
            </YStack>
            <Text fontSize="sm" lineHeight="sm" fontWeight="600">
              {formatMoney(
                { value: Integer(row.debitsAmount), currency: row.currency },
                locale
              )}
            </Text>
          </XStack>
        ),
      }}
    />
  )
}

function ThisTerminalCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const deviceId = useAtomValue(accountAtom).device.id
  const appRun = useAppRun()
  const confirm = useConfirm()
  const toast = useToast()
  const openDetail = useOpenDetail()
  const { require } = useRequirePermission()
  const lastPerDevice = useEvoluQuery(
    lastCardSwitchioClosurePerDeviceQuery
  ).data
  const last = lastPerDevice.find((row) => row.deviceId === deviceId)
  const [unknownOutcome, setUnknownOutcome] = useState(false)
  const [pending, setPending] = useState(false)
  const installed = useIsSwitchioInstalled()

  const close = async () => {
    if (!(await require("confirm", "access.action.closeCardBatch"))) return
    const confirmed = await confirm({
      title: t("settings.cardClosure.confirm.title"),
      description: t("settings.cardClosure.confirm.description"),
      confirmLabel: t("settings.cardClosure.action"),
      cancelLabel: t("settings.cardClosure.confirm.cancel"),
    })
    if (!confirmed) return

    setPending(true)
    setUnknownOutcome(false)
    try {
      // Not `useRunToast`: a closed batch opens its detail, the totals staff
      // checks against the till.
      await using run = appRun()
      const result = await run(closeCardSwitchioBatch({ deviceId }))
      if (result.ok) {
        openDetail(cardClosureHref(result.value.id))
      } else if (result.error.type === "SwitchioResultUnreadable") {
        // Stays on screen: the batch may be closed, staff must check.
        setUnknownOutcome(true)
      } else {
        toast.error(t(closureErrorKey(result.error)))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <YStack gap={16}>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cardClosure.thisTerminal.title")}</CardTitle>
          <CardDescription>
            {t("settings.cardClosure.thisTerminal.description")}
          </CardDescription>
        </CardHeader>
        <CardContent gap={12}>
          {last === undefined ? (
            <DetailRow
              label={t("settings.cardClosure.thisTerminal.last")}
              value={t("settings.cardClosure.thisTerminal.never")}
            />
          ) : (
            <VerticalNavRow
              item={{
                kind: "link",
                href: cardClosureHref(last.id),
                accessibilityLabel: t("settings.cardClosure.thisTerminal.last"),
                label: (
                  <XStack items="center" justify="space-between" gap={12}>
                    <Text
                      color="muted-foreground"
                      fontSize="sm"
                      lineHeight="sm"
                    >
                      {t("settings.cardClosure.thisTerminal.last")}
                    </Text>
                    <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                      {formatDateTime(new Date(last.closedAt), locale)}
                    </Text>
                  </XStack>
                ),
              }}
            />
          )}
          {installed ? null : (
            <Alert variant="warning" icon={TriangleAlert}>
              <AlertDescription>
                {t("settings.cardSwitchioAccount.notInstalledWarning")}
              </AlertDescription>
            </Alert>
          )}
          <Button
            size="lg"
            iconStart={CalendarCheck}
            label={t("settings.cardClosure.action")}
            disabled={!installed}
            pending={pending}
            onPress={() => void close()}
          />
        </CardContent>
      </Card>
      {unknownOutcome ? (
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertTitle>{t("settings.cardClosure.error.unknown")}</AlertTitle>
        </Alert>
      ) : null}
    </YStack>
  )
}

function TerminalsCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const deviceId = useAtomValue(accountAtom).device.id
  const rows = useEvoluQuery(lastCardSwitchioClosurePerDeviceQuery).data
  // "Closed today" turns over at midnight even with the screen left open.
  const now = useNow([TimestampMs(startOfTomorrow().getTime())])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.cardClosure.terminals.title")}</CardTitle>
        <CardDescription>
          {t("settings.cardClosure.terminals.description")}
        </CardDescription>
      </CardHeader>
      <CardContent gap={12}>
        {rows.length === 0 ? (
          <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
            {t("settings.cardClosure.terminals.empty")}
          </Text>
        ) : (
          rows.map((row) => {
            const closedToday = isSameDay(new Date(row.closedAt), now)
            return (
              <XStack key={row.deviceId} items="center" gap={12}>
                <YStack flex={1} minW={0} gap={2}>
                  <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                    {row.deviceId === deviceId
                      ? t("settings.cardClosure.terminals.thisDevice")
                      : (row.deviceName ??
                        t("settings.cardClosure.terminals.unknownDevice"))}
                  </Text>
                  <Text color="muted-foreground" fontSize="xs" lineHeight="xs">
                    {formatDateTime(new Date(row.closedAt), locale)}
                  </Text>
                </YStack>
                <Badge
                  variant={closedToday ? "secondary" : "destructive"}
                  label={t(
                    closedToday
                      ? "settings.cardClosure.terminals.closedToday"
                      : "settings.cardClosure.terminals.notClosedToday"
                  )}
                />
              </XStack>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
