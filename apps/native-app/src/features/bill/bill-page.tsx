import { sqliteTrue } from "@evolu/common"
import {
  billCheckoutHintKeys,
  deriveBillCheckout,
} from "@payky/app-shared/bill-checkout"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import { useRedirectIfClosedOnOpen } from "@payky/app-shared/use-redirect-if-closed-on-open"
import { enabledPaymentMethodAccountsQuery } from "@payky/core/modules/account/account-queries"
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
import { catalogItemsQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import type {
  CatalogItemId,
  CategoryFilter,
} from "@payky/core/modules/catalog-item/catalog-item-types"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
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
import { type Atom, useAtomValue } from "jotai"
import ArrowLeft from "lucide-react-native/icons/arrow-left"
import CircleCheck from "lucide-react-native/icons/circle-check"
import Eraser from "lucide-react-native/icons/eraser"
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ActivityIndicator,
  Animated,
  FlatList,
  View as NativeView,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { isWeb, styled, Text, useTheme, View, XStack, YStack } from "tamagui"
import { FadeHeader, goBack } from "../../components/fade-header.tsx"
import {
  LibraryPictureFill,
  libraryPictureUrlReader,
} from "../../components/library-picture.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import type { SafeAreaEdge } from "../../components/safe-area-padding.ts"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { SearchInput } from "../../components/search-input.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button, type ButtonProps } from "../../components/ui/button.tsx"
import { Card, CardContent } from "../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import {
  PressFill,
  type PressFillColors,
  pressFillClause,
  usePressFill,
} from "../../components/ui/press-fill.tsx"
import {
  useBillSummaryPanelWidth,
  useWideWindow,
} from "../../components/web-column.tsx"
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
import { usePreloadPaymentWait } from "../../hooks/use-preload-payment-wait.ts"
import { useProductLibrary } from "../../hooks/use-product-library.ts"
import { useProductLookup } from "../../hooks/use-product-lookup.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useScreenVisit } from "../../hooks/use-screen-visit.ts"
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { hapticButtonPress } from "../../platform/haptics.ts"
import { isSwitchioSupported } from "../../platform/switchio.ts"
import { fontSize, fontWeight, radius, shape } from "../../theme/tokens.ts"
import { BillCancellationCollisionActions } from "../shared/bill-cancellation-collision-actions.tsx"
import { CategoryFilterBar } from "../shared/category-filter-bar.tsx"
import {
  useBillLineSummaries,
  useBillStatus,
  usePendingPayments,
} from "../shared/use-bill-state.ts"
import { billGridQuery, billPageQueries } from "../shared/use-preload-bill.ts"
import { AssignTableDialog } from "./assign-table-dialog.tsx"
import { BillScanView } from "./bill-scan-view.tsx"
import { CreateCatalogItemDialog } from "./create-catalog-item-dialog.tsx"
import { buildItemGridRows, itemGridColumns } from "./item-grid-rows.ts"
import { ItemQuantityDialog } from "./item-quantity-controls.tsx"
import { ScanCodeCollisionDialog } from "./scan-code-collision-dialog.tsx"
import { SplitBillDialog } from "./split-bill-dialog.tsx"
import { useCartBill } from "./use-cart-bill.ts"
import { useFinishBill } from "./use-finish-bill.ts"
import { useGuestMoneyArrivals } from "./use-guest-money-arrivals.ts"
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
  usePreloadEvoluQueries(useMemo(() => billPageQueries(billId), [billId]))
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
  const currency = bill?.currency ?? getFiatCurrency(settings)
  const { guestsClosedBill } = useGuestMoneyArrivals({
    billId,
    billStatus,
    currency,
  })

  // As web: a bill that is already closed when opened (Back, a stale link)
  // goes to its detail, which `sell` alone cannot read, so the PIN gate asks.
  // Decided once per arrival — this bill, this visit of the screen — so a
  // bill paid while the cart is open still shows its message, while a link or
  // Back onto the screen still mounted decides again. A cancellation
  // collision (canceled but funded) stays here: it is resolved from
  // activity/refund, which arrive later.
  // Owned here rather than by the cart, which the closed bill unmounts.
  const finishBill = useFinishBill(billId)
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
  // Finished here: home is on its way, so no "bill closed" message first.
  if (closedOnOpen || (finishBill.closing && billStatus?.status === "closed"))
    return (
      <YStack flex={1} items="center" justify="center">
        <ActivityIndicator size="large" />
      </YStack>
    )
  if (bill !== undefined && guestsClosedBill) {
    return <GuestsPaidBillMessage billId={billId} />
  }
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
      currency={currency}
      tipsEnabled={settings?.tipsEnabled === sqliteTrue}
      summaries={summaries}
      claimedSum={billStatus?.claimedSum ?? NonNegativeInteger(0)}
      amountDue={
        billStatus?.amountDue ??
        NonNegativeInteger(Math.max(0, deriveBillSummaryTotal(summaries)))
      }
      initialScanCode={initialScanCode}
      onFinish={finishBill.finish}
      finishPending={finishBill.pending}
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

function GuestsPaidBillMessage({ billId }: { readonly billId: BillId }) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack mt={64} px={24} gap={16} items="center">
        <Alert variant="success" icon={CircleCheck}>
          <AlertTitle>{t("bill.guestMoney.closed")}</AlertTitle>
        </Alert>
        <Button
          size="lg"
          variant="outline"
          label={t("bill.guestMoney.openDetail")}
          onPress={() =>
            router.push({
              pathname: "/activity/bills/[billId]",
              params: { billId },
            })
          }
        />
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
  const preloadPaymentWait = usePreloadPaymentWait()
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
              onPress={() => {
                preloadPaymentWait(paymentId)
                router.push({
                  pathname: "/payment/[paymentId]",
                  params: { paymentId },
                })
              }}
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
  onFinish,
  finishPending,
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
  /** `BillPage`'s `useFinishBill`, for Finish in Charge's place. */
  readonly onFinish: () => Promise<void>
  readonly finishPending: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // Web's `lg`: the summary moves into a side panel beside the items, on the
  // web and on a wide Android tablet alike.
  const wide = useWideWindow()
  const summaryPanelWidth = useBillSummaryPanelWidth()
  // As many columns as web's `auto-fill` grid fits, once measured.
  const [wideGridColumns, setWideGridColumns] = useState(2)
  const gridColumns = wide ? wideGridColumns : 2
  const { totalAmount, itemCount } = useMemo(
    () => deriveBillSummaryStats(summaries),
    [summaries]
  )
  const totalAmountPulse = useChangePulse(totalAmount)
  const amountDuePulse = useChangePulse(amountDue)
  const cart = useCartBill({ billId, currency, tableId, onTableSeedChange })
  // The grid's handlers are made once and call the latest cart, so a tap,
  // which renders this cart again, leaves every brick's props as they were
  // and React skips the bricks whose own quantity did not change.
  const cartRef = useRef(cart)
  useLayoutEffect(() => {
    cartRef.current = cart
  })
  const [brickActions] = useState(
    (): BrickActions => ({
      add: (item) => void cartRef.current.addOne(item),
      remove: (summary) => void cartRef.current.removeOne(summary),
    })
  )
  // One quantity dialog for the whole grid, for the brick that opened it.
  const [quantityTarget, setQuantityTarget] = useState<CatalogItemRow | null>(
    null
  )
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

  // Charge, or Finish in its place for a bill whose goods come to zero.
  const paymentAccounts = useEvoluQuery(enabledPaymentMethodAccountsQuery).data
  const [qerkoPaymentPlugin] = useEvoluQuery(qerkoPluginQuery("standard")).data
  const checkout = deriveBillCheckout({
    summaries,
    currency,
    paymentAccounts,
    cardTerminalLinked: isSwitchioSupported(),
    qerkoRestaurantPaired: (qerkoPaymentPlugin?.restaurantId ?? null) !== null,
  })
  const checkoutHintKey = billCheckoutHintKeys[checkout]
  const finishing = checkout === "finish"
  const mainActionKey = finishing ? "bill.finish" : "home.pay"

  // The payment's amounts and bill-line snapshot are core's
  // (`createPreparedPayment` with `billId`); this only picks the route.
  const charge = async () => {
    if (checkout !== "charge" || chargePendingRef.current) return
    chargePendingRef.current = true
    setChargePending(true)
    // Not a `try`/`finally`: React Compiler skips a component holding one,
    // and this cart is the screen it saves most renders on.
    const release = () => {
      chargePendingRef.current = false
      setChargePending(false)
    }
    if (tipsEnabled) {
      router.push({
        pathname: "/payment/tip",
        params: { amount: String(amountDue), currency, billId },
      })
      release()
      return
    }
    try {
      await createTerminalPayment({
        amount: amountDue,
        currency,
        tipAmount: NonNegativeInteger(0),
        billId,
      })
    } catch (error) {
      release()
      throw error
    }
    release()
  }
  const catalogItems = useEvoluQuery(catalogItemsQuery).data
  const selfPayAllocations = useEvoluQuery(
    selfPayAllocationsByBillIdQuery(billId)
  ).data
  const selfPayAllocated = useMemo(
    () => sumSelfPayAllocationsByLineKey(selfPayAllocations),
    [selfPayAllocations]
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
  // Each item's quantity and latest line, read by the bricks: one pass over
  // the bill, rather than each brick scanning it.
  const brickStates = useMemo(() => {
    const quantities = new Map<CatalogItemId, number>()
    const guestPaid = new Map<CatalogItemId, number>()
    for (const summary of summaries) {
      if (summary.catalogItemId === null) continue
      quantities.set(
        summary.catalogItemId,
        (quantities.get(summary.catalogItemId) ?? 0) + summary.quantity
      )
      guestPaid.set(
        summary.catalogItemId,
        (guestPaid.get(summary.catalogItemId) ?? 0) +
          projectSelfPayViewLine(summary, selfPayAllocated).allocatedAmount
      )
    }
    return new Map(
      [...quantities].map(([id, quantity]) => [
        id,
        {
          quantity,
          latestSummary: getLatestCatalogItemSummary(summaries, id),
          guestPaid: NonNegativeInteger(guestPaid.get(id) ?? 0),
        },
      ])
    )
  }, [summaries, selfPayAllocated])
  const brickStateOf = (id: CatalogItemId) =>
    brickStates.get(id) ?? emptyBrickState
  // Kept while its items stay the same, so a tap that only changes a
  // quantity neither rebuilds the grid's query nor defers a render for it.
  const nextInBillItemIds = useMemo(
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
  const [inBillItemIds, setInBillItemIds] = useState(nextInBillItemIds)
  if (!sameIds(inBillItemIds, nextInBillItemIds))
    setInBillItemIds(nextInBillItemIds)
  // Deferred, so switching a chip never suspends this screen: a suspend here
  // would bubble to the route's boundary and remount the cart mid-tap.
  // The search additionally waits for typing to pause, as web's 250 ms.
  const deferredSearch = useDeferredValue(useDebouncedValue(search, 250))
  const deferredFilter = useDeferredValue(categoryFilter)
  // Deferred only while it filters the grid: otherwise a new item on the
  // bill would render the whole cart once more for nothing.
  const deferredInBillIds = useDeferredValue(
    categoryFilter === "inBill" ? inBillItemIds : noItemIds
  )
  // The unsearched, unfiltered grid is the one home preloads (`usePreloadBill`).
  const gridQuery = useMemo(
    () =>
      billGridQuery({
        search: deferredSearch,
        categoryFilter: deferredFilter === "inBill" ? "all" : deferredFilter,
        currency,
        ...(deferredFilter === "inBill"
          ? { catalogItemIds: deferredInBillIds }
          : {}),
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
    showCategoryHeadings,
    gridColumns
  )
  // The library is read once for the whole grid, each brick handed its
  // picture's URL, rather than a query observer per brick.
  const brickPictureUrl = libraryPictureUrlReader(useProductLibrary())
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
  // A tap while a cart write is in flight is ignored rather than the button
  // disabled: disabling it on every add or remove made it flash. Clear
  // writes this render's lines, which that write is about to change.
  const handleClear = async () => {
    if (cart.isPending()) return
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

  const totalLabel = formatMoney({ value: totalAmount, currency }, locale)
  const amountDueLabel = formatMoney({ value: amountDue, currency }, locale)
  // A large monitor's Charge names the amount it charges, as web's; the
  // button is named by what it shows.
  const mainActionLabel =
    wide && !finishing ? `${t("home.pay")} ${amountDueLabel}` : t(mainActionKey)

  return (
    <SafeAreaView
      // A wide window pads the page as web's `lg:px-6 py-6` viewport; a
      // phone's summary sits on the bottom edge and pads it itself.
      edges={wide ? wideScreenEdges : phoneScreenEdges}
      style={{
        flex: 1,
        paddingHorizontal: wide ? 24 : 12,
        paddingVertical: wide ? 24 : 0,
        backgroundColor: theme.background.val,
      }}
    >
      {/*
       * One tree for both layouts, switched by props only, so a resize (a
       * tablet turned, a browser window dragged) never remounts the item
       * list or the search field, as web's `BillCartView`.
       */}
      <View
        flex={1}
        flexDirection={wide ? "row" : "column"}
        gap={wide ? 16 : 0}
      >
        {/* `minW={0}`: the category bar scrolls instead of widening this. */}
        <YStack
          flex={1}
          minW={0}
          // The grid's own width, not the window's: the menu's rail takes
          // part of a wide window.
          onLayout={(event) =>
            setWideGridColumns(itemGridColumns(event.nativeEvent.layout.width))
          }
        >
          {/* A large monitor heads the summary panel with the title instead. */}
          {wide ? null : (
            <FadeHeader
              title={title}
              subtitle={
                [tableName, opened]
                  .filter((part) => part !== undefined)
                  .join(" · ") || undefined
              }
            />
          )}

          <XStack mt={8} gap={8} items="center">
            {/* The header's back button, which a large monitor leaves out. */}
            {wide ? (
              <Button
                variant="ghost"
                size="icon"
                w={48}
                h={48}
                shrink={0}
                iconStart={ArrowLeft}
                aria-label={t("nav.back")}
                onPress={goBack}
              />
            ) : null}
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
                    // One of the grid's square tiles, in its first column,
                    // not a square the scanner's width.
                    <XStack gap={8}>
                      <View flex={1}>
                        <ItemBrick
                          catalogItem={lastScanned}
                          pictureUrl={brickPictureUrl(
                            lastScanned.libraryProductId,
                            TILE_PICTURE_SIZE
                          )}
                          {...brickStateOf(lastScanned.id)}
                          locale={locale}
                          actions={brickActions}
                          onOpenQuantity={setQuantityTarget}
                        />
                      </View>
                      {gridColumnIndexes(gridColumns)
                        .slice(1)
                        .map((column) => (
                          <View key={column} flex={1} />
                        ))}
                    </XStack>
                  )
                }
              />
            ) : (
              <FlatList
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                data={gridRows}
                keyExtractor={(row) => row.key}
                // A screen of rows past each edge, not RN's ten: a tap
                // renders the mounted bricks, and a long catalog mounted
                // nearly all of them.
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                windowSize={5}
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
                            pictureUrl={brickPictureUrl(
                              item.libraryProductId,
                              TILE_PICTURE_SIZE
                            )}
                            {...brickStateOf(item.id)}
                            locale={locale}
                            actions={brickActions}
                            onOpenQuantity={setQuantityTarget}
                          />
                        </View>
                      ))}
                      {/* A short last row keeps its bricks in their columns. */}
                      {gridColumnIndexes(gridColumns)
                        .slice(row.items.length)
                        .map((column) => (
                          <View key={column} flex={1} />
                        ))}
                    </XStack>
                  )
                }
              />
            )}
          </YStack>
        </YStack>

        {summaryExpanded && !wide ? (
          // Web's backdrop: dims the screen while the summary is open, and a
          // tap on it closes the summary instead of adding an item. Wider
          // than the screen padding, as the panel is, and up over the status
          // bar, as when it covered the whole screen view.
          <Pressable
            accessible={false}
            testID="bill-summary-backdrop"
            onPress={() => setSummaryOpen(false)}
            style={{
              position: "absolute",
              top: -insets.top,
              right: -12,
              bottom: 0,
              left: -12,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          />
        ) : null}
        {/*
         * The bill's summary: on a phone the bottom panel, collapsed to its
         * total; on a large monitor a side panel beside the items, always
         * open, headed by the bill's title, as web's `lg:` card.
         */}
        <Card
          mx={wide ? 0 : -12}
          w={wide ? summaryPanelWidth : undefined}
          shrink={wide ? 0 : undefined}
          py={0}
          gap={0}
          borderBottomWidth={0}
          borderBottomLeftRadius={wide ? undefined : 0}
          borderBottomRightRadius={wide ? undefined : 0}
        >
          <SafeAreaView
            edges={wide ? noEdges : bottomEdge}
            style={wide ? fillStyle : undefined}
          >
            <CardContent
              pb={16}
              flex={wide ? 1 : undefined}
              minH={wide ? 0 : undefined}
            >
              {wide ? (
                <XStack
                  pt={16}
                  items="flex-start"
                  justify="space-between"
                  gap={8}
                >
                  <YStack flex={1} minW={0}>
                    <Text
                      role="heading"
                      aria-level={2}
                      fontSize={fontSize.lg}
                      lineHeight={fontSize.lg}
                      fontWeight={fontWeight.semibold}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    {/* Only when it opened, as web's: the table button names the table. */}
                    {opened === undefined ? null : (
                      <Text
                        fontSize={fontSize.sm}
                        lineHeight={fontSize.sm}
                        color="muted-foreground"
                        numberOfLines={1}
                      >
                        {opened}
                      </Text>
                    )}
                  </YStack>
                  <XStack shrink={0} gap={4}>
                    <Button
                      variant="ghost"
                      size="icon"
                      iconStart={Undo2}
                      aria-label={t("bill.summary.undo")}
                      disabled={!cart.canUndo}
                      onPress={() => void cart.undo()}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      iconStart={Redo2}
                      aria-label={t("bill.summary.redo")}
                      disabled={!cart.canRedo}
                      onPress={() => void cart.redo()}
                    />
                  </XStack>
                </XStack>
              ) : null}
              <Collapsible
                open={wide || summaryExpanded}
                onOpenChange={setSummaryOpen}
              >
                {wide ? null : (
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
                        {claimedSum > 0 && (
                          <Text
                            fontSize={fontSize.base}
                            lineHeight={fontSize.base}
                          >
                            {t("bill.summary.leftToPay")}
                          </Text>
                        )}
                        <Animated.View style={amountDuePulse}>
                          <Text
                            fontSize={fontSize.base}
                            lineHeight={fontSize.base}
                            fontWeight={fontWeight.semibold}
                            fontVariant={["tabular-nums"]}
                          >
                            {amountDueLabel}
                          </Text>
                        </Animated.View>
                        <CollapsibleChevron direction="up" />
                      </XStack>
                    </XStack>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent
                  pt={16}
                  testID="bill-summary-panel"
                  // A large monitor's list takes the panel's height.
                  fillHeight={wide}
                  flex={wide ? 1 : undefined}
                  minH={wide ? 0 : undefined}
                >
                  <ScrollView style={wide ? fillStyle : phoneSummaryListStyle}>
                    {wide && summaries.length === 0 ? (
                      <Text
                        pt={64}
                        text="center"
                        fontSize={fontSize.sm}
                        lineHeight={fontSize.sm}
                        color="muted-foreground"
                      >
                        {t("bill.summary.empty")}
                      </Text>
                    ) : null}
                    {summaries.map((summary) => (
                      <SummaryRow
                        key={summary.id}
                        summary={summary}
                        selfPayLine={projectSelfPayViewLine(
                          summary,
                          selfPayAllocated
                        )}
                        locale={locale}
                        catalogItem={
                          summary.catalogItemId === null
                            ? undefined
                            : catalogItemsById.get(summary.catalogItemId)
                        }
                        onAddOne={(catalogItem) =>
                          void cart.addOne(catalogItem)
                        }
                        onRemoveOne={() => void cart.removeOne(summary)}
                        onRemove={async () => {
                          // Ignored while a cart write is in flight, as
                          // Clear: this render's line is about to change.
                          if (cart.isPending()) return
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
                  {wide ? null : (
                    <BillAlreadyPaid
                      claimedSum={claimedSum}
                      amountDue={amountDue}
                      currency={currency}
                      locale={locale}
                    />
                  )}
                  {/* A large monitor has undo and redo in the panel's head and Clear among the actions. */}
                  {wide ? null : (
                    <XStack
                      items="center"
                      justify="space-between"
                      pt={16}
                      py={8}
                    >
                      <XStack gap={4}>
                        <Button
                          variant="outline"
                          size="sm"
                          h={44}
                          px={12}
                          iconStart={Undo2}
                          label={t("bill.summary.undo")}
                          disabled={!cart.canUndo}
                          onPress={() => void cart.undo()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          h={44}
                          px={12}
                          iconStart={Redo2}
                          label={t("bill.summary.redo")}
                          disabled={!cart.canRedo}
                          onPress={() => void cart.redo()}
                        />
                      </XStack>
                      <Button
                        variant="outline"
                        size="sm"
                        h={44}
                        px={12}
                        label={t("bill.summary.clear")}
                        disabled={summaries.length === 0}
                        onPress={() => void handleClear()}
                      />
                    </XStack>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {wide ? (
                <>
                  <DashedRule mt={16} />
                  <XStack
                    pt={16}
                    items="baseline"
                    justify="space-between"
                    gap={8}
                  >
                    <Text
                      shrink={1}
                      fontSize={fontSize.base}
                      lineHeight={fontSize.base}
                      color="muted-foreground"
                    >
                      {t("bill.summary.total")}
                      <Text
                        fontSize={fontSize.sm}
                        lineHeight={fontSize.sm}
                        color="muted-foreground"
                      >
                        {" · "}
                        {t("bill.itemsCount", { value: itemCount })}
                      </Text>
                    </Text>
                    <Animated.View style={totalAmountPulse}>
                      <Text
                        fontSize={fontSize["3xl"]}
                        lineHeight={fontSize["3xl"]}
                        fontWeight={fontWeight.semibold}
                        fontVariant={["tabular-nums"]}
                      >
                        {totalLabel}
                      </Text>
                    </Animated.View>
                  </XStack>
                  <BillAlreadyPaid
                    claimedSum={claimedSum}
                    amountDue={amountDue}
                    currency={currency}
                    locale={locale}
                  />
                </>
              ) : null}
              <XStack
                items="center"
                gap={8}
                pt={16}
                flexWrap={wide ? "wrap" : "nowrap"}
              >
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
                  // A large monitor has the room to name it.
                  size={wide ? "default" : "icon"}
                  w={wide ? undefined : 48}
                  h={48}
                  shrink={wide ? undefined : 0}
                  flex={wide ? 1 : undefined}
                  iconStart={Split}
                  label={wide ? t("bill.split.button.aria") : undefined}
                  aria-label={t("bill.split.button.aria")}
                  disabled={summaries.length === 0 || split.pending}
                  onPress={() => setSplitOpen(true)}
                />
                {/* A phone has it inside the expanded summary instead. */}
                {wide ? (
                  <Button
                    variant="outline"
                    flex={1}
                    h={48}
                    iconStart={Eraser}
                    label={t("bill.summary.clear")}
                    disabled={summaries.length === 0}
                    onPress={() => void handleClear()}
                  />
                ) : null}
                {/* A full row each on a large monitor, web's `lg:basis-full`. */}
                <Button
                  variant="outline"
                  flex={wide ? undefined : 1}
                  w={wide ? "100%" : undefined}
                  h={48}
                  iconStart={Table2}
                  aria-label={t("bill.table.aria")}
                  label={tableName ?? t("bill.table.assign")}
                  onPress={() => setTablePickerOpen(true)}
                />
                {/* Finish closes a bill that comes to zero (payment/0013),
                    Charge creates a payment for anything else. */}
                <BillMainAction
                  cartPendingAtom={cart.pendingAtom}
                  finishing={finishing}
                  flex={wide ? undefined : 1}
                  w={wide ? "100%" : undefined}
                  h={wide ? 56 : 48}
                  aria-label={mainActionLabel}
                  pending={finishing ? finishPending : chargePending}
                  disabled={checkout !== "charge"}
                  onPress={() => {
                    hapticButtonPress()
                    void (finishing ? onFinish() : charge())
                  }}
                >
                  <Text
                    fontSize={wide ? fontSize.base : fontSize.sm}
                    lineHeight={wide ? fontSize.base : fontSize.sm}
                    fontWeight={fontWeight.bold}
                    color="primary-foreground"
                  >
                    {mainActionLabel}
                  </Text>
                </BillMainAction>
              </XStack>
              {checkoutHintKey === null ? null : (
                <Text
                  pt={8}
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                >
                  {t(checkoutHintKey)}
                </Text>
              )}
            </CardContent>
          </SafeAreaView>
        </Card>
      </View>

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
      <ItemQuantityDialog
        name={
          quantityTarget === null ? "" : getStaffDisplayName(quantityTarget)
        }
        open={quantityTarget !== null}
        onOpenChange={(open) => {
          if (!open) setQuantityTarget(null)
        }}
        onAddQuantity={(quantity) => {
          if (quantityTarget !== null)
            void cart.addQuantity(quantityTarget, quantity)
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
    </SafeAreaView>
  )
}

const phoneScreenEdges: ReadonlyArray<SafeAreaEdge> = ["top", "left", "right"]
const wideScreenEdges: ReadonlyArray<SafeAreaEdge> = [
  "top",
  "left",
  "right",
  "bottom",
]
const bottomEdge: ReadonlyArray<SafeAreaEdge> = ["bottom"]
const noEdges: ReadonlyArray<SafeAreaEdge> = []
const fillStyle = { flex: 1 } as const
const phoneSummaryListStyle = { maxHeight: 192 } as const

/** `[0, 1, …, columns - 1]`, the grid's column indexes. */
const gridColumnIndexes = (columns: number): ReadonlyArray<number> =>
  Array.from({ length: columns }, (_, column) => column)

function SummaryRow({
  summary,
  selfPayLine,
  locale,
  catalogItem,
  onAddOne,
  onRemoveOne,
  onRemove,
}: {
  readonly summary: BillLineSummary
  readonly selfPayLine: SelfPayViewLine
  readonly locale: string
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
        bg="surface-raised"
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
        onPress={onRemove}
      />
    </XStack>
  )
}

/**
 * Web's `border-t border-dashed` over the wide panel's total, which rules it
 * off as a printed receipt does — the one line this screen draws. Android
 * draws a dashed border only on all four sides, so a box dashed all round
 * sits in a 1px strip that clips all but its top edge.
 */
function DashedRule(props: { readonly mt?: number }) {
  return (
    <View h={1} overflow="hidden" {...props}>
      <View
        h={2}
        mx={-1}
        borderWidth={1}
        borderStyle="dashed"
        borderColor="border-color"
      />
    </View>
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
 * The side, in points, a tile's library picture is asked for: the grid's
 * narrowest column (`itemGridColumns`' 192), which on a phone's density
 * already asks for the library's largest picture, so a wider tile on a wide
 * window gets no sharper one and nothing waits for the grid's measure.
 */
const TILE_PICTURE_SIZE = 192

/**
 * A tile's press under the finger: over a picture it darkens it, as
 * `card-ring` would barely show there.
 */
const brickFills = {
  pictured: { rest: "transparent", pressed: "photo-pressed" },
  plain: { rest: "transparent", pressed: "card-ring" },
} as const satisfies Record<string, PressFillColors>

/**
 * A tile of the bill's item grid, a square whatever it shows so a row keeps
 * one height. A pictured item's library picture fills it, its name and
 * price over a dark scrim at the bottom; an item without one is the card
 * with its name on top and its price below. On the bill it is ringed in the
 * gold, its quantity in the top corner.
 *
 * A tap anywhere on the tile adds one, as on a till. The brick has no
 * `disabled`: the cart queues taps, and a button disabled mid-tap drops one.
 */
/**
 * Finish or Charge. A cart write still in flight may change the total
 * Finish closes, so Finish waits it out; only this button reads that, so a
 * tap does not render the whole cart as the write starts and ends.
 */
function BillMainAction({
  cartPendingAtom,
  finishing,
  disabled,
  ...props
}: ButtonProps & {
  readonly cartPendingAtom: Atom<boolean>
  readonly finishing: boolean
  readonly disabled: boolean
}) {
  const cartPending = useAtomValue(cartPendingAtom)
  return <Button {...props} disabled={finishing ? cartPending : disabled} />
}

/** What a brick does, made once per cart so its props stay equal (`BillCart`). */
interface BrickActions {
  readonly add: (item: CatalogItemRow) => void
  readonly remove: (summary: BillLineSummary) => void
}

/** A brick's item on the bill: how many, and the line "−" takes one off. */
interface BrickState {
  readonly quantity: number
  readonly latestSummary: BillLineSummary | undefined
  readonly guestPaid: NonNegativeInteger
}

const emptyBrickState: BrickState = {
  quantity: 0,
  latestSummary: undefined,
  guestPaid: NonNegativeInteger(0),
}

const noItemIds: ReadonlyArray<CatalogItemId> = []

const sameIds = (
  a: ReadonlyArray<CatalogItemId>,
  b: ReadonlyArray<CatalogItemId>
) => a.length === b.length && a.every((id, index) => id === b[index])

/**
 * One item of the grid. Its props are primitives, rows and handlers made
 * once, so a tap renders only the bricks whose quantity it changed.
 */
function ItemBrick({
  catalogItem,
  pictureUrl,
  quantity,
  latestSummary,
  guestPaid,
  locale,
  actions,
  onOpenQuantity,
}: BrickState & {
  readonly catalogItem: CatalogItemRow
  /** Its library picture's URL (`libraryPictureUrl`), if it has one. */
  readonly pictureUrl: string | undefined
  readonly locale: string
  readonly actions: BrickActions
  /** Opens the grid's one quantity dialog for this item. */
  readonly onOpenQuantity: (item: CatalogItemRow) => void
}) {
  const { t } = useTranslation()
  const name = getStaffDisplayName(catalogItem)
  const quantityPulse = useChangePulse(quantity)
  const pressFill = usePressFill({ disabled: false })

  const inCart = quantity > 0
  const pictured = pictureUrl !== undefined
  const fill = pictured ? brickFills.pictured : brickFills.plain
  const price = formatMoney(
    { value: catalogItem.unitAmount, currency: catalogItem.currency },
    locale
  )
  const guestPaidLabel =
    guestPaid > 0
      ? t("bill.brick.guestPaid", {
          amount: formatMoney(
            { value: guestPaid, currency: catalogItem.currency },
            locale
          ),
        })
      : null

  return (
    <Card aspectRatio={1} p={0} gap={0}>
      {pictured ? (
        <>
          <LibraryPictureFill url={pictureUrl} />
          <View
            position="absolute"
            t={0}
            r={0}
            b={0}
            l={0}
            bg="photo-dim"
            pointerEvents="none"
          />
          <PhotoScrim />
        </>
      ) : null}
      {/*
       * A tap anywhere on the tile adds one, as on a till; the corner
       * controls above it are kept in place but invisible until the item is
       * on the bill, so nothing moves under the finger.
       */}
      <View
        position="absolute"
        t={0}
        r={0}
        b={0}
        l={0}
        bg={isWeb ? pressFillClause(fill) : undefined}
        {...(isWeb ? { transition: "fast" as const } : {})}
        role="button"
        aria-label={t("bill.brick.add.aria", { name })}
        cursor="web:pointer"
        onPressIn={pressFill.onPressIn}
        onPressOut={pressFill.onPressOut}
        onPress={() => {
          hapticButtonPress()
          actions.add(catalogItem)
        }}
      >
        <PressFill
          progress={pressFill.progress}
          colors={fill}
          rounded={shape.card}
        />
      </View>
      {/* The name and price leave the minus button its corner. */}
      {pictured ? (
        <YStack
          position="absolute"
          l={10}
          r={52}
          b={10}
          gap={2}
          pointerEvents="none"
        >
          <Text
            numberOfLines={2}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
            color="photo-foreground"
            textShadowColor="photo-shadow"
            textShadowOffset={{ width: 0, height: 1 }}
            textShadowRadius={2}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
            fontVariant={["tabular-nums"]}
            color="photo-foreground-85"
            textShadowColor="photo-shadow"
            textShadowOffset={{ width: 0, height: 1 }}
            textShadowRadius={2}
          >
            {price}
          </Text>
          {guestPaidLabel === null ? null : (
            <Text
              numberOfLines={1}
              fontSize={fontSize.xs}
              lineHeight={fontSize.xs}
              fontWeight={fontWeight.medium}
              fontVariant={["tabular-nums"]}
              color="photo-foreground"
              textShadowColor="photo-shadow"
              textShadowOffset={{ width: 0, height: 1 }}
              textShadowRadius={2}
            >
              {guestPaidLabel}
            </Text>
          )}
        </YStack>
      ) : (
        <YStack
          position="absolute"
          t={12}
          l={12}
          r={52}
          b={10}
          justify="space-between"
          gap={4}
          pointerEvents="none"
        >
          <Text
            numberOfLines={3}
            fontSize={fontSize.base}
            lineHeight={fontSize.base}
            fontWeight={fontWeight.semibold}
          >
            {name}
          </Text>
          <YStack gap={2}>
            <Text
              numberOfLines={1}
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.semibold}
              fontVariant={["tabular-nums"]}
              color="muted-foreground"
            >
              {price}
            </Text>
            {guestPaidLabel === null ? null : (
              <Text
                numberOfLines={1}
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                fontWeight={fontWeight.medium}
                fontVariant={["tabular-nums"]}
              >
                {guestPaidLabel}
              </Text>
            )}
          </YStack>
        </YStack>
      )}
      {/*
       * The gold ring of an item on the bill, drawn over the picture: an
       * overlay, as a ring on the card itself would sit under it.
       */}
      {inCart ? (
        <View
          position="absolute"
          t={0}
          r={0}
          b={0}
          l={0}
          rounded={shape.card}
          borderWidth={3}
          borderColor="primary"
          pointerEvents="none"
        />
      ) : null}
      <Button
        size="sm"
        position="absolute"
        t={8}
        r={8}
        h={28}
        minW={28}
        px={8}
        rounded={radius.full}
        opacity={inCart ? 1 : 0}
        disabled={!inCart}
        aria-hidden={!inCart}
        aria-label={t("bill.brick.quantity.trigger.aria", { name })}
        onPress={() => onOpenQuantity(catalogItem)}
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
      <Button
        variant={pictured ? "ghost" : "outline"}
        size="icon"
        position="absolute"
        r={8}
        b={8}
        w={36}
        h={36}
        rounded={radius.full}
        {...(pictured
          ? {
              fillColors: {
                rest: "photo-control",
                pressed: "photo-control-pressed",
              },
              labelColor: "photo-foreground",
            }
          : {})}
        iconStart={Minus}
        aria-label={t("bill.brick.remove.aria", { name })}
        opacity={inCart ? 1 : 0}
        disabled={!inCart}
        onPress={() => {
          if (latestSummary === undefined) return
          hapticButtonPress()
          actions.remove(latestSummary)
        }}
      />
    </Card>
  )
}

/**
 * The dark scrim a pictured tile's name and price sit on, rising from its
 * bottom: 0.82 at the edge, 0.55 at 28 %, gone by 58 % of its height. Drawn
 * as React Native's own `backgroundImage` gradient, which Android draws
 * natively and react-native-web hands to the browser as CSS, so no native
 * module is needed for it.
 */
function PhotoScrim() {
  const theme = useTheme()
  const stops = [
    `${theme["photo-scrim"]?.val} 0%`,
    `${theme["photo-scrim-55"]?.val} 28%`,
    `${theme["photo-scrim-0"]?.val} 58%`,
  ]
  return (
    <NativeView
      style={[
        StyleSheet.absoluteFill,
        {
          pointerEvents: "none",
          backgroundImage: `linear-gradient(to top, ${stops.join(", ")})`,
        },
      ]}
    />
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
