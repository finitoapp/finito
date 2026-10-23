import { sqliteTrue } from "@evolu/common"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import { useRedirectIfClosedOnOpen } from "@payky/app-shared/use-redirect-if-closed-on-open"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { cancelBill } from "@payky/core/modules/bill/bill-actions"
import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import { BillId, createRandomBillId } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import {
  deriveBillSummaryStats,
  deriveBillSummaryTotal,
  getBillLineSummaryUnitAmount,
  getLatestCatalogItemSummary,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import {
  catalogItemsPageQuery,
  catalogItemsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import type { CategoryFilter } from "@payky/core/modules/catalog-item/catalog-item-types"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
  type PositiveNumber,
} from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { TableId } from "@payky/core/modules/table/table-types"
import {
  projectSelfPayViewLine,
  sumSelfPayAllocationsByLineKey,
} from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import { selfPayAllocationsByBillIdQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import { remainingOnLine } from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import type { SelfPayViewLine } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { isSameDay } from "date-fns"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import Minus from "lucide-react-native/icons/minus"
import Plus from "lucide-react-native/icons/plus"
import Redo2 from "lucide-react-native/icons/redo-2"
import ScanLine from "lucide-react-native/icons/scan-line"
import ShoppingBag from "lucide-react-native/icons/shopping-bag"
import Split from "lucide-react-native/icons/split"
import Table2 from "lucide-react-native/icons/table-2"
import Trash2 from "lucide-react-native/icons/trash"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import Undo2 from "lucide-react-native/icons/undo-2"
import X from "lucide-react-native/icons/x"
import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native"
import { styled, Text, useTheme, View, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { SearchInput } from "../../components/search-input.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Card, CardContent } from "../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useChangePulse } from "../../hooks/use-change-pulse.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useCreateTerminalPayment } from "../../hooks/use-create-terminal-payment.ts"
import { useDebouncedValue } from "../../hooks/use-debounced-value.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../hooks/use-hardware-scanner.ts"
import { useIsConfirmOpen } from "../../hooks/use-is-confirm-open.ts"
import { useProductLookup } from "../../hooks/use-product-lookup.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useScreenVisit } from "../../hooks/use-screen-visit.ts"
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { hapticButtonPress } from "../../platform/haptics.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { BillCancellationCollisionActions } from "../shared/bill-cancellation-collision-actions.tsx"
import { CategoryFilterBar } from "../shared/category-filter-bar.tsx"
import {
  billStateQueries,
  useBillLineSummaries,
  useBillStatus,
  usePendingPayments,
} from "../shared/use-bill-state.ts"
import { AssignTableDialog } from "./assign-table-dialog.tsx"
import { BillScanView } from "./bill-scan-view.tsx"
import { CreateCatalogItemDialog } from "./create-catalog-item-dialog.tsx"
import { buildItemGridRows } from "./item-grid-rows.ts"
import { ItemQuantityDialog } from "./item-quantity-controls.tsx"
import { ScanCodeCollisionDialog } from "./scan-code-collision-dialog.tsx"
import { SplitBillDialog } from "./split-bill-dialog.tsx"
import { useCartBill } from "./use-cart-bill.ts"
import { useSplitBill } from "./use-split-bill.ts"

/** The category filters, plus "on the bill": only what the bill holds. */
type BillItemFilter = CategoryFilter | "inBill"

const goHome = () => router.dismissTo("/")

/**
 * Like web's `_terminal/bill` route: a missing `billId` gets a freshly minted
 * one before the page renders (a suspended first render would regenerate it on
 * every retry), and an unparseable one is an "invalid id" page. A well-formed
 * id with no row yet is a new cart, not an error.
 */
export function BillRoute() {
  const { t } = useTranslation()
  const { billId, tableId, scan } = useLocalSearchParams<{
    billId?: string
    tableId?: string
    scan?: string
  }>()
  const [mintedId] = useState(createRandomBillId)

  if (billId === undefined || billId === "")
    return (
      <Redirect href={{ pathname: "/bill", params: { billId: mintedId } }} />
    )

  const parsed = BillId.safeParse(billId)
  if (!parsed.success) return <RouteMessage>{t("bill.invalidId")}</RouteMessage>

  return (
    <Suspense fallback={<LoadingView />}>
      <BillPage
        billId={parsed.data}
        // A broken `tableId` is only a lost preselection, as on web.
        initialTableId={
          tableId === undefined ? undefined : TableId.safeParse(tableId).data
        }
        initialScanCode={scan === "" ? undefined : scan}
      />
    </Suspense>
  )
}

function BillPage({
  billId,
  initialTableId,
  initialScanCode,
}: {
  readonly billId: BillId
  readonly initialTableId: TableId | undefined
  /** A code scanned on the home screen, which opened this bill to add it. */
  readonly initialScanCode: string | undefined
}) {
  // The cart's catalog too: `BillCart` mounts below once these are in.
  usePreloadEvoluQueries(
    useMemo(
      () => [
        ...billStateQueries(billId),
        tablesQuery,
        settingsQuery,
        catalogItemsQuery,
        catalogCategoriesQuery,
      ],
      [billId]
    )
  )
  useScreenWakeLock(true)
  const { t } = useTranslation()
  const locale = useLocale()
  // Only meaningful before the bill row exists: it seeds the table the lazily
  // created row is assigned to. Afterwards `bill.tableId` is the truth.
  const [pendingTableId, setPendingTableId] = useState<TableId | null>(
    initialTableId ?? null
  )
  const tables = useEvoluQuery(tablesQuery).data
  const [settings] = useEvoluQuery(settingsQuery).data
  const [bill] = useEvoluQuery(billByIdQuery(billId)).data
  // Since when, as web's subtitle: staff keep their bearings without
  // scrolling to the table button.
  const openedAt = bill === undefined ? undefined : new Date(bill.createdAt)
  const opened =
    openedAt === undefined
      ? undefined
      : t("bill.openedAt", {
          time: isSameDay(openedAt, new Date())
            ? formatTime(openedAt, locale)
            : formatDateTime(openedAt, locale),
        })
  const summaries = useBillLineSummaries(billId)
  const pendingPaymentIds = usePendingPayments(billId)
  const billStatus = useBillStatus(billId)

  // As web: a bill that is already closed when opened (Back, a stale link)
  // goes to its detail, which `sell` alone cannot read, so the PIN gate asks.
  // Decided once per arrival — this bill, this visit of the screen — so a
  // bill paid while the cart is open still shows its message, while a link or
  // Back onto the screen still mounted decides again. A cancellation
  // collision (canceled but funded) stays here: it is resolved from
  // activity/refund, which arrive later.
  const visit = useScreenVisit()
  const closedOnOpen = useRedirectIfClosedOnOpen(
    `${billId}@${visit}`,
    bill !== undefined &&
      billStatus?.status !== "open" &&
      billStatus?.hasCancellationCollision !== true,
    () =>
      router.replace({
        pathname: "/activity/bills/[billId]",
        params: { billId },
      })
  )
  if (closedOnOpen)
    return (
      <YStack flex={1} items="center" justify="center">
        <ActivityIndicator size="large" />
      </YStack>
    )
  if (bill !== undefined && billStatus?.status !== "open")
    return billStatus?.hasCancellationCollision ? (
      <BillCancellationCollisionMessage
        billId={billId}
        currency={bill.currency}
      />
    ) : (
      <BillMessage billId={billId} message={t("bill.closed")} />
    )
  if (pendingPaymentIds.length > 0)
    return <BillLocked paymentIds={pendingPaymentIds} />

  return (
    <BillCart
      billId={billId}
      billExists={bill !== undefined}
      opened={opened}
      tableId={bill === undefined ? pendingTableId : bill.tableId}
      tableName={
        tables.find(
          (table) =>
            table.id === (bill === undefined ? pendingTableId : bill.tableId)
        )?.name
      }
      onTableSeedChange={setPendingTableId}
      title={
        bill === undefined
          ? t("bill.title")
          : (bill.label ?? t("bill.list.label", { number: bill.displayNumber }))
      }
      currency={bill?.currency ?? getFiatCurrency(settings)}
      tipsEnabled={settings?.tipsEnabled === sqliteTrue}
      summaries={summaries}
      claimedSum={billStatus?.claimedSum ?? NonNegativeInteger(0)}
      amountDue={billStatus?.amountDue ?? deriveBillSummaryTotal(summaries)}
      initialScanCode={initialScanCode}
    />
  )
}

function BillMessage({
  billId,
  message,
}: {
  readonly billId: BillId
  readonly message: string
}) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text mt={64} px={24} color="muted-foreground" text="center">
        {message}
      </Text>
      <YStack p="4" gap="2">
        <Button
          size="lg"
          variant="outline"
          label={t("paymentDetail.bill.open")}
          onPress={() =>
            router.push({
              pathname: "/activity/bills/[billId]",
              params: { billId },
            })
          }
        />
        <Button size="lg" label={t("paymentWait.back")} onPress={goHome} />
      </YStack>
    </SafeAreaView>
  )
}

/**
 * The bill-level mirror of the payment collision: this bill was discarded, but
 * its payments already cover its total. Shows what is at stake (the total),
 * links to the payments that funded it and offers the two resolving actions,
 * as web's `BillCancellationCollisionMessage`.
 */
function BillCancellationCollisionMessage({
  billId,
  currency,
}: {
  readonly billId: BillId
  readonly currency: FiatCurrency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const summaries = useBillLineSummaries(billId)
  const claimedPayments = useEvoluQuery(
    claimedPaymentsByBillIdQuery(billId)
  ).data
  const paymentIds = useMemo(
    () => [...new Set(claimedPayments.map((payment) => payment.id))],
    [claimedPayments]
  )

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} p="4" gap="3" justify="center">
        <Alert variant="warning" icon={TriangleAlert}>
          <AlertTitle>{t("bill.collision.title")}</AlertTitle>
          <AlertDescription>{t("bill.collision.description")}</AlertDescription>
        </Alert>
        <Text fontSize={28} fontWeight="600" text="center">
          {formatMoney(
            { value: deriveBillSummaryTotal(summaries), currency },
            locale
          )}
        </Text>
        {paymentIds.map((paymentId, index) => (
          <Button
            size="lg"
            key={paymentId}
            variant="outline"
            label={
              paymentIds.length > 1
                ? t("bill.collision.viewPayment.numbered", {
                    number: index + 1,
                  })
                : t("bill.collision.viewPayment")
            }
            onPress={() =>
              router.push({
                pathname: "/activity/[paymentId]",
                params: { paymentId },
              })
            }
          />
        ))}
        <BillCancellationCollisionActions billId={billId} />
      </YStack>
    </SafeAreaView>
  )
}

function BillLocked({
  paymentIds,
}: {
  readonly paymentIds: ReadonlyArray<PaymentId>
}) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack mt={64} px={24} gap={16} items="center">
        <Text color="muted-foreground" text="center">
          {t("bill.locked")}
        </Text>
        <YStack gap={8}>
          {paymentIds.map((paymentId, index) => (
            <Button
              size="lg"
              key={paymentId}
              variant="outline"
              label={
                paymentIds.length > 1
                  ? t("bill.locked.viewPayment.numbered", {
                      number: index + 1,
                    })
                  : t("bill.locked.viewPayment")
              }
              onPress={() =>
                router.push({
                  pathname: "/payment/[paymentId]",
                  params: { paymentId },
                })
              }
            />
          ))}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}

function BillCart({
  billId,
  billExists,
  opened,
  tableId,
  tableName,
  onTableSeedChange,
  title,
  currency,
  tipsEnabled,
  summaries,
  claimedSum,
  amountDue,
  initialScanCode,
}: {
  readonly billId: BillId
  /** Whether `billId`'s row is written yet; until then there is nothing to discard. */
  readonly billExists: boolean
  /** "Opened at …" once the bill row exists, as web's subtitle. */
  readonly opened: string | undefined
  readonly tableId: TableId | null
  /** The assigned table's name, when there is one. */
  readonly tableName: string | undefined
  readonly onTableSeedChange: (tableId: TableId | null) => void
  readonly title: string
  readonly currency: FiatCurrency
  readonly tipsEnabled: boolean
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
  readonly initialScanCode: string | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const { itemCount } = useMemo(
    () => deriveBillSummaryStats(summaries),
    [summaries]
  )
  const amountDuePulse = useChangePulse(amountDue)
  const cart = useCartBill({ billId, currency, tableId, onTableSeedChange })
  const toast = useToast()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const confirm = useConfirm()
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [scanMode, setScanMode] = useState(false)
  const [lastScanned, setLastScanned] = useState<CatalogItemRow | null>(null)
  const [collisionCandidates, setCollisionCandidates] = useState<
    ReadonlyArray<CatalogItemRow>
  >([])
  const [createCode, setCreateCode] = useState<string | null>(null)
  // Set as soon as an unknown code is scanned, so the lookup runs while the
  // confirmation is open and the form opens prefilled.
  const [lookupCode, setLookupCode] = useState<string | null>(null)
  const productLookup = useProductLookup(lookupCode)
  const [splitOpen, setSplitOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const split = useSplitBill({
    billId,
    tableId,
    currency,
    onDone: () => setSplitOpen(false),
  })
  const createTerminalPayment = useCreateTerminalPayment()
  // The ref closes the window before `chargePending` re-renders: a second tap
  // would create a second payment (core accepts a bill with a pending one) and
  // lock the cart. Same pairing as the keypad and the tip page.
  const chargePendingRef = useRef(false)
  const [chargePending, setChargePending] = useState(false)

  // The payment's amounts and bill-line snapshot are core's
  // (`createPreparedPayment` with `billId`); this only picks the route.
  const charge = async () => {
    if (summaries.length === 0 || chargePendingRef.current) return
    chargePendingRef.current = true
    setChargePending(true)
    try {
      if (tipsEnabled) {
        router.push({
          pathname: "/payment/tip",
          params: { amount: String(amountDue), currency, billId },
        })
        return
      }
      await createTerminalPayment({
        amount: amountDue,
        currency,
        tipAmount: NonNegativeInteger(0),
        billId,
      })
    } finally {
      chargePendingRef.current = false
      setChargePending(false)
    }
  }
  const catalogItems = useEvoluQuery(catalogItemsQuery).data
  const selfPayAllocated = sumSelfPayAllocationsByLineKey(
    useEvoluQuery(selfPayAllocationsByBillIdQuery(billId)).data
  )
  const catalogItemsById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems]
  )
  const currencyItems = useMemo(
    () => catalogItems.filter((item) => item.currency === currency),
    [catalogItems, currency]
  )
  const categories = useEvoluQuery(catalogCategoriesQuery).data

  const addScanned = async (item: CatalogItemRow) => {
    setLastScanned(item)
    const added = await cart.addOne(item)
    // Scan mode shows the scanned item in its own panel; the grid may have
    // it scrolled out of view, so say what was added (as web).
    if (added && !scanMode) {
      toast.success(t("bill.scan.added", { name: getStaffDisplayName(item) }))
    }
  }
  const confirmOpen = useIsConfirmOpen()
  const scanDialogOpen =
    collisionCandidates.length > 0 ||
    createCode !== null ||
    confirmOpen ||
    tablePickerOpen ||
    splitOpen
  // A code matching one item adds it, several ask which one, an unknown one
  // offers to create the item (prefilled from the product lookup) and add it.
  const handleScan = async (rawValue: string) => {
    const matches = findCatalogItemsByScanCode(currencyItems, rawValue)
    const [first] = matches
    if (first === undefined) {
      setLookupCode(rawValue)
      const confirmed = await confirm({
        title: t("bill.scan.unknown.title"),
        description: <UnknownCodeDescription code={rawValue} />,
        confirmLabel: t("bill.scan.unknown.create"),
        cancelLabel: t("bill.scan.unknown.cancel"),
      })
      if (confirmed) setCreateCode(rawValue)
      else setLookupCode(null)
    } else if (matches.length > 1) setCollisionCandidates(matches)
    else await addScanned(first)
  }
  const [search, setSearch] = useState("")
  // At any time, not only in scan mode, as web (scanner/0001).
  useHardwareScanner({
    enabled: !scanDialogOpen,
    onScan: (code) => {
      // A focused search field received the code's characters too.
      if (search.endsWith(code)) setSearch(search.slice(0, -code.length))
      void handleScan(code)
    },
  })
  // Handled once, then dropped from the route so a return to this bill does
  // not add the item a second time.
  const initialScanHandledRef = useRef(false)
  useEffect(() => {
    if (initialScanCode === undefined || initialScanHandledRef.current) return
    initialScanHandledRef.current = true
    router.setParams({ scan: undefined })
    void handleScan(initialScanCode)
  })
  const usedCategoryIds = useMemo(
    () => new Set(currencyItems.map((item) => item.categoryId)),
    [currencyItems]
  )
  const [categoryFilter, setCategoryFilter] = useState<BillItemFilter>("all")
  const inBillItemIds = useMemo(
    () => [
      ...new Set(
        summaries.flatMap((summary) =>
          summary.catalogItemId !== null && summary.quantity > 0
            ? [summary.catalogItemId]
            : []
        )
      ),
    ],
    [summaries]
  )
  // Deferred, so switching a chip never suspends this screen: a suspend here
  // would bubble to the route's boundary and remount the cart mid-tap.
  // The search additionally waits for typing to pause, as web's 250 ms.
  const deferredSearch = useDeferredValue(useDebouncedValue(search, 250))
  const deferredFilter = useDeferredValue(categoryFilter)
  const deferredInBillIds = useDeferredValue(inBillItemIds)
  const gridQuery = useMemo(
    () =>
      catalogItemsPageQuery({
        search: deferredSearch,
        categoryFilter: deferredFilter === "inBill" ? "all" : deferredFilter,
        currency,
        ...(deferredFilter === "inBill"
          ? { catalogItemIds: deferredInBillIds }
          : {}),
        // The whole catalog, unsearched, keeps each category's items
        // together, as web.
        groupByCategory:
          deferredFilter === "all" && deferredSearch.trim() === "",
        // ponytail: no paging, the list is virtualized; raise or page if a
        // catalog ever outgrows this.
        limit: 10_000,
      }),
    [deferredSearch, deferredFilter, deferredInBillIds, currency]
  )
  const gridItems = useEvoluQuery(gridQuery).data
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  // The group an item is headed under; a deleted category's items join the
  // uncategorized, as the grouped query sorts them.
  const categoryGroupOf = (item: CatalogItemRow) =>
    item.categoryId !== null && categoriesById.has(item.categoryId)
      ? item.categoryId
      : null
  // As web: headings on the whole, unsearched catalog, and only when there is
  // more than one group to tell apart.
  const showCategoryHeadings =
    deferredFilter === "all" &&
    deferredSearch.trim() === "" &&
    new Set(currencyItems.map(categoryGroupOf)).size > 1
  const gridRows = buildItemGridRows(
    gridItems,
    categoryGroupOf,
    showCategoryHeadings
  )
  // The action runs long after this render, so it must not capture it:
  // `cart.undo` reads the top of its stack when it runs, as web's.
  const showUndoToast = (message: string) =>
    toast.withAction(message, {
      label: t("bill.summary.undo"),
      onPress: () => void cart.undo(),
    })
  // Closes itself when the last line goes and nothing is left to undo, as
  // its trigger is then off (web's).
  const summaryExpanded = summaryOpen && (summaries.length > 0 || cart.canUndo)
  const handleClear = async () => {
    if (await cart.clear(summaries)) {
      showUndoToast(t("bill.summary.clear.toast"))
    }
  }
  // As web: confirm first, then `discard` (access/0002), then cancel the bill
  // and leave it.
  const handleDiscard = async () => {
    if (!billExists) return
    const confirmed = await confirm({
      title: t("bill.discard.confirm.title"),
      description: t("bill.discard.confirm.description"),
      confirmLabel: t("bill.discard.confirm.confirm"),
      cancelLabel: t("bill.discard.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    if (!(await require("discard", "access.action.discardBill"))) return
    await runToast(async (run) => {
      const result = await run(cancelBill(billId))
      if (!result.ok) {
        nativeConsole.error("Failed to discard cart", result.error)
        return "app.saveFailed"
      }
      router.back()
    })
  }
  const inBillFilterOptions = useMemo(
    () => [{ value: "inBill" as const, label: t("bill.filter.inBill") }],
    [t]
  )

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{
        flex: 1,
        paddingHorizontal: 12,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader
        title={title}
        subtitle={
          [tableName, opened]
            .filter((part) => part !== undefined)
            .join(" · ") || undefined
        }
      />

      <XStack mt={8} gap={8} items="center">
        <YStack flex={1} minW={0}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("bill.search")}
            clearAriaLabel={t("bill.search.clear.aria")}
          />
        </YStack>
        <Button
          variant={scanMode ? "default" : "outline"}
          size="icon"
          w={48}
          h={48}
          shrink={0}
          iconStart={ScanLine}
          aria-label={t("bill.scan.toggle.aria")}
          aria-selected={scanMode}
          onPress={() => setScanMode((on) => !on)}
        />
      </XStack>
      {scanMode ? null : (
        <YStack mt={8}>
          <CategoryFilterBar
            categories={categories}
            usedCategoryIds={usedCategoryIds}
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            allLabel={t("bill.category.all")}
            uncategorizedLabel={t("bill.category.uncategorized")}
            extraOptions={inBillFilterOptions}
          />
        </YStack>
      )}

      <YStack flex={1} mt={8}>
        {scanMode ? (
          <BillScanView
            paused={scanDialogOpen}
            onScan={handleScan}
            lastScanned={
              lastScanned === null ? null : (
                <ItemBrick
                  catalogItem={lastScanned}
                  summaries={summaries}
                  locale={locale}
                  onAdd={() => void cart.addOne(lastScanned)}
                  onAddQuantity={(quantity) =>
                    void cart.addQuantity(lastScanned, quantity)
                  }
                  onRemove={(summary) => void cart.removeOne(summary)}
                />
              )
            }
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
            data={gridRows}
            keyExtractor={(row) => row.key}
            ListEmptyComponent={
              currencyItems.length === 0 ? (
                <CatalogEmpty />
              ) : (
                <Text mt={40} color="muted-foreground" text="center">
                  {t(
                    categoryFilter === "inBill" && search === ""
                      ? "bill.filter.inBill.empty"
                      : "bill.emptySearch"
                  )}
                </Text>
              )
            }
            renderItem={({ item: row, index }) =>
              row.type === "heading" ? (
                // Web's `h3 px-1 pt-4 text-sm font-semibold
                // text-muted-foreground first:pt-0`; the list gap is 8 of it.
                <Text
                  role="heading"
                  aria-level={3}
                  px={4}
                  pt={index === 0 ? 0 : 8}
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  fontWeight={fontWeight.semibold}
                  color="muted-foreground"
                >
                  {row.group === null
                    ? t("bill.category.uncategorized")
                    : categoriesById.get(row.group)?.name}
                </Text>
              ) : (
                <XStack gap={8}>
                  {row.items.map((item) => (
                    <View key={item.id} flex={1}>
                      <ItemBrick
                        catalogItem={item}
                        summaries={summaries}
                        locale={locale}
                        onAdd={() => void cart.addOne(item)}
                        onAddQuantity={(quantity) =>
                          void cart.addQuantity(item, quantity)
                        }
                        onRemove={(summary) => void cart.removeOne(summary)}
                      />
                    </View>
                  ))}
                  {/* An odd last brick keeps its column. */}
                  {row.items.length === 1 ? <View flex={1} /> : null}
                </XStack>
              )
            }
          />
        )}
      </YStack>
      <CreateCatalogItemDialog
        scanCode={createCode}
        productLookup={productLookup}
        currency={currency}
        onClose={() => {
          setCreateCode(null)
          setLookupCode(null)
        }}
        onCreated={(item) => {
          setCreateCode(null)
          setLookupCode(null)
          void addScanned(item)
        }}
      />
      <ScanCodeCollisionDialog
        candidates={collisionCandidates}
        onClose={() => setCollisionCandidates([])}
        onSelect={(item) => {
          setCollisionCandidates([])
          void addScanned(item)
        }}
      />
      <AssignTableDialog
        open={tablePickerOpen}
        onClose={() => setTablePickerOpen(false)}
        billId={billId}
        currentTableId={tableId}
        onAssign={(nextTableId) => {
          setTablePickerOpen(false)
          void cart.assignTable(nextTableId)
        }}
      />
      <SplitBillDialog
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        billId={billId}
        summaries={summaries}
        currency={currency}
        pending={split.pending}
        onConfirm={(input) => void split.split(input)}
      />

      {summaryExpanded ? (
        // Web's backdrop: dims the screen while the summary is open, and a
        // tap on it closes the summary instead of adding an item. Wider
        // than the screen padding, as the panel is.
        <Pressable
          accessible={false}
          testID="bill-summary-backdrop"
          onPress={() => setSummaryOpen(false)}
          style={{
            position: "absolute",
            top: 0,
            right: -12,
            bottom: 0,
            left: -12,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        />
      ) : null}
      {/* The bottom panel: the bill's summary, collapsed to its total. */}
      <Card
        mx={-12}
        py={0}
        gap={0}
        borderBottomWidth={0}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
      >
        <SafeAreaView edges={["bottom"]}>
          <CardContent pb={16}>
            <Collapsible open={summaryExpanded} onOpenChange={setSummaryOpen}>
              <CollapsibleTrigger
                testID="bill-summary-trigger"
                pt={16}
                disabled={summaries.length === 0 && !cart.canUndo}
              >
                <XStack items="center" justify="space-between" gap={8}>
                  <XStack items="center" gap={8}>
                    <Icon icon={ShoppingBag} color="muted-foreground" />
                    <Text
                      fontSize={fontSize.base}
                      lineHeight={fontSize.base}
                      color="muted-foreground"
                    >
                      {t("bill.itemsCount", { value: itemCount })}
                    </Text>
                  </XStack>
                  <XStack items="center" gap={8}>
                    <Animated.View style={amountDuePulse}>
                      <Text
                        fontSize={fontSize.base}
                        lineHeight={fontSize.base}
                        fontWeight={fontWeight.semibold}
                        fontVariant={["tabular-nums"]}
                      >
                        {formatMoney({ value: amountDue, currency }, locale)}
                      </Text>
                    </Animated.View>
                    <CollapsibleChevron direction="up" />
                  </XStack>
                </XStack>
              </CollapsibleTrigger>
              <CollapsibleContent pt={16} testID="bill-summary-panel">
                <ScrollView style={{ maxHeight: 192 }}>
                  {summaries.map((summary) => (
                    <SummaryRow
                      key={summary.id}
                      summary={summary}
                      selfPayLine={projectSelfPayViewLine(
                        summary,
                        selfPayAllocated
                      )}
                      locale={locale}
                      disabled={cart.pending}
                      catalogItem={
                        summary.catalogItemId === null
                          ? undefined
                          : catalogItemsById.get(summary.catalogItemId)
                      }
                      onAddOne={(catalogItem) => void cart.addOne(catalogItem)}
                      onRemoveOne={() => void cart.removeOne(summary)}
                      onRemove={async () => {
                        // A failed removal recorded nothing, so offering to
                        // undo it would invert the change before it.
                        if (await cart.removeLine(summary)) {
                          showUndoToast(
                            t("bill.summary.removeLine.toast", {
                              name: summary.name,
                            })
                          )
                        }
                      }}
                    />
                  ))}
                </ScrollView>
                <BillAlreadyPaid
                  claimedSum={claimedSum}
                  amountDue={amountDue}
                  currency={currency}
                  locale={locale}
                />
                <XStack items="center" justify="space-between" pt={16} py={8}>
                  <XStack gap={4}>
                    <Button
                      variant="outline"
                      size="sm"
                      h={44}
                      px={12}
                      iconStart={Undo2}
                      label={t("bill.summary.undo")}
                      disabled={!cart.canUndo || cart.pending}
                      onPress={() => void cart.undo()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      h={44}
                      px={12}
                      iconStart={Redo2}
                      label={t("bill.summary.redo")}
                      disabled={!cart.canRedo || cart.pending}
                      onPress={() => void cart.redo()}
                    />
                  </XStack>
                  <Button
                    variant="outline"
                    size="sm"
                    h={44}
                    px={12}
                    label={t("bill.summary.clear")}
                    disabled={summaries.length === 0 || cart.pending}
                    onPress={() => void handleClear()}
                  />
                </XStack>
              </CollapsibleContent>
            </Collapsible>
            <XStack items="center" gap={8} pt={16}>
              <Button
                variant="outline"
                size="icon"
                w={48}
                h={48}
                shrink={0}
                // Kept apart from the everyday buttons beside it.
                mr={12}
                iconStart={Trash2}
                labelColor="destructive"
                aria-label={t("bill.discard")}
                disabled={!billExists}
                onPress={() => void handleDiscard()}
              />
              <Button
                variant="outline"
                size="icon"
                w={48}
                h={48}
                shrink={0}
                iconStart={Split}
                aria-label={t("bill.split.button.aria")}
                disabled={
                  summaries.length === 0 || cart.pending || split.pending
                }
                onPress={() => setSplitOpen(true)}
              />
              <Button
                variant="outline"
                flex={1}
                h={48}
                iconStart={Table2}
                aria-label={t("bill.table.aria")}
                label={tableName ?? t("bill.table.assign")}
                onPress={() => setTablePickerOpen(true)}
              />
              <Button
                flex={1}
                h={48}
                aria-label={t("home.pay")}
                pending={chargePending}
                disabled={summaries.length === 0}
                onPress={() => {
                  hapticButtonPress()
                  void charge()
                }}
              >
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  fontWeight={fontWeight.bold}
                  color="primary-foreground"
                >
                  {t("home.pay")}
                </Text>
              </Button>
            </XStack>
          </CardContent>
        </SafeAreaView>
      </Card>
    </SafeAreaView>
  )
}

function SummaryRow({
  summary,
  selfPayLine,
  locale,
  disabled,
  catalogItem,
  onAddOne,
  onRemoveOne,
  onRemove,
}: {
  readonly summary: BillLineSummary
  readonly selfPayLine: SelfPayViewLine
  readonly locale: string
  readonly disabled: boolean
  /** The line's catalog item, when it still exists to add another of. */
  readonly catalogItem: CatalogItemRow | undefined
  readonly onAddOne: (catalogItem: CatalogItemRow) => void
  readonly onRemoveOne: () => void
  readonly onRemove: () => void
}) {
  const { t } = useTranslation()
  const money = (value: number) =>
    formatMoney({ value: Integer(value), currency: summary.currency }, locale)
  // As web's, the line's quantity and amount pulse together on a new quantity.
  const pulse = useChangePulse(summary.quantity)

  return (
    <XStack py={4} gap={8} items="center" justify="space-between">
      <YStack flex={1} minW={0}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          numberOfLines={1}
        >
          {summary.name}
        </Text>
        {/* A single piece costs what the line total already says. */}
        {summary.quantity === 1 ? null : (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
            fontVariant={["tabular-nums"]}
          >
            {summary.quantity} × {money(getBillLineSummaryUnitAmount(summary))}
          </Text>
        )}
        <SelfPayLineStatus
          line={selfPayLine}
          currency={summary.currency}
          locale={locale}
        />
      </YStack>
      {/* No `disabled` on "−"/"+": the cart queues taps, and a button disabled mid-tap drops one. */}
      <XStack
        shrink={0}
        items="center"
        gap={2}
        rounded={radius.md}
        bg="muted"
        p={2}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          rounded={radius.full}
          iconStart={Minus}
          aria-label={t("bill.summary.decrement.aria", {
            name: summary.name,
          })}
          onPress={onRemoveOne}
        />
        <Animated.View style={pulse}>
          <Text
            minW={24}
            text="center"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
            fontVariant={["tabular-nums"]}
          >
            {summary.quantity}
          </Text>
        </Animated.View>
        <Button
          variant="ghost"
          size="icon-sm"
          rounded={radius.full}
          iconStart={Plus}
          aria-label={t("bill.summary.increment.aria", {
            name: summary.name,
          })}
          disabled={catalogItem === undefined}
          onPress={() => {
            if (catalogItem !== undefined) onAddOne(catalogItem)
          }}
        />
      </XStack>
      <Animated.View style={pulse}>
        <Text
          minW={80}
          text="right"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
        >
          {money(summary.totalAmount)}
        </Text>
      </Animated.View>
      <Button
        variant="ghost"
        size="icon-sm"
        iconStart={X}
        aria-label={t("bill.summary.removeLine.aria", {
          name: summary.name,
        })}
        disabled={disabled}
        onPress={onRemove}
      />
    </XStack>
  )
}

/** As web's `BillAlreadyPaid`: what the bill holds and what is left. */
function BillAlreadyPaid({
  claimedSum,
  amountDue,
  currency,
  locale,
}: {
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly locale: string
}) {
  const { t } = useTranslation()
  if (claimedSum === 0) return null

  return (
    <YStack gap={4} pt={8}>
      <XStack items="baseline" justify="space-between">
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("bill.summary.alreadyPaid")}
        </Text>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          fontVariant={["tabular-nums"]}
        >
          {formatMoney({ value: claimedSum, currency }, locale)}
        </Text>
      </XStack>
      <XStack items="baseline" justify="space-between">
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
        >
          {t("bill.summary.leftToPay")}
        </Text>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
        >
          {formatMoney({ value: amountDue, currency }, locale)}
        </Text>
      </XStack>
    </YStack>
  )
}

/** As web's `SelfPayLineStatus`: what guests paid of a line. */
function SelfPayLineStatus({
  line,
  currency,
  locale,
}: {
  readonly line: SelfPayViewLine
  readonly currency: FiatCurrency
  readonly locale: string
}) {
  const { t } = useTranslation()
  if (line.allocatedAmount === 0) return null
  const remaining = remainingOnLine(line)

  return (
    <Text
      testID="bill-summary-self-pay"
      fontSize={fontSize.xs}
      lineHeight={fontSize.xs}
      color="primary"
      fontVariant={["tabular-nums"]}
    >
      {remaining === 0
        ? t("bill.summary.selfPay.paid")
        : t("bill.summary.selfPay.partlyPaid", {
            paid: formatMoney(
              { value: NonNegativeInteger(line.allocatedAmount), currency },
              locale
            ),
            remaining: formatMoney(
              { value: NonNegativeInteger(remaining), currency },
              locale
            ),
          })}
    </Text>
  )
}

/** As web's `BillEmptyCatalog`: what is missing and the way to add it. */
function CatalogEmpty() {
  const { t } = useTranslation()
  return (
    <YStack items="center" gap={12}>
      <Text
        fontSize={fontSize.lg}
        lineHeight={fontSize.lg}
        fontWeight={fontWeight.semibold}
        text="center"
      >
        {t("catalog.items.empty.title")}
      </Text>
      <Text
        maxW={288}
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
        text="center"
      >
        {t("catalog.items.empty.description")}
      </Text>
      <Button
        variant="outline"
        label={t("catalog.items.add")}
        onPress={() => router.push("/settings/items/new")}
      />
    </YStack>
  )
}

/**
 * A tap anywhere on the tile adds one, as on a till. The brick has no
 * `disabled`: the cart queues taps, and a button disabled mid-tap drops one.
 */
function ItemBrick({
  catalogItem,
  summaries,
  locale,
  onAdd,
  onAddQuantity,
  onRemove,
}: {
  readonly catalogItem: CatalogItemRow
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly locale: string
  readonly onAdd: () => void
  readonly onAddQuantity: (quantity: PositiveNumber) => void
  readonly onRemove: (summary: BillLineSummary) => void
}) {
  const { t } = useTranslation()
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false)
  const name = getStaffDisplayName(catalogItem)
  const quantity = summaries.reduce(
    (sum, summary) =>
      summary.catalogItemId === catalogItem.id ? sum + summary.quantity : sum,
    0
  )
  const latestSummary = getLatestCatalogItemSummary(summaries, catalogItem.id)
  const quantityPulse = useChangePulse(quantity)

  const inCart = quantity > 0

  return (
    // grow, not flex: flex 1 is a zero basis, which collapses the tile on
    // web, where views also have no minimum height.
    <Card grow={1} p={12} gap={4} bg={inCart ? "primary-15" : "card"}>
      {/*
       * A tap anywhere on the tile adds one, as on a till; the corner
       * controls above it are kept in the layout but invisible until the
       * item is on the bill, so the tile does not reflow under the finger.
       */}
      <View
        position="absolute"
        t={0}
        r={0}
        b={0}
        l={0}
        bg="transparent press:card-ring"
        role="button"
        aria-label={t("bill.brick.add.aria", { name })}
        cursor="web:pointer"
        onPress={() => {
          hapticButtonPress()
          onAdd()
        }}
      />
      <XStack
        items="flex-start"
        justify="space-between"
        gap={8}
        pointerEvents="box-none"
      >
        <Text
          flex={1}
          pt={2}
          fontWeight={fontWeight.medium}
          pointerEvents="none"
        >
          {name}
        </Text>
        <Button
          size="sm"
          shrink={0}
          h={28}
          minW={28}
          px={8}
          rounded={radius.full}
          opacity={inCart ? 1 : 0}
          disabled={!inCart}
          aria-hidden={!inCart}
          aria-label={t("bill.brick.quantity.trigger.aria", { name })}
          onPress={() => setQuantityDialogOpen(true)}
        >
          <Animated.View style={quantityPulse}>
            <Text
              fontSize={12.8}
              fontWeight={fontWeight.bold}
              fontVariant={["tabular-nums"]}
              color="primary-foreground"
            >
              {quantity}
            </Text>
          </Animated.View>
        </Button>
      </XStack>
      <XStack
        items="flex-end"
        justify="space-between"
        gap={8}
        pointerEvents="box-none"
      >
        <Text
          pb={4}
          fontWeight={fontWeight.semibold}
          color="foreground-70"
          fontVariant={["tabular-nums"]}
          pointerEvents="none"
        >
          {formatMoney(
            { value: catalogItem.unitAmount, currency: catalogItem.currency },
            locale
          )}
        </Text>
        <Button
          variant="secondary"
          size="icon"
          w={40}
          h={40}
          shrink={0}
          rounded={radius.full}
          iconStart={Minus}
          aria-label={t("bill.brick.remove.aria", { name })}
          opacity={inCart ? 1 : 0}
          disabled={!inCart}
          onPress={() => {
            if (latestSummary === undefined) return
            hapticButtonPress()
            onRemove(latestSummary)
          }}
        />
      </XStack>
      <ItemQuantityDialog
        name={name}
        open={quantityDialogOpen}
        onOpenChange={setQuantityDialogOpen}
        onAddQuantity={onAddQuantity}
      />
    </Card>
  )
}

/**
 * The unknown-code confirmation's description, as web's: the code, then what
 * the product lookup recognized. Rendered by the confirm host, outside this
 * page, so it subscribes to the lookup itself — the same query key as the
 * page's, so it shares that request and fills in the moment it answers.
 */
function UnknownCodeDescription({ code }: { readonly code: string }) {
  const { t } = useTranslation()

  return (
    <YStack>
      <DescriptionText>
        {t("bill.scan.unknown.description", { code })}
      </DescriptionText>
      {/* The lookup's device-settings read may suspend; the code shows meanwhile. */}
      <Suspense fallback={null}>
        <UnknownCodeMatch code={code} />
      </Suspense>
    </YStack>
  )
}

function UnknownCodeMatch({ code }: { readonly code: string }) {
  const { t } = useTranslation()
  const { product, isFetching } = useProductLookup(code)

  if (isFetching) {
    return (
      <DescriptionText mt={12}>{t("bill.scan.lookup.loading")}</DescriptionText>
    )
  }
  if (product === undefined) return null
  return (
    <YStack mt={12}>
      <DescriptionText>{t("bill.scan.unknown.match")}</DescriptionText>
      <DescriptionText color="foreground" fontWeight={fontWeight.medium}>
        {product.name}
      </DescriptionText>
      {product.description === null ? null : (
        <DescriptionText>{product.description}</DescriptionText>
      )}
      <DescriptionText mt={4} fontSize={fontSize.xs} lineHeight={fontSize.xs}>
        {t("bill.scan.lookup.source", { source: product.source })}
      </DescriptionText>
    </YStack>
  )
}

/** `AlertDialogDescription`'s look, one block per line as web's spans. */
const DescriptionText = styled(Text, {
  text: "center",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
  color: "muted-foreground",
})
