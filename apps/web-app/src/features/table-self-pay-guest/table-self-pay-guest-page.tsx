import { useEventListener } from "@dedalik/use-react"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import { useNow } from "@payky/app-shared/use-now"
import {
  createSelfPayOrderSelectionText,
  createSelfPayWrittenSelectionText,
  type SelfPayMenu,
} from "@payky/core/modules/menu-order/menu-order-utils"
import {
  type FiatCurrency,
  TimestampMs,
} from "@payky/core/modules/shared/schema"
import {
  parseTableSelfPayAddress,
  type TableSelfPayAddress,
} from "@payky/core/modules/table-self-pay/table-self-pay-address-utils"
import {
  findSelfPayBank,
  findSelfPayConfirmation,
  findUsableSelfPayRate,
  isSelfPayViewStale,
  selfPayRateChangesAt,
  selfPayViewConfirmedAt,
  selfPayViewStaleFrom,
} from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import {
  createSelfPaySelectionEvent,
  createSelfPayShareSelectionText,
} from "@payky/core/modules/table-self-pay/table-self-pay-pointer-utils"
import {
  deriveOrderSelfPayReference,
  type SelfPayPointer,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import type {
  SelfPayLiveness,
  SelfPayView,
  SelfPayViewBill,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { prepareGuestInvoiceWallet } from "@payky/core/spark/spark-guest-invoice"
import type { Language } from "@payky/web-shared/landing-redirect"
import { languageOptions } from "@payky/web-shared/language-options"
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx"
import { appEnv } from "@/core/app-env.ts"
import { createE2eGuestInvoiceWallet } from "@/platform/e2e-guest-invoice-wallet.ts"
import { GuestBankPayment } from "./guest-bank-payment.tsx"
import { GuestBillSummary } from "./guest-bill-summary.tsx"
import { GuestCheckout, type GuestPaymentChoice } from "./guest-checkout.tsx"
import { formatGuestAmount, formatGuestTime } from "./guest-format.ts"
import { useGuestLanguage } from "./guest-language.tsx"
import { GuestLightningPayment } from "./guest-lightning-payment.tsx"
import { GuestMenu } from "./guest-menu.tsx"
import { guestMenuOffer } from "./guest-menu-offer.ts"
import {
  GuestOrderList,
  guestOrderLeft,
  guestOrderStatus,
  type ShownGuestOrder,
} from "./guest-order-list.tsx"
import {
  forgetGuestOrder,
  ordersAtTable,
  readGuestOrders,
  rememberGuestOrder,
} from "./guest-orders.ts"
import { GuestOrderPaidFor, GuestPaidFor } from "./guest-paid-for.tsx"
import {
  readPayerPointers,
  rememberPayerPointer,
} from "./guest-payer-pointers.ts"
import {
  guestTabClassName,
  guestTabListClassName,
} from "./guest-pick-styles.ts"
import { GuestStatusRegion, useGuestStatus } from "./guest-status.tsx"
import { GuestTestTransfer } from "./guest-test-transfer.tsx"
import { GuestWrittenOrder } from "./guest-written-order.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"
import {
  paymentWaitEndsAt,
  publishGuestSelection,
  useGuestOrderConfirmations,
  useSelfPayMenu,
  useSelfPayView,
} from "./use-self-pay-view.ts"

type PaymentMethod = "bank" | "lightning" | "test"

type GuestSection = "bill" | "menu" | "write"

interface PaymentSession {
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly amount: number
  readonly pointer: SelfPayPointer
  readonly isSeenByRestaurant: boolean
  readonly startedAt: number
}

interface BillPaymentSession extends PaymentSession {
  readonly bill: SelfPayViewBill
  readonly choice: GuestPaymentChoice
}

const PAYMENT_HISTORY_STATE = "payky.selfPay.payment"

const leavePaymentHistoryEntry = () => {
  if (history.state === PAYMENT_HISTORY_STATE) history.back()
}

function GuestMessage({
  icon,
  title,
  description,
}: {
  readonly icon?: ReactNode
  readonly title: string
  readonly description?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description === undefined ? null : (
        <p className="max-w-72 text-balance text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

function GuestPaymentWait({
  session,
  isWatching,
}: {
  readonly session: PaymentSession
  readonly isWatching: boolean
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const waitEndsAt = paymentWaitEndsAt(session.startedAt)
  const now = useNow([TimestampMs(waitEndsAt)])
  const isWaitOver = now.getTime() >= waitEndsAt
  const status = isWaitOver
    ? t("selfPay.waiting.over.announcement", {
        title: t("selfPay.waiting.over.title"),
        description: t("selfPay.waiting.over.description"),
      })
    : t("selfPay.waiting")

  useEffect(() => {
    announce(status)
  }, [announce, status])

  if (!isWaitOver) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        {isWatching ? (
          <LoaderCircleIcon
            aria-hidden="true"
            data-testid="self-pay-waiting-indicator"
            className="size-4 animate-spin"
          />
        ) : null}
        {t("selfPay.waiting")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-amber-500/10 p-3 text-sm">
      <p className="font-semibold">{t("selfPay.waiting.over.title")}</p>
      <p>{t("selfPay.waiting.over.description")}</p>
      <p className="flex justify-between gap-3 tabular-nums">
        <span>{formatGuestAmount(session.amount, session.bill, locale)}</span>
        <span className="text-muted-foreground">
          {t("selfPay.waiting.over.startedAt", {
            time: formatGuestTime(Math.floor(session.startedAt / 1000), locale),
          })}
        </span>
      </p>
    </div>
  )
}

function GuestBillChangedNotice({ bill }: { readonly bill: SelfPayViewBill }) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const title =
    bill.remainder === 0
      ? t("selfPay.billChanged.nothingLeft.title")
      : t("selfPay.billChanged.title", {
          amount: formatGuestAmount(bill.remainder, bill, locale),
        })
  const description = t(
    bill.remainder === 0
      ? "selfPay.billChanged.nothingLeft.description"
      : "selfPay.billChanged.description"
  )
  const announcement = t("selfPay.billChanged.announcement", {
    title,
    description,
  })

  useEffect(() => {
    announce(announcement)
  }, [announce, announcement])

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-amber-500/10 p-3 text-sm">
      <p className="font-semibold">{title}</p>
      <p>{description}</p>
    </div>
  )
}

function GuestPayment({
  address,
  view,
  liveness,
  session,
  backLabel,
  onBack,
  notice,
  children,
}: {
  readonly address: TableSelfPayAddress
  readonly view: SelfPayView
  readonly liveness: SelfPayLiveness | null
  readonly session: PaymentSession
  readonly backLabel: string
  readonly onBack: () => void
  readonly notice?: ReactNode
  readonly children?: ReactNode
}) {
  const { t, locale } = useGuestTranslation()
  const { lightning } = view
  const bank = findSelfPayBank(view, session.bill)
  const testSelectionKey = appEnv.VITE_PAYKY_SELF_PAY_TEST_TRANSFERS
    ? view.selectionKey
    : null
  const methods = [
    ...(bank === null ? [] : ["bank" as const]),
    ...(lightning === null ? [] : ["lightning" as const]),
    ...(testSelectionKey === null ? [] : ["test" as const]),
  ]
  const paymentSection = useRef<HTMLElement>(null)
  const amountHeading = useRef<HTMLHeadingElement>(null)
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? "lightning")
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isTestTransferSent, setIsTestTransferSent] = useState(false)
  const now = useNow(
    selfPayRateChangesAt(liveness, session.bill.currency).map((moment) =>
      TimestampMs(moment * 1000)
    )
  )
  const rate = findUsableSelfPayRate(
    liveness,
    session.bill.currency,
    Math.floor(now.getTime() / 1000)
  )

  useEffect(() => {
    paymentSection.current?.scrollIntoView({ block: "start" })
    amountHeading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section ref={paymentSection} className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        className="-ms-2 h-11 self-start"
        onClick={onBack}
      >
        <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
        {backLabel}
      </Button>
      <h2
        ref={amountHeading}
        tabIndex={-1}
        className="text-center text-2xl font-semibold tabular-nums outline-none"
      >
        {formatGuestAmount(session.amount, session.bill, locale)}
      </h2>
      {notice}
      {method === "test" && !isTestTransferSent ? null : (
        <GuestPaymentWait
          session={session}
          isWatching={method !== "lightning" || isInvoiceOpen}
        />
      )}
      {children}
      {session.isSeenByRestaurant ? null : (
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm">
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-amber-600"
          />
          {t("selfPay.pay.unseen")}
        </p>
      )}
      {methods.length > 1 ? (
        <Tabs
          value={method}
          onValueChange={(value) => {
            const next = methods.find((candidate) => candidate === value)
            if (next !== undefined) setMethod(next)
          }}
        >
          <TabsList className={guestTabListClassName}>
            {bank === null ? null : (
              <TabsTrigger value="bank" className={guestTabClassName}>
                {t("selfPay.method.bank")}
              </TabsTrigger>
            )}
            {lightning === null ? null : (
              <TabsTrigger value="lightning" className={guestTabClassName}>
                {t("selfPay.method.lightning")}
              </TabsTrigger>
            )}
            {testSelectionKey === null ? null : (
              <TabsTrigger value="test" className={guestTabClassName}>
                {t("selfPay.method.test")}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      ) : null}
      {bank === null ? null : (
        <div hidden={method !== "bank"}>
          <GuestBankPayment
            bank={bank}
            bill={session.bill}
            amount={session.amount}
            pointer={session.pointer}
          />
        </div>
      )}
      {lightning === null ? null : (
        <div hidden={method !== "lightning"}>
          <GuestLightningPayment
            lightning={lightning}
            bill={session.bill}
            rate={rate}
            amount={session.amount}
            pointer={session.pointer}
            onInvoiceOpenChange={setIsInvoiceOpen}
          />
        </div>
      )}
      {testSelectionKey === null ? null : (
        <div hidden={method !== "test"}>
          <GuestTestTransfer
            address={address}
            selectionKey={testSelectionKey}
            bill={session.bill}
            amount={session.amount}
            pointer={session.pointer}
            onSent={() => {
              setIsTestTransferSent(true)
            }}
          />
        </div>
      )}
    </section>
  )
}

interface OrderPaymentSession extends PaymentSession {
  readonly coveredBefore: number
}

const orderBill = (pointer: SelfPayPointer, currency: FiatCurrency) => ({
  reference: deriveOrderSelfPayReference(pointer),
  currency,
})

function GuestSectionTabs({
  address,
  view,
  menuKeys,
  section,
  onSectionChange,
}: {
  readonly address: TableSelfPayAddress
  readonly view: SelfPayView
  readonly menuKeys: NonNullable<SelfPayView["menu"]>
  readonly section: GuestSection
  readonly onSectionChange: (section: GuestSection) => void
}) {
  const { t } = useGuestTranslation()
  const menu = useSelfPayMenu(address, menuKeys).data?.menu?.value ?? null
  const { orderable, writable } = guestMenuOffer(view, menu)
  const sections: ReadonlyArray<{
    readonly value: GuestSection
    readonly label: string
  }> = [
    ...(view.bills.length > 0
      ? [{ value: "bill" as const, label: t("selfPay.menu.tab.bill") }]
      : []),
    ...(orderable !== null || writable === null
      ? [{ value: "menu" as const, label: t("selfPay.menu.tab.menu") }]
      : []),
    ...(writable === null
      ? []
      : [{ value: "write" as const, label: t("selfPay.written.tab") }]),
  ]
  const shownSection =
    sections.find(({ value }) => value === section) ??
    sections.find(({ value }) => value !== "bill")
  if (sections.length < 2 || shownSection === undefined) return null

  return (
    <Tabs
      value={shownSection.value}
      onValueChange={(value) => {
        const next = sections.find((candidate) => candidate.value === value)
        if (next !== undefined) onSectionChange(next.value)
      }}
    >
      <TabsList className={guestTabListClassName}>
        {sections.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className={guestTabClassName}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function GuestOrdering({
  address,
  view,
  menuKeys,
  selectionKey,
  hidden,
  mode,
  session,
  onSessionChange,
  onOrderPlaced,
}: {
  readonly address: TableSelfPayAddress
  readonly view: SelfPayView
  readonly menuKeys: NonNullable<SelfPayView["menu"]>
  readonly selectionKey: string
  readonly hidden: boolean
  readonly mode: Exclude<GuestSection, "bill">
  readonly session: OrderPaymentSession | null
  readonly onSessionChange: (session: OrderPaymentSession | null) => void
  readonly onOrderPlaced: () => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const table = bytesToHex(address.publicKey)
  const { data, isPending } = useSelfPayMenu(address, menuKeys)
  const [orders, setOrders] = useState(readGuestOrders)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isRefused, setIsRefused] = useState(false)
  const ordersBlock = useRef<HTMLElement>(null)
  const tableOrders = ordersAtTable(orders, table)
  const confirmations = useGuestOrderConfirmations({
    address,
    menuPublicKey: menuKeys.publicKey,
    selectionKey,
    orders: tableOrders,
  })
  const shownOrders: ReadonlyArray<ShownGuestOrder> = tableOrders.map(
    (order, index) => ({
      order,
      confirmation: confirmations[index]?.data?.value ?? null,
    })
  )

  const sessionOrder = shownOrders.find(
    ({ order }) => order.pointer === session?.pointer
  )
  const sessionCovered = sessionOrder?.confirmation?.covered ?? null
  const settledStatus =
    session !== null &&
    sessionOrder !== undefined &&
    ((sessionCovered !== null && sessionCovered > session.coveredBefore) ||
      sessionOrder.confirmation?.rejected !== undefined)
      ? guestOrderStatus(sessionOrder, t, locale)
      : null

  const isFocusingOrders = useRef(false)
  useEffect(() => {
    if (settledStatus === null) return
    isFocusingOrders.current = true
    onSessionChange(null)
    leavePaymentHistoryEntry()
    announce(settledStatus)
  }, [announce, onSessionChange, settledStatus])
  useEffect(() => {
    if (session !== null || !isFocusingOrders.current) return
    isFocusingOrders.current = false
    ordersBlock.current?.focus()
  }, [session])

  const isEveryConfirmationRead = confirmations.every(
    (confirmation) => !confirmation.isPending
  )
  const unsettledEvents = isEveryConfirmationRead
    ? shownOrders.flatMap((shown) =>
        shown.confirmation === null || guestOrderLeft(shown) > 0
          ? [shown.order.event]
          : []
      )
    : []
  const republished = useRef(false)
  useEffect(() => {
    if (republished.current || !isEveryConfirmationRead) return
    republished.current = true
    for (const event of unsettledEvents) {
      void publishGuestSelection(address, event)
    }
  }, [address, isEveryConfirmationRead, unsettledEvents])

  if (isPending) {
    return hidden ? null : (
      <GuestMessage
        icon={<LoaderCircleIcon className="animate-spin" />}
        title={t("selfPay.menu.loading")}
      />
    )
  }

  const menu = data?.menu?.value ?? null
  const liveness = data?.liveness?.value ?? null
  const { orderable, writable } = guestMenuOffer(view, menu)
  const isWriting =
    writable !== null && (mode === "write" || orderable === null)

  const startPayment = (payment: OrderPaymentSession) => {
    history.pushState(PAYMENT_HISTORY_STATE, "")
    onSessionChange(payment)
  }

  const placeOrder = async (
    { currency }: SelfPayMenu,
    selectionText: string,
    {
      total,
      amount,
      summary,
    }: {
      readonly total: number
      readonly amount: number
      readonly summary: string
    }
  ) => {
    setIsPreparing(true)
    setIsRefused(false)
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText,
      selectionKey: hexToBytes(selectionKey),
      createdAt: Math.floor(Date.now() / 1000),
    })
    const isAccepted = await publishGuestSelection(address, event)
    setIsPreparing(false)
    if (!isAccepted) {
      setIsRefused(true)
      return
    }
    const startedAt = Date.now()
    onOrderPlaced()
    setOrders((current) =>
      rememberGuestOrder(current, {
        pointer,
        table,
        event,
        currency,
        total,
        summary,
        startedAt,
      })
    )
    startPayment({
      bill: orderBill(pointer, currency),
      amount,
      pointer,
      isSeenByRestaurant: true,
      startedAt,
      coveredBefore: 0,
    })
  }

  const payRest = (shown: ShownGuestOrder) => {
    const { order, confirmation } = shown
    const startedAt = Date.now()
    setOrders((current) => rememberGuestOrder(current, { ...order, startedAt }))
    startPayment({
      bill: orderBill(order.pointer, order.currency),
      amount: confirmation === null ? order.total : guestOrderLeft(shown),
      pointer: order.pointer,
      isSeenByRestaurant: true,
      startedAt,
      coveredBefore: confirmation?.covered ?? 0,
    })
  }

  const leavePayment = () => {
    onSessionChange(null)
    leavePaymentHistoryEntry()
  }

  const forgetOrder = ({ order }: ShownGuestOrder) => {
    setOrders((current) => forgetGuestOrder(current, order.pointer))
  }

  const listedOrders = shownOrders.filter(
    ({ order }) => order.pointer !== session?.pointer
  )

  return (
    <div className="flex flex-1 flex-col gap-4" hidden={hidden}>
      {listedOrders.length === 0 ? null : (
        <GuestOrderList
          ref={ordersBlock}
          orders={listedOrders}
          canAct={() => isEveryConfirmationRead}
          onPayRest={payRest}
          onForget={forgetOrder}
        />
      )}
      {session !== null ? (
        <GuestPayment
          key={`${session.pointer}:${session.startedAt}`}
          address={address}
          view={view}
          liveness={liveness}
          session={session}
          backLabel={t(
            isWriting ? "selfPay.written.back" : "selfPay.order.back"
          )}
          onBack={leavePayment}
        >
          {sessionOrder === undefined ? null : (
            <GuestOrderPaidFor
              order={sessionOrder.order}
              amount={session.amount}
              coveredBefore={session.coveredBefore}
            />
          )}
        </GuestPayment>
      ) : orderable === null && writable === null ? (
        <GuestMessage
          title={t("selfPay.order.unavailable.title")}
          description={t("selfPay.order.unavailable.description")}
        />
      ) : (
        <>
          {isRefused ? (
            <p
              className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm"
              role="alert"
            >
              <TriangleAlertIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-amber-600"
              />
              {t("selfPay.order.refused")}
            </p>
          ) : null}
          {writable === null ? null : (
            <GuestWrittenOrder
              menu={writable}
              hidden={hidden || !isWriting}
              isPreparing={isPreparing}
              onOrder={({ lines, named, amount }) => {
                void placeOrder(
                  writable,
                  createSelfPayWrittenSelectionText({
                    tablePublicKey: table,
                    menu: writable,
                    lines,
                  }),
                  {
                    total: named,
                    amount,
                    summary: lines.map(({ text }) => text).join(", "),
                  }
                )
              }}
            />
          )}
          {orderable === null ? null : (
            <GuestMenu
              menu={orderable}
              hidden={hidden || isWriting}
              isPreparing={isPreparing}
              onOrder={({ items, note, ...choice }) => {
                void placeOrder(
                  orderable,
                  createSelfPayOrderSelectionText({
                    tablePublicKey: table,
                    menu: orderable,
                    items,
                    note,
                  }),
                  choice
                )
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

function GuestTable({ address }: { readonly address: TableSelfPayAddress }) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const [session, setSession] = useState<BillPaymentSession | null>(null)
  const [orderSession, setOrderSession] = useState<OrderPaymentSession | null>(
    null
  )
  const { data, isPending } = useSelfPayView(address, session)
  const offersLightning = (data?.view?.value.lightning ?? null) !== null
  useEffect(() => {
    if (offersLightning) {
      prepareGuestInvoiceWallet(createE2eGuestInvoiceWallet()).catch(
        () => undefined
      )
    }
  }, [offersLightning])
  const [payerPointers, setPayerPointers] = useState(readPayerPointers)
  const [isPreparing, setIsPreparing] = useState(false)
  const [selectedReference, setSelectedReference] = useState<string | null>(
    null
  )
  const [payingMoreAfter, setPayingMoreAfter] = useState<string | null>(null)
  const [section, setSection] = useState<GuestSection>(() =>
    ordersAtTable(readGuestOrders(), bytesToHex(address.publicKey)).length > 0
      ? "menu"
      : "bill"
  )
  const myConfirmationsBlock = useRef<HTMLDivElement>(null)
  const confirmedAt = selfPayViewConfirmedAt(
    data?.view ?? null,
    data?.liveness ?? null
  )
  const staleFrom = selfPayViewStaleFrom(confirmedAt)
  const now = useNow([
    staleFrom === null ? null : TimestampMs(staleFrom * 1000),
  ])
  useEventListener("popstate", () => {
    setSession(null)
    setOrderSession(null)
  })

  const view = data?.view?.value ?? null
  const myConfirmations =
    view === null
      ? []
      : payerPointers.flatMap(({ pointer, reference }) => {
          const confirmation = findSelfPayConfirmation(view, pointer)
          return confirmation === null ? [] : [{ ...confirmation, reference }]
        })
  const bill =
    view?.bills.find(({ reference }) => reference === selectedReference) ??
    view?.bills[0]
  const newestMineOnBill =
    myConfirmations.findLast(
      ({ reference }) => reference === bill?.reference
    ) ?? null
  const doneWith =
    newestMineOnBill !== null &&
    newestMineOnBill.pointerHash !== payingMoreAfter
      ? newestMineOnBill
      : null
  const doneAnnouncement =
    doneWith === null
      ? null
      : t("selfPay.confirmation.mine", {
          amount: formatGuestAmount(doneWith.amount, doneWith, locale),
        })
  const isSessionConfirmed =
    session !== null &&
    view !== null &&
    findSelfPayConfirmation(view, session.pointer) !== null

  useEffect(() => {
    if (!isSessionConfirmed) return
    setSession(null)
    leavePaymentHistoryEntry()
  }, [isSessionConfirmed])

  const donePointerHash = doneWith?.pointerHash ?? null
  useEffect(() => {
    if (donePointerHash === null || doneAnnouncement === null) return
    myConfirmationsBlock.current?.focus()
    announce(doneAnnouncement)
  }, [announce, doneAnnouncement, donePointerHash])

  const unconfirmedEvents =
    view === null
      ? []
      : payerPointers.flatMap(({ pointer, event }) =>
          event === null || findSelfPayConfirmation(view, pointer) !== null
            ? []
            : [event]
        )
  const republished = useRef(false)
  useEffect(() => {
    if (republished.current || unconfirmedEvents.length === 0) return
    republished.current = true
    for (const event of unconfirmedEvents) {
      void publishGuestSelection(address, event)
    }
  }, [address, unconfirmedEvents])

  if (isPending) {
    return (
      <GuestMessage
        icon={<LoaderCircleIcon className="animate-spin" />}
        title={t("selfPay.loading")}
      />
    )
  }
  if (view === null) {
    return (
      <GuestMessage
        title={t("selfPay.unavailable.title")}
        description={t("selfPay.unavailable.description")}
      />
    )
  }

  const liveness = data?.liveness?.value ?? null
  const myPointerHashes = new Set(
    myConfirmations.map(({ pointerHash }) => pointerHash)
  )
  const otherConfirmations = view.confirmations.filter(
    ({ pointerHash }) => !myPointerHashes.has(pointerHash)
  )
  const pendingSession =
    session !== null && !isSessionConfirmed ? session : null
  const changedBill =
    pendingSession === null
      ? null
      : (view.bills.find(
          ({ reference, remainder }) =>
            reference === pendingSession.bill.reference &&
            remainder < pendingSession.choice.share.amount
        ) ?? null)
  const isStale = isSelfPayViewStale(
    confirmedAt,
    Math.floor(now.getTime() / 1000)
  )
  const bank = bill === undefined ? view.bank : findSelfPayBank(view, bill)
  const offersMethod = bank !== null || view.lightning !== null
  const menuAccess =
    view.enabled && view.menu !== null && view.selectionKey !== null
      ? { menuKeys: view.menu, selectionKey: view.selectionKey }
      : null
  const offersBillAndMenu = menuAccess !== null && view.bills.length > 0
  const hasBillPart = menuAccess === null || offersBillAndMenu
  const shownMenu =
    menuAccess !== null && (!offersBillAndMenu || section !== "bill")
      ? menuAccess
      : null
  const isPaying =
    shownMenu === null ? pendingSession !== null : orderSession !== null

  const startPayment = async (choice: GuestPaymentChoice) => {
    if (bill === undefined || view.selectionKey === null) return
    setIsPreparing(true)
    const { pointer, event } = createSelfPaySelectionEvent({
      selectionText: createSelfPayShareSelectionText({
        bill,
        split: choice.split,
      }),
      selectionKey: hexToBytes(view.selectionKey),
      createdAt: Math.floor(Date.now() / 1000),
    })
    const isSeenByRestaurant = await publishGuestSelection(address, event)
    setIsPreparing(false)
    setPayerPointers((pointers) =>
      rememberPayerPointer(pointers, {
        pointer,
        reference: bill.reference,
        event,
      })
    )
    history.pushState(PAYMENT_HISTORY_STATE, "")
    setSession({
      bill,
      amount: choice.amount,
      choice,
      pointer,
      isSeenByRestaurant,
      startedAt: Date.now(),
    })
  }

  const leavePayment = () => {
    setSession(null)
    leavePaymentHistoryEntry()
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">{view.table}</h1>
        {view.payee === null ? null : (
          <p className="text-sm text-muted-foreground">
            {t("selfPay.payee", { payee: view.payee })}
          </p>
        )}
      </header>

      {myConfirmations.length === 0 ? null : (
        <div
          ref={myConfirmationsBlock}
          tabIndex={-1}
          className="flex flex-col gap-2 outline-none"
        >
          {myConfirmations.map((confirmation) => (
            <div
              key={confirmation.pointerHash}
              className="flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-sm"
            >
              <CircleCheckIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold">
                  {t("selfPay.confirmation.mine", {
                    amount: formatGuestAmount(
                      confirmation.amount,
                      confirmation,
                      locale
                    ),
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("selfPay.confirmation.mine.detail")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {menuAccess === null || isPaying ? null : (
        <GuestSectionTabs
          address={address}
          view={view}
          menuKeys={menuAccess.menuKeys}
          section={section}
          onSectionChange={(next) => {
            setSection(next)
            leavePayment()
          }}
        />
      )}

      {!view.enabled ? (
        <GuestMessage
          title={t("selfPay.disabled.title")}
          description={t("selfPay.disabled.description")}
        />
      ) : (
        <>
          {menuAccess === null ? null : (
            <GuestOrdering
              address={address}
              view={view}
              {...menuAccess}
              hidden={shownMenu === null}
              mode={section === "write" ? "write" : "menu"}
              session={orderSession}
              onSessionChange={setOrderSession}
              onOrderPlaced={() => {
                setSection((current) => (current === "bill" ? "menu" : current))
              }}
            />
          )}
          {!hasBillPart ? null : (
            <div
              className="flex flex-1 flex-col gap-4"
              hidden={shownMenu !== null}
            >
              {!offersMethod ? (
                <GuestMessage
                  title={t("selfPay.disabled.title")}
                  description={t("selfPay.noMethod.description")}
                />
              ) : bill === undefined ? (
                <GuestMessage
                  title={t("selfPay.empty.title")}
                  description={t("selfPay.empty.description")}
                />
              ) : (
                <>
                  {isStale ? (
                    <p
                      className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm"
                      role="alert"
                    >
                      <TriangleAlertIcon className="size-5 shrink-0 text-amber-600" />
                      {confirmedAt === null
                        ? t("selfPay.stale.never")
                        : t("selfPay.stale", {
                            time: formatGuestTime(confirmedAt, locale),
                          })}
                    </p>
                  ) : null}
                  {view.bills.length > 1 && pendingSession === null ? (
                    <Tabs
                      value={bill.reference}
                      onValueChange={(value) => {
                        setSelectedReference(String(value))
                        leavePayment()
                      }}
                    >
                      <TabsList className={guestTabListClassName}>
                        {view.bills.map((candidate, index) => (
                          <TabsTrigger
                            key={candidate.reference}
                            value={candidate.reference}
                            className={`${guestTabClassName} flex-col gap-0`}
                          >
                            <span>
                              {t("selfPay.bill.number", { number: index + 1 })}
                            </span>
                            <span className="text-xs tabular-nums">
                              {t("selfPay.bill.left", {
                                amount: formatGuestAmount(
                                  candidate.remainder,
                                  candidate,
                                  locale
                                ),
                              })}
                            </span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  ) : null}
                  {pendingSession === null ? (
                    <GuestBillSummary bill={bill} />
                  ) : null}
                  {doneWith === null ? (
                    <GuestCheckout
                      key={bill.reference}
                      bill={bill}
                      initialMode={
                        newestMineOnBill === null ? "remainder" : null
                      }
                      hidden={shownMenu !== null || pendingSession !== null}
                      isPreparing={isPreparing}
                      onContinue={(choice) => {
                        void startPayment(choice)
                      }}
                    />
                  ) : bill.remainder > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        setPayingMoreAfter(doneWith.pointerHash)
                      }}
                    >
                      {t("selfPay.payMore")}
                    </Button>
                  ) : null}
                  {pendingSession === null ? null : (
                    <GuestPayment
                      address={address}
                      view={view}
                      liveness={liveness}
                      session={pendingSession}
                      backLabel={t("selfPay.back")}
                      onBack={leavePayment}
                      notice={
                        changedBill === null ? null : (
                          <GuestBillChangedNotice bill={changedBill} />
                        )
                      }
                    >
                      <GuestPaidFor
                        bill={pendingSession.bill}
                        choice={pendingSession.choice}
                      />
                    </GuestPayment>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {shownMenu === null && otherConfirmations.length > 0 ? (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="text-muted-foreground">
            {t("selfPay.confirmations.title")}
          </h2>
          <ul>
            {otherConfirmations.map((confirmation) => (
              <li key={`${confirmation.pointerHash}-${confirmation.at}`}>
                {t("selfPay.confirmation.other", {
                  amount: formatGuestAmount(
                    confirmation.amount,
                    confirmation,
                    locale
                  ),
                  time: formatGuestTime(confirmation.at, locale),
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shownMenu === null &&
      view.enabled &&
      offersMethod &&
      bill !== undefined &&
      doneWith === null &&
      pendingSession === null ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("selfPay.footer")}
        </p>
      ) : null}
    </div>
  )
}

function GuestLanguageSelect() {
  const { t } = useGuestTranslation()
  const { language, setLanguage } = useGuestLanguage()

  return (
    <Select<Language>
      value={language}
      onValueChange={(nextLanguage: Language | null) => {
        if (nextLanguage !== null) {
          setLanguage(nextLanguage)
        }
      }}
    >
      <SelectTrigger
        aria-label={t("selfPay.language.label")}
        size="sm"
        className="gap-1 self-end border-none bg-transparent px-2 text-muted-foreground text-sm shadow-none hover:bg-transparent hover:text-muted-foreground data-[popup-open]:text-muted-foreground data-[size=sm]:h-11 [&_svg]:text-current"
      >
        <LanguagesIcon aria-hidden="true" className="size-3.5" />
        <SelectValue>
          {(value: Language) =>
            languageOptions.find((option) => option.value === value)?.label ??
            value
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {languageOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function TableSelfPayGuestPage({
  address,
}: {
  readonly address: string
}) {
  const { t } = useGuestTranslation()
  const tableAddress = useMemo(
    () => parseTableSelfPayAddress(address),
    [address]
  )

  return (
    <GuestStatusRegion>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
        <GuestLanguageSelect />
        {tableAddress === null ? (
          <GuestMessage
            icon={<TriangleAlertIcon />}
            title={t("selfPay.invalid.title")}
            description={t("selfPay.invalid.description")}
          />
        ) : (
          <GuestTable address={tableAddress} />
        )}
      </main>
    </GuestStatusRegion>
  )
}
