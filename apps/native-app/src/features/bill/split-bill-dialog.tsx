import {
  canConfirmSplit,
  deriveSplitItems,
  type SplitBillConfirmInput,
  type SplitDestination,
  type SplitSelection,
  selectAllForSplit,
  setSplitQuantity,
} from "@payky/app-shared/split-selection"
import {
  type OpenBillRow,
  openBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import {
  calculateBillLineSummaries,
  deriveBillSummaryStats,
} from "@payky/core/modules/bill-line/bill-line-utils"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import Minus from "lucide-react-native/icons/minus"
import Plus from "lucide-react-native/icons/plus"
import { useMemo, useState } from "react"
import { Animated } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useChangePulse } from "../../hooks/use-change-pulse.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { hapticButtonPress } from "../../platform/haptics.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"

/**
 * Native counterpart of web's `SplitBillDialog`: pick how many units of each
 * line move to a new bill or an open one of the same currency, drawn as web's
 * dialog: the destination as an outline toggle group, the lines with round
 * ghost −/+ steppers, and the selected count, total and buttons in the
 * footer. The whole card scrolls (web scrolls only the lines). The selection
 * lives in the mounted body, which exists only while open, so every opening
 * starts empty (cancel discards the draft, as on web).
 */
export function SplitBillDialog({
  open,
  onClose,
  billId,
  summaries,
  currency,
  pending,
  onConfirm,
}: {
  readonly open: boolean
  readonly onClose: () => void
  /** The current (source) bill, left out of the "existing bill" list. */
  readonly billId: BillId
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly currency: FiatCurrency
  readonly pending: boolean
  readonly onConfirm: (input: SplitBillConfirmInput) => void
}) {
  return (
    <Dialog
      open={open}
      dismissOnOverlayPress={!pending}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {open ? (
        <SplitBillBody
          onClose={onClose}
          billId={billId}
          summaries={summaries}
          currency={currency}
          pending={pending}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  )
}

function SplitBillBody({
  onClose,
  billId,
  summaries,
  currency,
  pending,
  onConfirm,
}: Omit<Parameters<typeof SplitBillDialog>[0], "open">) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [selected, setSelected] = useState<SplitSelection>({})
  const [destination, setDestination] = useState<SplitDestination>("new")
  const [targetBillId, setTargetBillId] = useState<BillId | null>(null)
  const openBills = useEvoluQuery(openBillsQuery).data
  const tables = useEvoluQuery(tablesQuery).data
  // Same currency only: a bill's lines are priced in its own currency.
  const otherOpenBills = useMemo(
    () =>
      openBills.filter(
        (candidate) =>
          candidate.id !== billId && candidate.currency === currency
      ),
    [openBills, billId, currency]
  )
  const items = useMemo(
    () => deriveSplitItems(summaries, selected),
    [summaries, selected]
  )
  const { itemCount, totalAmount } = deriveBillSummaryStats(items)
  const itemCountPulse = useChangePulse(itemCount)
  const totalAmountPulse = useChangePulse(totalAmount)
  const canConfirm = canConfirmSplit({
    itemCount: items.length,
    pending,
    destination,
    targetBillId,
  })

  const confirm = () => {
    if (destination === "new") {
      onConfirm({ destination: "new", items })
      return
    }
    if (targetBillId === null) return
    onConfirm({ destination: "existing", targetBillId, items })
  }

  return (
    <DialogContent closeLabel={t("dialog.close")}>
      <DialogHeader>
        <DialogTitle>{t("bill.split.title")}</DialogTitle>
        <DialogDescription>{t("bill.split.description")}</DialogDescription>
      </DialogHeader>

      <YStack gap={8}>
        <ToggleGroup
          value={destination}
          onValueChange={setDestination}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="new" flex={1}>
            {t("bill.split.destination.new")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="existing"
            flex={1}
            disabled={otherOpenBills.length === 0}
          >
            {t("bill.split.destination.existing")}
          </ToggleGroupItem>
        </ToggleGroup>

        {destination === "existing" ? (
          <YStack gap={4} p={4} rounded={radius.md} bg="neutral-soft">
            {otherOpenBills.length === 0 ? (
              <Text
                p={8}
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("bill.split.destination.existing.empty")}
              </Text>
            ) : (
              otherOpenBills.map((bill) => (
                <ExistingBillOption
                  key={bill.id}
                  bill={bill}
                  tableName={
                    tables.find((table) => table.id === bill.tableId)?.name ??
                    null
                  }
                  selected={bill.id === targetBillId}
                  onSelect={() => setTargetBillId(bill.id)}
                />
              ))
            )}
          </YStack>
        ) : null}

        <XStack justify="flex-end" gap={4}>
          <Button
            size="xs"
            variant="ghost"
            label={t("bill.split.selectAll")}
            onPress={() => setSelected(selectAllForSplit(summaries))}
          />
          <Button
            size="xs"
            variant="ghost"
            label={t("bill.split.clearSelection")}
            onPress={() => setSelected({})}
          />
        </XStack>
      </YStack>

      <YStack>
        {summaries.map((summary) => (
          <SplitBillRow
            key={summary.id}
            summary={summary}
            quantity={selected[summary.id] ?? 0}
            onChange={(quantity) =>
              setSelected((current) =>
                setSplitQuantity(current, summary, quantity)
              )
            }
          />
        ))}
      </YStack>

      <DialogFooter flexDirection="column">
        <XStack justify="space-between">
          {/* Only the count pulses, as web's; the e2e flow reads it by its
              testID. */}
          <XStack items="center" gap={4}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
            >
              {t("bill.split.selectedCount")}
            </Text>
            <Animated.View style={itemCountPulse}>
              <Text
                testID="bill-split-selected-count"
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                fontVariant={["tabular-nums"]}
              >
                {itemCount}
              </Text>
            </Animated.View>
          </XStack>
          <Animated.View style={totalAmountPulse}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
            >
              {formatMoney({ value: totalAmount, currency }, locale)}
            </Text>
          </Animated.View>
        </XStack>
        <XStack gap={8}>
          <Button
            size="lg"
            flex={1}
            variant="outline"
            label={t("bill.split.cancel")}
            onPress={onClose}
          />
          <Button
            size="lg"
            flex={1}
            label={t("bill.split.confirm")}
            pending={pending}
            disabled={!canConfirm}
            onPress={confirm}
          />
        </XStack>
      </DialogFooter>
    </DialogContent>
  )
}

function ExistingBillOption({
  bill,
  tableName,
  selected,
  onSelect,
}: {
  readonly bill: OpenBillRow
  readonly tableName: string | null
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { itemCount, totalAmount } = useMemo(
    () =>
      deriveBillSummaryStats(
        calculateBillLineSummaries(bill.lines, bill.items)
      ),
    [bill]
  )

  return (
    // The row itself takes the press: a `press:` clause makes a Tamagui view
    // its own touch responder, which kept a wrapping Pressable from ever
    // seeing the tap on Android.
    <XStack
      role="button"
      aria-selected={selected}
      cursor="web:pointer"
      onPress={onSelect}
      gap={8}
      p={8}
      items="center"
      justify="space-between"
      rounded={radius.md}
      bg={selected ? "accent" : "transparent press:neutral-soft"}
    >
      <YStack flex={1} minW={0}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          numberOfLines={1}
        >
          {bill.label ?? t("bill.list.label", { number: bill.displayNumber })}
        </Text>
        {tableName === null ? null : (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
            numberOfLines={1}
          >
            {tableName}
          </Text>
        )}
      </YStack>
      <YStack shrink={0} items="flex-end" gap={2}>
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
        >
          {t("bill.itemsCount", { value: itemCount })}
        </Text>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
        >
          {formatMoney({ value: totalAmount, currency: bill.currency }, locale)}
        </Text>
      </YStack>
    </XStack>
  )
}

function SplitBillRow({
  summary,
  quantity,
  onChange,
}: {
  readonly summary: BillLineSummary
  readonly quantity: number
  readonly onChange: (quantity: number) => void
}) {
  const { t } = useTranslation()
  const quantityPulse = useChangePulse(quantity)
  return (
    <XStack py={8} gap={8} items="center" justify="space-between">
      <YStack flex={1} minW={0}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          numberOfLines={1}
        >
          {summary.name}
        </Text>
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
        >
          {t("bill.split.availableCount", { value: summary.quantity })}
        </Text>
      </YStack>
      <XStack
        items="center"
        gap={4}
        rounded={radius.md}
        bg="surface-raised"
        p={4}
      >
        <Button
          variant="ghost"
          size="icon"
          rounded={radius.full}
          iconStart={Minus}
          aria-label={t("bill.split.decrease.aria", {
            name: summary.name,
          })}
          disabled={quantity === 0}
          onPress={() => {
            hapticButtonPress()
            onChange(quantity - 1)
          }}
        />
        <Animated.View style={quantityPulse}>
          <Text
            minW={24}
            text="center"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
            fontVariant={["tabular-nums"]}
          >
            {quantity}
          </Text>
        </Animated.View>
        <Button
          variant="ghost"
          size="icon"
          rounded={radius.full}
          iconStart={Plus}
          aria-label={t("bill.split.increase.aria", {
            name: summary.name,
          })}
          disabled={quantity >= summary.quantity}
          onPress={() => {
            hapticButtonPress()
            onChange(quantity + 1)
          }}
        />
      </XStack>
    </XStack>
  )
}
