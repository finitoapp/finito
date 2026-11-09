import { formatDateTime } from "@payky/app-shared/format-date"
import {
  type CardSwitchioClosureListRow,
  cardSwitchioClosureByIdQuery,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-queries"
import {
  type CardSwitchioClosureId,
  CardSwitchioClosureId as CardSwitchioClosureIdSchema,
} from "@payky/core/modules/card-switchio-closure/card-switchio-closure-types"
import { Integer } from "@payky/core/modules/shared/schema"
import { useLocalSearchParams } from "expo-router"
import { Suspense } from "react"
import { ScrollView } from "react-native"
import { useTheme } from "tamagui"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { LoadingView } from "../../../components/loading-view.tsx"
import { NotFoundCard } from "../../../components/not-found-card.tsx"
import { SafeAreaView } from "../../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { Separator } from "../../../components/ui/separator.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"
import { useClosureDeviceLabel } from "./use-closure-device-label.ts"

/**
 * `/settings/card-closure/[closureId]`: one recorded closure (payment/0008)
 * with every total the terminal reported, opened from the history or right
 * after the batch was closed. Gated by `confirm`, as the list (access/0011).
 */
export function CardClosureDetailPage() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { closureId } = useLocalSearchParams<{ closureId: string }>()
  const parsed = CardSwitchioClosureIdSchema.safeParse(closureId)

  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingHorizontal: screenPaddingX,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader title={t("settings.cardClosure.detail.title")} />
      {parsed.success ? (
        <Suspense fallback={<LoadingView />}>
          <CardClosureDetail closureId={parsed.data} />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="settings.cardClosure.detail.notFound" />
      )}
    </SafeAreaView>
  )
}

function CardClosureDetail({
  closureId,
}: {
  readonly closureId: CardSwitchioClosureId
}) {
  const [closure] = useEvoluQuery(cardSwitchioClosureByIdQuery(closureId)).data
  if (closure === undefined) {
    return <NotFoundCard messageKey="settings.cardClosure.detail.notFound" />
  }
  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <ClosureResultCard closure={closure} />
    </ScrollView>
  )
}

function ClosureResultCard({
  closure,
}: {
  readonly closure: CardSwitchioClosureListRow
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const deviceLabel = useClosureDeviceLabel()
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
          label={t("settings.cardClosure.result.device")}
          value={deviceLabel(closure)}
        />
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
