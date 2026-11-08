import { formatDateTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { cardSwitchioAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  type CloseCardSwitchioBatchError,
  closeCardSwitchioBatch,
  type RecordedCardSwitchioClosure,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-actions"
import {
  cardSwitchioClosuresQuery,
  lastCardSwitchioClosurePerDeviceQuery,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { Integer } from "@payky/core/modules/shared/schema"
import { isSameDay } from "date-fns"
import { useAtomValue } from "jotai"
import CalendarCheck from "lucide-react-native/icons/calendar-check"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
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
import { Separator } from "../../../components/ui/separator.tsx"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"
import { isSwitchioInstalled } from "../../../platform/switchio.ts"

const historyQuery = cardSwitchioClosuresQuery(30)

/** Every query the screen reads, started in one round trip. */
const cardClosurePageQueries = [
  cardSwitchioAccountQuery,
  lastCardSwitchioClosurePerDeviceQuery,
  historyQuery,
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

const closureErrorKey = (error: CloseCardSwitchioBatchError): TranslationKey =>
  error.type === "SwitchioClosureFailed" &&
  error.resultCode === TERMINAL_BUSY_RESULT_CODE
    ? "settings.cardClosure.error.busy"
    : closureErrorKeys[error.type]

/** What a closure card shows: a fresh result and a stored row alike. */
interface ClosureTotals {
  readonly currency: FiatCurrency
  readonly batchNumber: number
  readonly shiftNumber: number
  readonly debitsCount: number
  readonly debitsAmount: number
  readonly creditsCount: number
  readonly creditsAmount: number
  readonly adjsCount: number
  readonly adjsAmount: number
  readonly terminalDateTime: string | null
  readonly closedAt: number
}

/**
 * The daily closure of the SwitchioPay terminal (payment/0008, access/0011).
 * Finito only: web's Capacitor bridge takes card payments but does not close
 * batches. The button closes the terminal on this phone; the other devices'
 * closures are listed, never started, from here.
 */
export function CardClosurePage() {
  usePreloadEvoluQueries(cardClosurePageQueries)
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("settings.cardClosure.title")} />
      <ThisTerminalCard />
      <TerminalsCard />
      <HistoryCard />
    </Screen>
  )
}

function ThisTerminalCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const deviceId = useAtomValue(accountAtom).device.id
  const appRun = useAppRun()
  const confirm = useConfirm()
  const toast = useToast()
  const { require } = useRequirePermission()
  const lastPerDevice = useEvoluQuery(
    lastCardSwitchioClosurePerDeviceQuery
  ).data
  const stored = lastPerDevice.find((row) => row.deviceId === deviceId)
  const [justClosed, setJustClosed] =
    useState<RecordedCardSwitchioClosure | null>(null)
  const [unknownOutcome, setUnknownOutcome] = useState(false)
  const [pending, setPending] = useState(false)
  const installed = isSwitchioInstalled()
  const shown: ClosureTotals | undefined = justClosed ?? stored

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
      // Not `useRunToast`: the screen shows the closure it returns.
      await using run = appRun()
      const result = await run(closeCardSwitchioBatch({ deviceId }))
      if (result.ok) {
        setJustClosed(result.value)
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cardClosure.thisTerminal.title")}</CardTitle>
          <CardDescription>
            {t("settings.cardClosure.thisTerminal.description")}
          </CardDescription>
        </CardHeader>
        <CardContent gap={12}>
          <DetailRow
            label={t("settings.cardClosure.thisTerminal.last")}
            value={
              stored === undefined
                ? t("settings.cardClosure.thisTerminal.never")
                : formatDateTime(new Date(stored.closedAt), locale)
            }
          />
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
      {shown === undefined ? null : <ClosureResultCard closure={shown} />}
    </>
  )
}

function ClosureResultCard({ closure }: { readonly closure: ClosureTotals }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = (amount: number) =>
    formatMoney({ value: Integer(amount), currency: closure.currency }, locale)
  const countAndAmount = (count: number, amount: number) =>
    t("settings.cardClosure.result.countAndAmount", {
      count: String(count),
      amount: money(amount),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.cardClosure.result.title")}</CardTitle>
        <CardDescription>
          {formatDateTime(new Date(closure.closedAt), locale)}
        </CardDescription>
      </CardHeader>
      <CardContent gap={12}>
        <DetailRow
          label={t("settings.cardClosure.result.payments")}
          value={countAndAmount(closure.debitsCount, closure.debitsAmount)}
          emphasize
        />
        <DetailRow
          label={t("settings.cardClosure.result.refunds")}
          value={countAndAmount(closure.creditsCount, closure.creditsAmount)}
        />
        {closure.adjsCount === 0 && closure.adjsAmount === 0 ? null : (
          <DetailRow
            label={t("settings.cardClosure.result.adjustments")}
            value={countAndAmount(closure.adjsCount, closure.adjsAmount)}
          />
        )}
        <Separator />
        <DetailRow
          label={t("settings.cardClosure.result.batch")}
          value={String(closure.batchNumber)}
        />
        <DetailRow
          label={t("settings.cardClosure.result.shift")}
          value={String(closure.shiftNumber)}
        />
        {closure.terminalDateTime === null ? null : (
          <DetailRow
            label={t("settings.cardClosure.result.terminalTime")}
            value={closure.terminalDateTime}
          />
        )}
      </CardContent>
    </Card>
  )
}

function TerminalsCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const deviceId = useAtomValue(accountAtom).device.id
  const rows = useEvoluQuery(lastCardSwitchioClosurePerDeviceQuery).data
  const now = new Date()

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

function HistoryCard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const rows = useEvoluQuery(historyQuery).data

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.cardClosure.history.title")}</CardTitle>
      </CardHeader>
      <CardContent gap={12}>
        {rows.length === 0 ? (
          <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
            {t("settings.cardClosure.history.empty")}
          </Text>
        ) : (
          rows.map((row) => (
            <XStack key={row.id} items="center" gap={12}>
              <YStack flex={1} minW={0} gap={2}>
                <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                  {formatDateTime(new Date(row.closedAt), locale)}
                </Text>
                <Text color="muted-foreground" fontSize="xs" lineHeight="xs">
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
          ))
        )}
      </CardContent>
    </Card>
  )
}
