import { useMediaQuery } from "@dedalik/use-react"
import { sqliteTrue } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { SplitBillConfirmInput } from "@payky/app-shared/split-selection"
import { useRedirectIfClosedOnOpen } from "@payky/app-shared/use-redirect-if-closed-on-open"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import {
  cancelBill,
  type SplitBillError,
  splitBill,
  splitBillIntoNewBill,
} from "@payky/core/modules/bill/bill-actions"
import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import {
  type BillId,
  createRandomBillId,
} from "@payky/core/modules/bill/bill-types"
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
import { getStaffDisplayName } from "@payky/core/modules/catalog-item/catalog-item-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  type FiatCurrency as FiatCurrencyType,
  NonNegativeInteger,
  type PositiveNumber,
} from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import type { TableId } from "@payky/core/modules/table/table-types"
import {
  projectSelfPayViewLine,
  sumSelfPayAllocationsByLineKey,
} from "@payky/core/modules/table-self-pay/table-self-pay-projection-utils"
import { selfPayAllocationsByBillIdQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import { remainingOnLine } from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import type { SelfPayViewLine } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { isSameDay } from "date-fns"
import { useStore } from "jotai"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ChevronDown,
  CircleCheckIcon,
  Eraser,
  Minus,
  Plus,
  Redo2,
  ScanLineIcon,
  ShoppingBag,
  Split,
  Table2,
  Trash2Icon,
  Undo2,
  X,
} from "lucide-react"
import { motion } from "motion/react"
import {
  Fragment,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { SearchInput } from "@/components/search-input.tsx"
import { Button, buttonVariants } from "@/components/ui/button.tsx"
import { Card, CardContent } from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import { AssignTableDialog } from "@/features/bill/assign-table-dialog.tsx"
import { BillScanView } from "@/features/bill/bill-scan-view.tsx"
import {
  ItemBrickGridSkeleton,
  itemBrickGridClassName,
} from "@/features/bill/item-brick-grid-skeleton.tsx"
import { ItemQuantityDialog } from "@/features/bill/item-quantity-controls.tsx"
import { SplitBillDialog } from "@/features/bill/split-bill-dialog.tsx"
import { useBillInsertMode } from "@/features/bill/use-bill-insert-mode.ts"
import { useBillScanHandler } from "@/features/bill/use-bill-scan-handler.tsx"
import { useCartBill } from "@/features/bill/use-cart-bill.ts"
import { useChangePulse } from "@/features/bill/use-change-pulse.ts"
import { useCoveringEditQuestion } from "@/features/bill/use-covering-edit-question.ts"
import { useGuestMoneyArrivals } from "@/features/bill/use-guest-money-arrivals.ts"
import { usePendingPayments } from "@/features/bill/use-pending-payments.ts"
import { billStateQueries } from "@/features/shared/bill-state-queries.ts"
import { CategoryFilterBar } from "@/features/shared/category-filter-bar.tsx"
import { useBillCancellationCollisionActions } from "@/features/shared/use-bill-cancellation-collision-actions.ts"
import { useBillLineSummaries } from "@/features/shared/use-bill-line-summaries.ts"
import { useBillStatus } from "@/features/shared/use-bill-status.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useCreateTerminalPayment } from "@/hooks/use-create-terminal-payment.ts"
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner.ts"
import { useInfiniteEvoluQuery } from "@/hooks/use-infinite-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"
import { vibrateOnButtonPress } from "@/platform/haptics.ts"

/** The category filters, plus "on the bill": only what the bill holds. */
type BillItemFilter = CategoryFilter | "inBill"

const splitBillErrorKeys = {
  BillNotFound: "bill.split.error",
  BillStatusNotAllowed: "bill.split.error",
  BillLocked: "bill.locked",
  // The selection no longer matches the bill, so retrying the same one
  // cannot work — say so, rather than the generic "try again".
  BillSplitSelectionStale: "bill.split.staleSelection",
  BillSplitLeavesOverpayment: "bill.split.leavesOverpayment",
} satisfies Record<SplitBillError["type"], TranslationKey>

/**
 * The whole bill screen — the cart before its bill row exists and the cart
 * of an already-created bill, plus the closed/locked messages — lives in
 * this one component on purpose, so it never remounts across the moment the
 * first added item lazily creates the row: a remount tears down every DOM
 * node under it, and a tap whose press and release straddle that swap is
 * silently dropped by the browser (its click event lands on the two nodes'
 * common ancestor, never on the button). `billId` itself is stable from the
 * first render — generated client-side and put in the URL by whatever
 * linked here (see `pos-overview-page.tsx`'s `NewBillLink`, and
 * `_terminal.bill.tsx`'s `beforeLoad` for a direct navigation with none) —
 * only its row's existence changes mid-session, which is why the
 * bill-scoped hooks below all tolerate a `billId` whose row hasn't been
 * created yet.
 */
export function BillPage({
  billId,
  initialTableId,
  initialScanCode,
}: {
  readonly billId: BillId
  readonly initialTableId?: TableId
  /** A code scanned on the home screen, which opened this bill to add it. */
  readonly initialScanCode?: string
}) {
  // The cart's catalog too: `BillCartView` mounts below once these are in.
  usePreloadEvoluQueries([
    ...billStateQueries(billId),
    settingsQuery,
    tablesQuery,
    catalogItemsQuery,
    catalogCategoriesQuery,
  ])
  useScreenWakeLock(true)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const [settings] = settingsData
  const fallbackCurrency = getFiatCurrency(settings)

  // Only meaningful before the bill row exists: it seeds the table the
  // lazily created row is assigned to. Once the row exists, `bill.tableId`
  // is the source of truth and this state is no longer read.
  const [pendingTableId, setPendingTableId] = useState<TableId | null>(
    initialTableId ?? null
  )

  const billQuery = billByIdQuery(billId)
  const { data: billRows } = useEvoluQuery(billQuery)
  const bill = billRows[0]

  // Owned here, not inside BillCartView, so search text, the summary's
  // open/closed state, and the undo/redo history survive the moment the
  // first added item lazily creates the bill row.
  const cart = useCartBill({
    billId,
    currency: fallbackCurrency,
    tableId: pendingTableId,
    billExists: bill !== undefined,
    onTableSeedChange: setPendingTableId,
  })
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<BillItemFilter>("all")
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [scanMode, setScanMode] = useBillInsertMode()

  const summaries = useBillLineSummaries(billId)
  const pendingPaymentIds = usePendingPayments(billId)
  const billStatus = useBillStatus(billId)
  const { guestsClosedBill } = useGuestMoneyArrivals({
    billId,
    billStatus,
    currency: bill?.currency ?? fallbackCurrency,
  })
  // A cancellation collision stays: confirming the bill despite it is `sell`.
  const closedOnOpen = useRedirectIfClosedOnOpen(
    billId,
    bill !== undefined &&
      billStatus?.status !== "open" &&
      billStatus?.hasCancellationCollision !== true,
    () => {
      void navigate({
        to: "/activity/bills/$billId",
        params: { billId },
        replace: true,
      })
    }
  )

  const title =
    bill === undefined
      ? undefined
      : (bill.label ?? t("bill.list.label", { number: bill.displayNumber }))
  const { tableName, opened } = useBillSubtitleParts(bill, pendingTableId)
  const subtitleParts = [tableName, opened].filter((part) => part !== undefined)
  const subtitle =
    subtitleParts.length === 0 ? undefined : subtitleParts.join(" · ")

  let content: ReactNode
  // Only the cart has a side panel for the title to move into.
  let titleInPanel = false
  if (closedOnOpen) {
    content = null
  } else if (bill !== undefined && guestsClosedBill) {
    content = <GuestsPaidBillMessage billId={bill.id} />
  } else if (bill !== undefined && billStatus?.status !== "open") {
    content = billStatus?.hasCancellationCollision ? (
      <BillCancellationCollisionMessage
        billId={bill.id}
        currency={bill.currency}
      />
    ) : (
      <BillMessage message={t("bill.closed")} />
    )
  } else if (pendingPaymentIds.length > 0) {
    content = <BillLockedMessage paymentIds={pendingPaymentIds} />
  } else {
    titleInPanel = true
    content = (
      <BillCartView
        title={title ?? t("bill.title")}
        openedAt={opened}
        billId={billId}
        billExists={bill !== undefined}
        currency={bill?.currency ?? fallbackCurrency}
        summaries={summaries}
        claimedSum={billStatus?.claimedSum ?? NonNegativeInteger(0)}
        amountDue={billStatus?.amountDue ?? deriveBillSummaryTotal(summaries)}
        // `pendingTableId` only seeds the bill row that's about to be
        // created; once it exists its own `tableId` is the source of truth,
        // so a table cleared on the bill isn't overwritten by the stale seed.
        tableId={bill === undefined ? pendingTableId : bill.tableId}
        cart={cart}
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        summaryOpen={summaryOpen}
        onSummaryOpenChange={setSummaryOpen}
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        initialScanCode={initialScanCode}
      />
    )
  }

  return (
    <BillPageLayout
      title={title}
      subtitle={subtitle}
      titleInPanel={titleInPanel}
    >
      {content}
    </BillPageLayout>
  )
}

/**
 * Where the bill is and since when, under its title: staff keep their
 * bearings without scrolling down to the table button. The side panel of a
 * large monitor shows only `opened`, its table button sitting right below.
 */
function useBillSubtitleParts(
  bill:
    | { readonly tableId: TableId | null; readonly createdAt: string }
    | undefined,
  pendingTableId: TableId | null
): {
  readonly tableName: string | undefined
  readonly opened: string | undefined
} {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: tables } = useEvoluQuery(tablesQuery)
  const tableId = bill === undefined ? pendingTableId : bill.tableId
  const tableName = tables.find((table) => table.id === tableId)?.name
  const openedAt = bill === undefined ? undefined : new Date(bill.createdAt)
  const opened =
    openedAt === undefined
      ? undefined
      : t("bill.openedAt", {
          time: isSameDay(openedAt, new Date())
            ? formatTime(openedAt, locale)
            : formatDateTime(openedAt, locale),
        })

  return { tableName, opened }
}

/**
 * Every bill state (new cart, resumed cart, not-found/closed message)
 * renders through this single frame, so the header — and its always-visible
 * link to saved carts — can never be left out of one state by accident.
 * `title` shows the bill's own label (falling back to its number) once one
 * exists; before that, and for the not-found/closed messages, it falls
 * back to the generic "Bill" title.
 */
function BillPageLayout({
  title,
  subtitle,
  titleInPanel,
  children,
}: {
  readonly title?: string
  readonly subtitle?: string
  /**
   * On a large monitor the cart's side panel heads itself with the title
   * and its search row carries the back button, so the bar goes away.
   */
  readonly titleInPanel: boolean
  readonly children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The fixed header is a line taller with a subtitle. */}
      <div
        className={cn(
          subtitle === undefined ? "h-6" : "h-11",
          titleInPanel && "lg:hidden"
        )}
      />
      <FadeHeader
        // Spans the monitor like the page below it (see `_terminal.bill.tsx`).
        className={titleInPanel ? "lg:hidden" : "lg:max-w-none lg:px-6"}
        title={
          <>
            <span className="block">{title ?? t("bill.title")}</span>
            {subtitle === undefined ? null : (
              <span className="block truncate text-sm font-normal text-muted-foreground">
                {subtitle}
              </span>
            )}
          </>
        }
      />
      {children}
    </div>
  )
}

function BillMessage({ message }: { readonly message: string }) {
  return (
    <p className="mt-16 px-6 text-center text-muted-foreground">{message}</p>
  )
}

function GuestsPaidBillMessage({ billId }: { readonly billId: BillId }) {
  const { t } = useTranslation()

  return (
    <div className="mt-16 flex flex-col items-center gap-4 px-6">
      <Alert variant="success">
        <CircleCheckIcon />
        <AlertTitle>{t("bill.guestMoney.closed")}</AlertTitle>
      </Alert>
      <Link
        to="/activity/bills/$billId"
        params={{ billId }}
        className={cn(buttonVariants({ variant: "outline" }), "h-12")}
      >
        {t("bill.guestMoney.openDetail")}
      </Link>
    </div>
  )
}

/**
 * The bill-level mirror of `payment-detail.tsx`'s canceled+claimed payment
 * collision: this bill was discarded, but its payments already cover its
 * total. Shown instead of the generic "closed" message whenever
 * `useBillStatus` reports the collision — see docs/bill-payment-states.md.
 *
 * Unlike a generic "closed" message, this is a screen staff must act on, so
 * it shows what's actually at stake (the bill's total) and links straight to
 * the payment(s) that funded it — the same "here's the specific payment,
 * go check it" pattern `BillLockedMessage` above already uses for a pending
 * one.
 */
function BillCancellationCollisionMessage({
  billId,
  currency,
}: {
  readonly billId: BillId
  readonly currency: FiatCurrencyType
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { pending, confirmClosed, refund } =
    useBillCancellationCollisionActions(billId)
  const summaries = useBillLineSummaries(billId)
  const claimedQuery = claimedPaymentsByBillIdQuery(billId)
  const { data: claimedPayments } = useEvoluQuery(claimedQuery)
  const paymentIds = useMemo(
    () => [...new Set(claimedPayments.map((payment) => payment.id))],
    [claimedPayments]
  )
  const totalAmount = deriveBillSummaryTotal(summaries)

  return (
    <div className="mt-16 flex flex-col items-center gap-4 px-6 text-center">
      <Alert variant="warning" className="text-left">
        <AlertTriangleIcon />
        <AlertTitle>{t("bill.collision.title")}</AlertTitle>
        <AlertDescription>{t("bill.collision.description")}</AlertDescription>
      </Alert>
      <strong className="text-2xl font-semibold tracking-tight">
        {formatMoney({ value: totalAmount, currency }, locale)}
      </strong>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {paymentIds.map((paymentId, index) => (
          <Button
            key={paymentId}
            variant="outline"
            nativeButton={false}
            render={<Link to="/activity/$paymentId" params={{ paymentId }} />}
          >
            {paymentIds.length > 1
              ? t("bill.collision.viewPayment.numbered", { number: index + 1 })
              : t("bill.collision.viewPayment")}
          </Button>
        ))}
        <Button
          className="h-12"
          disabled={pending}
          onClick={() => void confirmClosed()}
        >
          {t("bill.collision.markClosed")}
        </Button>
        <Button variant="outline" className="h-12" onClick={refund}>
          {t("bill.collision.refund")}
        </Button>
      </div>
    </div>
  )
}

function BillLockedMessage({
  paymentIds,
}: {
  readonly paymentIds: ReadonlyArray<PaymentId>
}) {
  const { t } = useTranslation()

  return (
    <div className="mt-16 flex flex-col items-center gap-4 px-6 text-center">
      <p className="text-muted-foreground">{t("bill.locked")}</p>
      <div className="flex flex-col gap-2">
        {paymentIds.map((paymentId, index) => (
          <Button
            key={paymentId}
            variant="outline"
            nativeButton={false}
            render={<Link to="/payment/$paymentId" params={{ paymentId }} />}
          >
            {paymentIds.length > 1
              ? t("bill.locked.viewPayment.numbered", { number: index + 1 })
              : t("bill.locked.viewPayment")}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * Taken from the hook rather than restated: as a hand-written copy it had
 * already drifted, declaring `Promise<void>` where the mutations resolve to
 * whether the change was actually applied.
 */
type CartApi = Readonly<ReturnType<typeof useCartBill>>

interface SharedCartViewProps {
  readonly cart: CartApi
  readonly search: string
  readonly onSearchChange: (value: string) => void
  readonly categoryFilter: BillItemFilter
  readonly onCategoryFilterChange: (value: BillItemFilter) => void
  readonly summaryOpen: boolean
  readonly onSummaryOpenChange: (open: boolean) => void
  readonly scanMode: boolean
  readonly onScanModeChange: (value: boolean) => void
}

function BillCartView({
  title,
  openedAt,
  billId,
  billExists,
  currency,
  summaries,
  claimedSum,
  amountDue,
  tableId,
  cart,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  summaryOpen,
  onSummaryOpenChange,
  scanMode,
  onScanModeChange,
  initialScanCode,
}: {
  /** The bill's heading, which the side panel shows on a large monitor. */
  readonly title: string
  /** When the bill was opened, under the side panel's title. */
  readonly openedAt: string | undefined
  readonly billId: BillId
  /** Whether `billId`'s row has been written to Evolu yet. */
  readonly billExists: boolean
  readonly currency: FiatCurrencyType
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
  readonly tableId: TableId | null
  readonly initialScanCode: string | undefined
} & SharedCartViewProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const router = useRouter()
  const appRun = useAppRun()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const jotaiStore = useStore()
  const confirm = useConfirmDialog()
  const console = useConsole()
  const createTerminalPayment = useCreateTerminalPayment()
  const coveringEdit = useCoveringEditQuestion(currency)
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const [settings] = settingsData
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { data: selfPayAllocations } = useEvoluQuery(
    selfPayAllocationsByBillIdQuery(billId)
  )
  const selfPayAllocated = sumSelfPayAllocationsByLineKey(selfPayAllocations)
  // The `*Pending` state drives `disabled`, which only takes effect on the
  // next render, so two fast taps on a low-end terminal both enter the
  // handler. `createPayment` deliberately accepts a bill that already has a
  // pending payment (see `payment-actions.ts`), so the second tap would
  // create a second payment and silently lock the cart. The ref is the half
  // that is true immediately; the state exists only to re-render `disabled`.
  // Same pairing as `terminal-payment-keypad.tsx` and `payment-tip-page.tsx`.
  const chargePendingRef = useRef(false)
  const [chargePending, setChargePending] = useState(false)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const splitPendingRef = useRef(false)
  const [splitPending, setSplitPending] = useState(false)
  // Tailwind's `lg`: the summary becomes a fixed side panel beside the
  // items, always open, like a till's receipt column.
  const isWide = useMediaQuery("(min-width: 64rem)")

  const currentTable = tables.find((table) => table.id === tableId)

  // `cart.assignTable` runs on the cart's mutation queue, so it can't race
  // the lazy bill creation, and reports its own failures.
  const handleAssignTable = (nextTableId: TableId | null) => {
    setTablePickerOpen(false)
    void cart.assignTable(nextTableId)
  }

  const catalogItemsById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems]
  )
  const currencyItems = useMemo(
    () => catalogItems.filter((item) => item.currency === currency),
    [catalogItems, currency]
  )
  const usedCategoryIds = useMemo(
    () => new Set(currencyItems.map((item) => item.categoryId)),
    [currencyItems]
  )
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )
  // The group an item is headed under; a deleted category's items join the
  // uncategorized, as `catalogItemsPageQuery` sorts them.
  const categoryGroupOf = (item: CatalogItemRow | undefined) =>
    item !== undefined &&
    item.categoryId !== null &&
    categoriesById.has(item.categoryId)
      ? item.categoryId
      : null

  // The grid's own SQL-filtered, paginated read: `currencyItems` above stays
  // the full per-currency list (needed by scan mode's barcode lookup, which
  // must match against every item, not just the currently loaded page).
  // `search` is genuinely debounced (typing shouldn't requery on every
  // keystroke) and additionally deferred via `transition: true` so it can't
  // drive the query outside a transition; `categoryFilter`/`currency` don't
  // need time-based debouncing, just that same "defer into a transition"
  // treatment, which `useDeferredValue` gives natively — no timer needed.
  // Both are required so a search keystroke or a category tap never
  // re-suspends this component: `BillPage`'s doc comment explains why a
  // remount here would drop a tap mid-press. `search`/`categoryFilter`
  // themselves stay plain, immediate state so the input text and the
  // selected chip highlight update without any lag.
  const searchForQuery = useDebouncedValue(search, 250, { transition: true })
  const categoryFilterForQuery = useDeferredValue(categoryFilter)
  const currencyForQuery = useDeferredValue(currency)
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
  const inBillItemIdsForQuery = useDeferredValue(inBillItemIds)
  const showOnlyInBill = categoryFilterForQuery === "inBill"
  // The whole catalog, unsearched: grouped under category headings.
  const groupByCategory =
    categoryFilterForQuery === "all" && searchForQuery.trim() === ""
  const createGridPageQuery = useCallback(
    (limit: number) =>
      catalogItemsPageQuery({
        search: searchForQuery,
        categoryFilter: showOnlyInBill ? "all" : categoryFilterForQuery,
        currency: currencyForQuery,
        ...(showOnlyInBill ? { catalogItemIds: inBillItemIdsForQuery } : {}),
        groupByCategory,
        limit,
      }),
    [
      groupByCategory,
      searchForQuery,
      categoryFilterForQuery,
      currencyForQuery,
      showOnlyInBill,
      inBillItemIdsForQuery,
    ]
  )
  const {
    rows: pagedItems,
    hasMore: hasMoreItems,
    isPending: isLoadingMoreItems,
    sentinelRef: itemsSentinelRef,
  } = useInfiniteEvoluQuery(
    [
      searchForQuery,
      categoryFilterForQuery,
      currencyForQuery,
      showOnlyInBill ? inBillItemIdsForQuery.join() : "",
    ],
    createGridPageQuery
  )

  // A lone group needs no heading to tell it from the others.
  const showCategoryHeadings =
    groupByCategory &&
    new Set(currencyItems.map((item) => categoryGroupOf(item))).size > 1

  const addScannedItem = async (catalogItem: CatalogItemRow) => {
    const added = await cart.addOne(catalogItem)
    // Scan mode shows the scanned item in its own panel; the grid may have
    // it scrolled out of view, so say what was added.
    if (added && !scanMode) {
      toast.success(
        t("bill.scan.added", { name: getStaffDisplayName(catalogItem) })
      )
    }
  }
  const billScan = useBillScanHandler({
    currencyItems,
    categories,
    currency,
    onAdd: (catalogItem) => void addScannedItem(catalogItem),
  })
  useHardwareScanner({
    enabled: !billScan.dialogsOpen && !splitDialogOpen && !tablePickerOpen,
    onScan: (code) => {
      // A focused search field received the code's characters too.
      if (search.endsWith(code)) {
        onSearchChange(search.slice(0, -code.length))
      }
      billScan.handleScan(code)
    },
  })

  // Handled once, then dropped from the URL so a reload or a back
  // navigation into this bill does not add the item a second time.
  const initialScanHandledRef = useRef(false)
  const handleInitialScan = useEffectEvent((code: string) => {
    billScan.handleScan(code)
    void navigate({
      to: "/bill",
      search: (previous) => ({ ...previous, scan: undefined }),
      replace: true,
    })
  })
  useEffect(() => {
    if (initialScanCode === undefined || initialScanHandledRef.current) return
    initialScanHandledRef.current = true
    handleInitialScan(initialScanCode)
  }, [initialScanCode])

  const { totalAmount, itemCount } = useMemo(
    () => deriveBillSummaryStats(summaries),
    [summaries]
  )
  const totalAmountPulseControls = useChangePulse(totalAmount)
  const amountDuePulseControls = useChangePulse(amountDue)

  const handleCharge = async () => {
    if (summaries.length === 0 || chargePendingRef.current) return

    chargePendingRef.current = true
    setChargePending(true)
    try {
      if (settings?.tipsEnabled === sqliteTrue) {
        await navigate({
          to: "/payment/tip",
          search: { amount: amountDue, currency, billId },
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

  // The action fires long after this render is gone, so it must not depend
  // on anything the render captured: `cart.undo` reads the top of the undo
  // stack from a ref at click time (see `use-cart-bill.ts`) rather than from
  // the snapshot that was current when the toast was raised.
  const showUndoToast = (message: string) =>
    toast(message, {
      action: {
        label: t("bill.summary.undo"),
        onClick: () => void cart.undo(),
      },
    })

  const handleClear = async () => {
    if (await cart.clear(summaries)) {
      showUndoToast(t("bill.summary.clear.toast"))
    }
  }

  const handleDiscard = async () => {
    if (!billExists) return

    const confirmed = await confirm({
      title: t("bill.discard.confirm.title"),
      description:
        claimedSum > 0
          ? t("bill.discard.confirm.paid.description", {
              amount: formatMoney({ value: claimedSum, currency }, locale),
            })
          : t("bill.discard.confirm.description"),
      confirmLabel: t("bill.discard.confirm.confirm"),
      cancelLabel: t("bill.discard.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    if (!(await require("discard", "access.action.discardBill"))) return

    await runToast(async (run) => {
      const result = await run(cancelBill(billId))
      if (!result.ok) {
        console.error("Failed to discard cart", result.error)
        return "app.saveFailed"
      }

      router.history.back()
    })
  }

  const handleSplitError = (error: SplitBillError) => {
    console.error("Failed to split bill", error)
    toast.error(t(splitBillErrorKeys[error.type]))
  }

  const handleConfirmSplit = async (input: SplitBillConfirmInput) => {
    if (splitPendingRef.current) return

    splitPendingRef.current = true
    setSplitPending(true)
    try {
      const outcome = await coveringEdit.ask(
        billId,
        input.items.map((item) => ({
          billId,
          deviceId: null,
          catalogItemId: item.catalogItemId,
          itemId: item.itemId,
          type: item.type,
          kind: "remove",
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        })),
        "split"
      )
      if (outcome === null) return
      await using run = appRun()

      if (input.destination === "new") {
        const { device } = await jotaiStore.get(accountAtom)
        const newBillId = createRandomBillId()
        const result = await run(
          splitBillIntoNewBill({
            sourceBillId: billId,
            targetBillId: newBillId,
            deviceId: device.id,
            tableId,
            currency,
            items: input.items,
          })
        )
        if (!result.ok) {
          handleSplitError(result.error)
          return
        }

        setSplitDialogOpen(false)
        // A brand-new bill always needs setup (table, charge), so jump there
        // regardless of whether this bill kept any items of its own.
        // `replace` so the back button returns to the floor view rather than
        // this bill (which may no longer even be open).
        await navigate({
          to: "/bill",
          search: { billId: newBillId },
          replace: true,
        })
        return
      }

      const result = await run(
        splitBill({
          sourceBillId: billId,
          targetBillId: input.targetBillId,
          items: input.items,
        })
      )
      if (!result.ok) {
        handleSplitError(result.error)
        return
      }

      setSplitDialogOpen(false)
      // Unlike splitting into a new bill, an existing target isn't something
      // that needs setup — only follow it there if this bill emptied out and
      // got auto-canceled, so there's nothing left here to keep working on.
      // `replace` so the back button returns to the floor view rather than
      // this now-canceled bill.
      if (result.value.sourceCanceled) {
        await navigate({
          to: "/bill",
          search: { billId: input.targetBillId },
          replace: true,
        })
      }
    } finally {
      splitPendingRef.current = false
      setSplitPending(false)
    }
  }

  return (
    <>
      {billScan.dialogs}
      <SplitBillDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        billId={billId}
        summaries={summaries}
        currency={currency}
        pending={splitPending}
        onConfirm={(input) => void handleConfirmSplit(input)}
      />

      {/*
       * One DOM tree for both layouts, switched by classes only, so a resize
       * never remounts the cart (see `BillPage`'s doc comment).
       */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-4">
        {/* `min-w-0`: the category bar scrolls instead of widening this. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0">
            <AssignTableDialog
              open={tablePickerOpen}
              onOpenChange={setTablePickerOpen}
              billId={billId}
              currentTableId={tableId}
              onAssign={handleAssignTable}
            />

            <div className="mt-2 flex gap-2">
              {/* The header bar's back button, which a large monitor hides. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden size-12 shrink-0 lg:inline-flex"
                aria-label={t("nav.back")}
                onClick={() => router.history.back()}
              >
                <ArrowLeftIcon
                  className="size-5 text-primary"
                  strokeWidth={3}
                />
              </Button>
              <SearchInput
                className="flex-1"
                value={search}
                onChange={onSearchChange}
                placeholder={t("bill.search")}
                clearAriaLabel={t("bill.search.clear.aria")}
              />
              <Button
                type="button"
                variant={scanMode ? "default" : "outline"}
                size="icon"
                className="size-12 shrink-0"
                aria-pressed={scanMode}
                aria-label={t("bill.scan.toggle.aria")}
                onClick={() => onScanModeChange(!scanMode)}
              >
                <ScanLineIcon />
              </Button>
            </div>
            {!scanMode && (
              <CategoryFilterBar
                className="mt-2"
                categories={categories}
                usedCategoryIds={usedCategoryIds}
                value={categoryFilter}
                onValueChange={onCategoryFilterChange}
                allLabel={t("bill.category.all")}
                uncategorizedLabel={t("bill.category.uncategorized")}
                extraOptions={[
                  { value: "inBill" as const, label: t("bill.filter.inBill") },
                ]}
              />
            )}
          </div>
          <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain mt-2">
            {scanMode ? (
              <BillScanView
                lastScanned={billScan.lastScanned}
                paused={billScan.dialogsOpen}
                onScan={billScan.handleScan}
                summaries={summaries}
                locale={locale}
                onAdd={(catalogItem) => void cart.addOne(catalogItem)}
                onAddQuantity={(catalogItem, quantity) =>
                  void cart.addQuantity(catalogItem, quantity)
                }
                onRemove={(summary) => void cart.removeOne(summary)}
              />
            ) : currencyItems.length === 0 ? (
              <BillEmptyCatalog />
            ) : pagedItems.length === 0 ? (
              <p className="mt-10 text-center text-muted-foreground">
                {t(
                  showOnlyInBill && search === ""
                    ? "bill.filter.inBill.empty"
                    : "bill.emptySearch"
                )}
              </p>
            ) : (
              <>
                <div className={itemBrickGridClassName}>
                  {pagedItems.map((catalogItem, index) => {
                    const group = categoryGroupOf(catalogItem)
                    const startsGroup =
                      showCategoryHeadings &&
                      (index === 0 ||
                        categoryGroupOf(pagedItems[index - 1]) !== group)

                    return (
                      <Fragment key={catalogItem.id}>
                        {startsGroup && (
                          <h3 className="col-span-full px-1 pt-4 text-sm font-semibold text-muted-foreground first:pt-0">
                            {group === null
                              ? t("bill.category.uncategorized")
                              : categoriesById.get(group)?.name}
                          </h3>
                        )}
                        <ItemBrick
                          catalogItem={catalogItem}
                          summaries={summaries}
                          selfPayAllocated={selfPayAllocated}
                          locale={locale}
                          onAdd={() => void cart.addOne(catalogItem)}
                          onAddQuantity={(quantity) =>
                            void cart.addQuantity(catalogItem, quantity)
                          }
                          onRemove={(summary) => void cart.removeOne(summary)}
                        />
                      </Fragment>
                    )
                  })}
                </div>
                {hasMoreItems && (
                  <>
                    {isLoadingMoreItems && <ItemBrickGridSkeleton />}
                    <div ref={itemsSentinelRef} aria-hidden className="h-1" />
                  </>
                )}
              </>
            )}
          </section>
        </div>

        {summaryOpen && !isWide && (
          // Dims the items while the summary is open; a tap on them closes it.
          <div
            aria-hidden
            data-testid="bill-summary-backdrop"
            className="fixed inset-0 z-10 bg-black/40"
            onClick={() => onSummaryOpenChange(false)}
          />
        )}
        {/*
         * In the page's flex column rather than fixed over it, so the items
         * scroll above it however tall the open summary makes it: fixed, it
         * covered the last row of items. The negative margins reach the
         * viewport's padded edges.
         */}
        <Card className="relative z-20 -mx-3 -mb-6 shrink-0 rounded-none rounded-t-xl p-0 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.35)] lg:m-0 lg:w-100 lg:rounded-xl lg:shadow-xl lg:ring-foreground/15 2xl:w-120">
          <CardContent className="pb-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <div className="hidden items-start justify-between gap-2 pt-4 lg:flex">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{title}</p>
                {openedAt === undefined ? null : (
                  <p className="truncate text-sm text-muted-foreground">
                    {openedAt}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("bill.summary.undo")}
                  title={t("bill.summary.undo")}
                  disabled={!cart.canUndo || cart.pending}
                  onClick={() => void cart.undo()}
                >
                  <Undo2 />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("bill.summary.redo")}
                  title={t("bill.summary.redo")}
                  disabled={!cart.canRedo || cart.pending}
                  onClick={() => void cart.redo()}
                >
                  <Redo2 />
                </Button>
              </div>
            </div>
            <Collapsible
              open={isWide || summaryOpen}
              onOpenChange={onSummaryOpenChange}
              className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
            >
              <CollapsibleTrigger
                data-testid="bill-summary-trigger"
                className="w-full pt-4 text-left lg:hidden"
                disabled={isWide || (summaries.length === 0 && !cart.canUndo)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-base text-muted-foreground">
                    <ShoppingBag className="size-4" />
                    {t("bill.itemsCount", { value: itemCount })}
                  </div>
                  <div className="flex items-center gap-2 text-base font-semibold">
                    {claimedSum > 0 && (
                      <span className="font-normal">
                        {t("bill.summary.leftToPay")}
                      </span>
                    )}
                    <motion.span animate={amountDuePulseControls}>
                      {formatMoney({ value: amountDue, currency }, locale)}
                    </motion.span>
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        !summaryOpen && "rotate-180"
                      )}
                    />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent
                data-testid="bill-summary-panel"
                className="overflow-hidden h-(--collapsible-panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 lg:flex lg:h-auto lg:min-h-0 lg:flex-1 lg:flex-col lg:transition-none"
              >
                {/*
                 * `grid-template-rows: 0fr -> 1fr` (rather than animating a
                 * measured pixel height) keeps tracking the content's actual
                 * size every frame, so it can't visibly jump if that size
                 * settles a moment after the row is measured.
                 */}
                <div className="flex min-h-0 flex-col gap-4 pt-4 lg:flex-1">
                  <div className="max-h-48 overflow-x-hidden overflow-y-auto lg:max-h-none lg:flex-1">
                    {summaries.length === 0 && (
                      <p className="hidden pt-16 text-center text-sm text-muted-foreground lg:block">
                        {t("bill.summary.empty")}
                      </p>
                    )}
                    <div className="flex flex-col divide-y">
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
                          onAddOne={(catalogItem) =>
                            void cart.addOne(catalogItem)
                          }
                          onRemoveOne={() => void cart.removeOne(summary)}
                          onRemove={async (removedSummary) => {
                            const removed =
                              await cart.removeLine(removedSummary)
                            // A failed removal already raised its own error
                            // toast and recorded nothing, so offering to undo
                            // here would invert the change before it.
                            if (!removed) return

                            showUndoToast(
                              t("bill.summary.removeLine.toast", {
                                name: removedSummary.name,
                              })
                            )
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <BillAlreadyPaid
                    className="lg:hidden"
                    claimedSum={claimedSum}
                    amountDue={amountDue}
                    currency={currency}
                    locale={locale}
                  />
                  <div className="flex items-center justify-between py-2 lg:hidden">
                    <div className={"gap-1 flex"}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 px-3"
                        disabled={!cart.canUndo || cart.pending}
                        onClick={() => void cart.undo()}
                      >
                        <Undo2 data-icon="inline-start" />
                        {t("bill.summary.undo")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 px-3"
                        disabled={!cart.canRedo || cart.pending}
                        onClick={() => void cart.redo()}
                      >
                        <Redo2 data-icon="inline-start" />
                        {t("bill.summary.redo")}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 px-3"
                      disabled={summaries.length === 0 || cart.pending}
                      onClick={() => void handleClear()}
                    >
                      {t("bill.summary.clear")}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Dashed, as a printed receipt rules off its total. */}
            <div className="mt-4 hidden items-baseline justify-between border-t border-dashed pt-4 lg:flex">
              <span className="text-muted-foreground">
                {t("bill.summary.total")}
                <span className="text-sm">
                  {" · "}
                  {t("bill.itemsCount", { value: itemCount })}
                </span>
              </span>
              <motion.span
                className="text-3xl font-semibold tabular-nums"
                animate={totalAmountPulseControls}
              >
                {formatMoney({ value: totalAmount, currency }, locale)}
              </motion.span>
            </div>
            <BillAlreadyPaid
              className="hidden pt-2 lg:flex"
              claimedSum={claimedSum}
              amountDue={amountDue}
              currency={currency}
              locale={locale}
            />
            <div className="flex items-center gap-2 pt-4 lg:flex-wrap">
              <Button
                variant="outline"
                size="icon"
                // Kept apart from the everyday buttons beside it.
                className="mr-3 h-12 w-12 shrink-0 text-destructive"
                disabled={!billExists}
                aria-label={t("bill.discard")}
                onClick={() => void handleDiscard()}
              >
                <Trash2Icon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                // A large monitor has the room to name it.
                className="h-12 w-12 shrink-0 lg:w-auto lg:flex-1 lg:gap-1.5 lg:px-3"
                disabled={summaries.length === 0 || splitPending}
                aria-label={t("bill.split.button.aria")}
                onClick={() => setSplitDialogOpen(true)}
              >
                <Split />
                {isWide && t("bill.split.button.aria")}
              </Button>
              {/* A phone has it inside the expanded summary instead. */}
              <Button
                variant="outline"
                className="hidden h-12 flex-1 lg:inline-flex"
                disabled={summaries.length === 0 || cart.pending}
                onClick={() => void handleClear()}
              >
                <Eraser data-icon="inline-start" />
                {t("bill.summary.clear")}
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1 text-sm lg:basis-full"
                aria-label={t("bill.table.aria")}
                onClick={() => setTablePickerOpen(true)}
              >
                <Table2 data-icon="inline-start" />
                {currentTable?.name ?? t("bill.table.assign")}
              </Button>
              <Button
                variant="default"
                className="h-12 flex-1 text-sm font-bold lg:h-14 lg:basis-full lg:text-base"
                disabled={summaries.length === 0 || chargePending}
                onClick={() => {
                  vibrateOnButtonPress()
                  void handleCharge()
                }}
              >
                <span>
                  {t("home.pay")}
                  <span className="hidden lg:inline">
                    {" "}
                    {formatMoney({ value: amountDue, currency }, locale)}
                  </span>
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function BillEmptyCatalog() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-semibold">{t("catalog.items.empty.title")}</p>
      <p className="max-w-72 text-balance text-sm text-muted-foreground">
        {t("catalog.items.empty.description")}
      </p>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link to="/catalog/items/new" />}
      >
        {t("catalog.items.add")}
      </Button>
    </div>
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
  readonly onRemove: (summary: BillLineSummary) => void
}) {
  const { t } = useTranslation()
  const pulseControls = useChangePulse(summary.quantity)

  return (
    <div className="group flex items-center justify-between gap-2 py-1 lg:py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{summary.name}</p>
        {/* A single piece costs what the line total already says. */}
        {summary.quantity === 1 ? null : (
          <p className="text-xs text-muted-foreground tabular-nums">
            {summary.quantity} ×{" "}
            {formatMoney(
              {
                value: getBillLineSummaryUnitAmount(summary),
                currency: summary.currency,
              },
              locale
            )}
          </p>
        )}
        <SelfPayLineStatus
          line={selfPayLine}
          currency={summary.currency}
          locale={locale}
        />
      </div>
      {/*
       * The item grid's "−"/"+" cluster in small. No `disabled`, like
       * `ItemQuantityControls`: the cart queues taps, and a button disabled
       * mid-tap drops it.
       */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full lg:size-9"
          aria-label={t("bill.summary.decrement.aria", { name: summary.name })}
          onClick={onRemoveOne}
        >
          <Minus />
        </Button>
        <motion.span
          className="min-w-6 text-center text-sm font-semibold tabular-nums"
          animate={pulseControls}
        >
          {summary.quantity}
        </motion.span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full lg:size-9"
          aria-label={t("bill.summary.increment.aria", { name: summary.name })}
          disabled={catalogItem === undefined}
          onClick={() => {
            if (catalogItem !== undefined) onAddOne(catalogItem)
          }}
        >
          <Plus />
        </Button>
      </div>
      {/* A fixed column, so the "−"/"+" clusters line up row to row. */}
      <motion.p
        className="min-w-20 text-right text-sm font-semibold tabular-nums"
        animate={pulseControls}
      >
        {formatMoney(
          { value: summary.totalAmount, currency: summary.currency },
          locale
        )}
      </motion.p>
      {/*
       * A mouse finds it on hover, which keeps a long bill calm to read; a
       * finger has no hover, so touch screens always show it. Hidden by
       * negated variants rather than shown back by `group-hover:`: their
       * `:not()`s outweigh the vendored `disabled:opacity-50`, which made it
       * flash in while every add or remove briefly disabled it.
       */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="pointer-fine:not-group-hover:not-focus-visible:opacity-0 lg:size-9"
        aria-label={t("bill.summary.removeLine.aria", { name: summary.name })}
        disabled={disabled}
        onClick={() => onRemove(summary)}
      >
        <X />
      </Button>
    </div>
  )
}

function BillAlreadyPaid({
  className,
  claimedSum,
  amountDue,
  currency,
  locale,
}: {
  readonly className: string
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
  readonly currency: FiatCurrencyType
  readonly locale: string
}) {
  const { t } = useTranslation()
  if (claimedSum === 0) return null

  return (
    <dl className={cn("flex flex-col gap-1 tabular-nums", className)}>
      <div className="flex items-baseline justify-between text-muted-foreground">
        <dt>{t("bill.summary.alreadyPaid")}</dt>
        <dd>{formatMoney({ value: claimedSum, currency }, locale)}</dd>
      </div>
      <div className="flex items-baseline justify-between font-semibold">
        <dt>{t("bill.summary.leftToPay")}</dt>
        <dd>{formatMoney({ value: amountDue, currency }, locale)}</dd>
      </div>
    </dl>
  )
}

function SelfPayLineStatus({
  line,
  currency,
  locale,
}: {
  readonly line: SelfPayViewLine
  readonly currency: FiatCurrencyType
  readonly locale: string
}) {
  const { t } = useTranslation()
  if (line.allocatedAmount === 0) return null
  const remaining = remainingOnLine(line)

  return (
    <p
      data-testid="bill-summary-self-pay"
      className="text-xs text-primary tabular-nums"
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
    </p>
  )
}

function ItemBrick({
  catalogItem,
  summaries,
  selfPayAllocated,
  locale,
  onAdd,
  onAddQuantity,
  onRemove,
}: {
  readonly catalogItem: CatalogItemRow
  readonly summaries: ReadonlyArray<BillLineSummary>
  readonly selfPayAllocated: ReadonlyMap<string, number>
  readonly locale: string
  readonly onAdd: () => void
  readonly onAddQuantity: (quantity: PositiveNumber) => void
  readonly onRemove: (summary: BillLineSummary) => void
}) {
  const { t } = useTranslation()
  const matchingSummaries = useMemo(
    () =>
      summaries.filter((summary) => summary.catalogItemId === catalogItem.id),
    [summaries, catalogItem.id]
  )
  const quantity = useMemo(
    () => matchingSummaries.reduce((sum, summary) => sum + summary.quantity, 0),
    [matchingSummaries]
  )
  const latestSummary = useMemo(
    () => getLatestCatalogItemSummary(matchingSummaries, catalogItem.id),
    [catalogItem.id, matchingSummaries]
  )
  const guestPaid = NonNegativeInteger(
    matchingSummaries.reduce(
      (sum, summary) =>
        sum + projectSelfPayViewLine(summary, selfPayAllocated).allocatedAmount,
      0
    )
  )

  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false)
  const quantityPulseControls = useChangePulse(quantity)

  const inCart = quantity > 0
  const name = getStaffDisplayName(catalogItem)

  return (
    <Card
      className={cn(
        // Inset, so the scrolling grid does not clip the outer columns.
        "relative gap-1 p-3 ring-inset",
        inCart && "bg-primary/15"
      )}
    >
      {/*
       * A tap anywhere on the tile adds one, as on a till; the two corner
       * controls above it stay clear of the middle, where a tap lands.
       */}
      <button
        type="button"
        aria-label={t("bill.brick.add.aria", { name })}
        className="absolute inset-0 cursor-pointer rounded-xl transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-foreground/10"
        onClick={() => {
          vibrateOnButtonPress()
          onAdd()
        }}
      />
      {/*
       * The corner controls are kept in the layout but invisible until the
       * item is on the bill, so a tile does not reflow under the finger
       * when its first piece is added. Like `ItemQuantityControls` they have
       * no `disabled`: the cart queues taps, and a button disabled mid-tap
       * drops it.
       */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pt-0.5">
          <p className="font-medium lg:text-base">{name}</p>
          {guestPaid > 0 && (
            <p className="text-xs font-medium tabular-nums">
              {t("bill.brick.guestPaid", {
                amount: formatMoney(
                  { value: guestPaid, currency: catalogItem.currency },
                  locale
                ),
              })}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className={cn(
            "relative z-10 h-7 min-w-7 shrink-0 rounded-full px-2 font-bold tabular-nums",
            !inCart && "invisible"
          )}
          aria-label={t("bill.brick.quantity.trigger.aria", { name })}
          onClick={() => setQuantityDialogOpen(true)}
        >
          <motion.span animate={quantityPulseControls}>{quantity}</motion.span>
        </Button>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="pb-1 font-semibold text-foreground/70 tabular-nums">
          {formatMoney(
            { value: catalogItem.unitAmount, currency: catalogItem.currency },
            locale
          )}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(
            "relative z-10 size-10 shrink-0 rounded-full",
            !inCart && "invisible"
          )}
          aria-label={t("bill.brick.remove.aria", { name })}
          onClick={() => {
            if (latestSummary === undefined) return
            vibrateOnButtonPress()
            onRemove(latestSummary)
          }}
        >
          <Minus />
        </Button>
      </div>
      <ItemQuantityDialog
        name={name}
        open={quantityDialogOpen}
        onOpenChange={setQuantityDialogOpen}
        onAddQuantity={onAddQuantity}
      />
    </Card>
  )
}
