import { Capacitor } from "@capacitor/core"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  clearPaymentMethodPreparation,
  createPaymentMethodPreparationRunner,
  failPaymentMethodPreparation,
  type PaymentMethodPreparationState,
  requestPaymentMethodPreparation,
  retryPaymentMethodPreparation,
} from "@payky/app-shared/payment-method-preparation"
import { useNow } from "@payky/app-shared/use-now"
import { useRedirectIfClosedOnOpen } from "@payky/app-shared/use-redirect-if-closed-on-open"
import { buildCashuPaymentUri } from "@payky/core/cashu/cashu-payment-request"
import { createQerkoPaymentQrPayload } from "@payky/core/integrations/qerko/qerko-client"
import { enabledPaymentMethodAccountsQuery } from "@payky/core/modules/account/account-queries"
import type { BankQrFormat } from "@payky/core/modules/account/account-types"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getPaymentMethodOrder } from "@payky/core/modules/app-settings/app-settings-utils"
import {
  cancelPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
  payPaymentWithSwitchioCard,
} from "@payky/core/modules/payment/payment-actions"
import type { PayPaymentWithSwitchioCardError } from "@payky/core/modules/payment/payment-errors"
import {
  type BankQrPayload,
  createBankQrPayloads,
} from "@payky/core/modules/payment/payment-iban-qr-payload-utils"
import {
  prepareCashuPaymentMethod,
  preparePaymentMethod,
} from "@payky/core/modules/payment/payment-preparation-actions"
import {
  paymentClaimsQuery,
  paymentRequestQuery,
} from "@payky/core/modules/payment/payment-queries"
import { derivePaymentStatus } from "@payky/core/modules/payment/payment-status-utils"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import {
  Currency,
  type NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { Link, useNavigate } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
  AtSignIcon,
  BanknoteIcon,
  CoinsIcon,
  CreditCardIcon,
  LandmarkIcon,
  LoaderCircleIcon,
  NfcIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { LayoutGroup, motion } from "motion/react"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { QerkoIcon } from "@/components/qerko-icon.tsx"
import { RouteMessage } from "@/components/route-message.tsx"
import {
  SlidingPillSegmentContent,
  slidingPillLayout,
  useSlidingPillTransition,
} from "@/components/sliding-pill.tsx"
import { SuccessPanel } from "@/components/success-panel.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx"
import { appEnv } from "@/core/app-env.ts"
import { PaymentMethodTabContent } from "@/features/payment-wait/payment-wait-method-tabs.tsx"
import { QrPaymentRequest } from "@/features/payment-wait/payment-wait-qr-request.tsx"
import type {
  PaymentMethodOption,
  PaymentMethodTab,
} from "@/features/payment-wait/payment-wait-types.ts"
import { useEetSettings } from "@/features/shared/use-eet-settings.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun, useCashuAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useNostrIdentity, useNostrProfile } from "@/hooks/use-nostr-profile.ts"
import { useCashuRunToast, useRunToast } from "@/hooks/use-run-toast.ts"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"
import { isNfcPlatform } from "@/platform/nfc.ts"

const preparingPaymentMethodKeys = {
  spark: "paymentWait.preparing.spark",
  iban: "paymentWait.preparing.iban",
  cash: "paymentWait.preparing.cash",
  card: "paymentWait.preparing.card",
  qerko: "paymentWait.preparing.qerko",
  qerkoPayment: "paymentWait.preparing.qerkoPayment",
  cashu: "paymentWait.preparing.cashu",
  lightningAddress: "paymentWait.preparing.lightningAddress",
} satisfies Record<PaymentMethodTab, TranslationKey>

/** Read off the exhaustive table above, so a new tab cannot be left out. */
const isPaymentMethodTab = (value: unknown): value is PaymentMethodTab =>
  typeof value === "string" && Object.hasOwn(preparingPaymentMethodKeys, value)

/**
 * A card decline and an unreadable terminal result must never read the
 * same: after an unreadable result the card may well have been charged, so
 * staff has to check SwitchioPay instead of simply tapping again.
 */
const cardPaymentErrorKeys = {
  PaymentNotFound: "paymentWait.cardPaid.error.generic",
  PaymentNotPayable: "paymentWait.cardPaid.error.notPayable",
  CardSwitchioAccountNotFound: "paymentWait.cardPaid.error.generic",
  AccountCurrencyMismatch: "paymentWait.cardPaid.error.generic",
  SwitchioAttemptUnresolved: "paymentWait.cardPaid.error.unreadable",
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
  SwitchioPaymentFailed: "paymentWait.cardPaid.error.declined",
  SwitchioResultUnreadable: "paymentWait.cardPaid.error.unreadable",
} satisfies Record<PayPaymentWithSwitchioCardError["type"], TranslationKey>

export function PaymentWaitPage({ paymentId }: { readonly paymentId: string }) {
  const { t } = useTranslation()
  const parsedPaymentId = PaymentId.safeParse(paymentId)

  if (!parsedPaymentId.success) {
    return <RouteMessage>{t("paymentWait.invalidId")}</RouteMessage>
  }

  return <PaymentWaitRequest paymentId={parsedPaymentId.data} />
}

function PaymentWaitRequest({ paymentId }: { readonly paymentId: PaymentId }) {
  const appRun = useAppRun()
  const cashuAppRun = useCashuAppRun()
  const runToast = useRunToast()
  const cashuRunToast = useCashuRunToast()
  const { require } = useRequirePermission()
  const deviceId = useAtomValue(accountAtom).device.id
  const console = useConsole()
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const confirm = useConfirmDialog()
  const { isSandboxActive: isEetSandboxActive } = useEetSettings()
  const pillTransition = useSlidingPillTransition()
  const [cashPaymentPending, setCashPaymentPending] = useState(false)
  const [cashPaymentErrorKey, setCashPaymentErrorKey] =
    useState<TranslationKey | null>(null)
  const [ibanPaymentPending, setIbanPaymentPending] = useState(false)
  const [ibanPaymentErrorKey, setIbanPaymentErrorKey] =
    useState<TranslationKey | null>(null)
  const [cardPaymentPending, setCardPaymentPending] = useState(false)
  const [cardPaymentErrorKey, setCardPaymentErrorKey] =
    useState<TranslationKey | null>(null)
  const [cancelPending, setCancelPending] = useState(false)
  const [newCashuQuotePending, setNewCashuQuotePending] = useState(false)
  const [paymentMethodPreparationState, setPaymentMethodPreparationState] =
    useState<PaymentMethodPreparationState>({})
  const [paymentMethodPreparationRunner] = useState(
    createPaymentMethodPreparationRunner
  )
  const [successVisible, setSuccessVisible] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodTab | null>(null)
  const [selectedIbanQrFormat, setSelectedIbanQrFormat] =
    useState<BankQrFormat | null>(null)
  const query = paymentRequestQuery(paymentId)
  const claimsQuery = paymentClaimsQuery(paymentId)
  const { data: payments } = useEvoluQuery(query)
  const { data: claims } = useEvoluQuery(claimsQuery)
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const { data: enabledPaymentMethodAccounts } = useEvoluQuery(
    enabledPaymentMethodAccountsQuery
  )
  const [qerkoPaymentPlugin] = useEvoluQuery(qerkoPluginQuery("standard")).data
  const payment = payments[0]
  const [settings] = settingsData
  // The profile name is the recipient the bank QR names (payment/0005). It
  // comes from relays, so the QR shows at once and takes the name when it
  // lands rather than waiting on a relay that may be slow or down.
  const { pubkey } = useNostrIdentity()
  const profileName = useNostrProfile(pubkey).data?.name ?? null
  // Spark/Lightning payments always carry an `expiresAt`, and nothing writes
  // a row when that moment arrives — so without a ticking clock the expired
  // QR stayed on screen, `wakeLockEnabled` stayed true and Cancel kept
  // treating the payment as live until some unrelated query update forced a
  // re-render.
  const now = useNow([payment?.expiresAt ?? null])
  const paymentStatus =
    payment === undefined
      ? null
      : derivePaymentStatus({
          canceledAt: payment.canceledAt,
          confirmedPaidAt: payment.confirmedPaidAt,
          expiresAt: payment.expiresAt,
          hasActiveClaim: claims.length > 0,
          now,
        })
  // `derivePaymentStatus` ranks `canceled` above `paid` (see
  // docs/bill-payment-states.md), so `isPaid` here can never be true for a
  // payment that also has `canceledAt` set — unlike the old `claims.length >
  // 0` check, which ignored cancellation entirely.
  const closedOnOpen = useRedirectIfClosedOnOpen(
    paymentId,
    paymentStatus === "paid" || paymentStatus === "canceled",
    () => {
      void navigate({
        to: "/activity/$paymentId",
        params: { paymentId },
        replace: true,
      })
    }
  )
  const isPaid = paymentStatus === "paid"
  const wakeLockEnabled = payment !== undefined && paymentStatus === "pending"
  const { supported: wakeLockSupported } = useScreenWakeLock(wakeLockEnabled)

  const orderedPaymentMethods = useMemo(() => {
    const paymentMethods: PaymentMethodOption[] = []
    const paymentMethodOrder = getPaymentMethodOrder(settings)

    const enabledSparkAccount = enabledPaymentMethodAccounts.find(
      (account) => account.kind === "spark" && account.sparkSecret !== null
    )
    if (enabledSparkAccount) {
      paymentMethods.push({
        id: "spark",
        kind: "spark",
        accountId: enabledSparkAccount.id,
        label: t("paymentWait.method.lightning"),
        qrPayload: payment?.lnInvoice ?? payment?.sparkInvoice ?? null,
        icon: <ZapIcon />,
      })
    }

    const enabledIbanAccount = enabledPaymentMethodAccounts.find(
      (account) =>
        account.kind === "iban" &&
        account.iban !== null &&
        account.ibanCurrency === payment?.currency
    )
    if (enabledIbanAccount) {
      const defaultQrFormat = enabledIbanAccount.ibanDefaultQrFormat ?? "spayd"
      const activeQrFormat = selectedIbanQrFormat ?? defaultQrFormat
      const canCreateIbanQrPayloads =
        payment !== undefined &&
        payment.ibanAccountId !== null &&
        enabledIbanAccount.iban !== null &&
        enabledIbanAccount.name !== null
      const availableIbanQrPayloads: ReadonlyArray<BankQrPayload> =
        canCreateIbanQrPayloads
          ? createBankQrPayloads({
              profileName,
              bankAccountName: enabledIbanAccount.name,
              iban: enabledIbanAccount.iban,
              amount: payment.amount,
              currency: payment.currency,
              specificSymbol: payment.specificSymbol,
              variableSymbol: payment.variableSymbol,
            })
          : []
      const activeQrPayload =
        availableIbanQrPayloads.find(
          (payload) => payload.format === activeQrFormat
        )?.payload ??
        availableIbanQrPayloads.find(
          (payload) => payload.format === defaultQrFormat
        )?.payload ??
        availableIbanQrPayloads[0]?.payload ??
        null

      paymentMethods.push({
        id: "iban",
        kind: "iban",
        accountId: enabledIbanAccount.id,
        label: t("paymentWait.method.iban"),
        qrPayload: activeQrPayload,
        qrPayloads: availableIbanQrPayloads,
        defaultQrFormat,
        iban: enabledIbanAccount.iban,
        icon: <LandmarkIcon />,
      })
    }

    const enabledCashRegisterAccount = enabledPaymentMethodAccounts.find(
      (account) =>
        account.kind === "cashRegister" &&
        account.cashRegisterCurrency === payment?.currency
    )
    if (enabledCashRegisterAccount) {
      paymentMethods.push({
        id: "cash",
        kind: "cashRegister",
        accountId: enabledCashRegisterAccount.id,
        label: t("paymentWait.method.cash"),
        qrPayload: null,
        icon: <BanknoteIcon />,
      })
    }

    // The SwitchioPay terminal is driven through Android intents, so the
    // method only exists inside the native app — offering it in a browser or
    // PWA would render a tab whose only button can never work.
    const enabledCardAccount = Capacitor.isNativePlatform()
      ? enabledPaymentMethodAccounts.find(
          (account) =>
            account.kind === "cardSwitchio" &&
            account.cardCurrency === payment?.currency
        )
      : undefined
    if (enabledCardAccount) {
      paymentMethods.push({
        id: "card",
        kind: "cardSwitchio",
        accountId: enabledCardAccount.id,
        label: t("paymentWait.method.card"),
        qrPayload: null,
        icon: <CreditCardIcon />,
      })
    }

    // Qerko is plain HTTP with CORS open, so unlike Switchio it works in the
    // PWA as well.
    const enabledQerkoAccount = enabledPaymentMethodAccounts.find(
      (account) =>
        account.kind === "qerkoTerminal" &&
        account.qerkoTerminalCurrency === payment?.currency
    )
    if (enabledQerkoAccount) {
      paymentMethods.push({
        id: "qerko",
        kind: "qerkoTerminal",
        accountId: enabledQerkoAccount.id,
        label: t("paymentWait.method.qerko"),
        qrPayload: null,
        icon: <NfcIcon />,
      })
    }

    // Qerko payments need the restaurant the pairing names for their QR code.
    const qerkoRestaurantId = qerkoPaymentPlugin?.restaurantId ?? null
    const enabledQerkoPaymentAccount =
      qerkoRestaurantId === null
        ? undefined
        : enabledPaymentMethodAccounts.find(
            (account) =>
              account.kind === "qerkoPayment" &&
              account.qerkoPaymentCurrency === payment?.currency
          )
    if (enabledQerkoPaymentAccount && qerkoRestaurantId !== null) {
      const prepared =
        payment?.qerkoPaymentAccountId !== null &&
        payment?.qerkoPaymentAccountId !== undefined
      paymentMethods.push({
        id: "qerkoPayment",
        kind: "qerkoPayment",
        accountId: enabledQerkoPaymentAccount.id,
        label: t("paymentWait.method.qerkoPayment"),
        qrPayload: prepared
          ? createQerkoPaymentQrPayload({
              restaurantId: qerkoRestaurantId,
              qrIdentifier: paymentId,
            })
          : null,
        connectionDeviceId:
          enabledQerkoPaymentAccount.qerkoPaymentConnectionDeviceId,
        icon: <QerkoIcon />,
      })
    }

    const enabledCashuAccount = enabledPaymentMethodAccounts.find(
      (account) => account.kind === "cashu"
    )
    if (enabledCashuAccount) {
      const cashuInvoice = payment?.cashuLnInvoice ?? null
      const cashuMint = payment?.cashuMintUrl ?? null
      const quoteExpiresAt = payment?.cashuQuoteExpiresAt ?? null
      paymentMethods.push({
        id: "cashu",
        kind: "cashu",
        accountId: enabledCashuAccount.id,
        label: t("paymentWait.method.cashu"),
        qrPayload:
          cashuInvoice === null || cashuMint === null
            ? null
            : buildCashuPaymentUri({
                paymentId,
                lnInvoice: cashuInvoice,
                amountSats: payment?.cashuAmountSats ?? 0,
                mintUrl: cashuMint,
                nostrPubkey: pubkey,
                relays: appEnv.VITE_PAYKY_NOSTR_RELAYS,
              }),
        quoteExpired:
          quoteExpiresAt !== null && now.getTime() >= quoteExpiresAt,
        icon: <CoinsIcon />,
      })
    }

    const enabledLightningAddressAccount = enabledPaymentMethodAccounts.find(
      (account) =>
        account.kind === "lightningAddress" && account.lightningAddress !== null
    )
    if (enabledLightningAddressAccount) {
      paymentMethods.push({
        id: "lightningAddress",
        kind: "lightningAddress",
        accountId: enabledLightningAddressAccount.id,
        label: t("paymentWait.method.lightningAddress"),
        qrPayload: payment?.lightningAddressLnInvoice ?? null,
        icon: <AtSignIcon />,
      })
    }

    return paymentMethods.toSorted(
      (firstMethod, secondMethod) =>
        paymentMethodOrder.indexOf(firstMethod.kind) -
        paymentMethodOrder.indexOf(secondMethod.kind)
    )
  }, [
    enabledPaymentMethodAccounts,
    now,
    payment,
    paymentId,
    profileName,
    pubkey,
    qerkoPaymentPlugin,
    selectedIbanQrFormat,
    settings,
    t,
  ])
  const selectedPaymentMethodOption =
    selectedPaymentMethod === null
      ? null
      : (orderedPaymentMethods.find(
          (method) => method.id === selectedPaymentMethod
        ) ?? null)
  const activePaymentMethod =
    selectedPaymentMethodOption ?? orderedPaymentMethods[0] ?? null
  const activePreparationKey =
    activePaymentMethod === null
      ? null
      : `${paymentId}:${activePaymentMethod.id}:${activePaymentMethod.accountId}`
  const activePreparationStatus =
    activePreparationKey === null
      ? undefined
      : paymentMethodPreparationState[activePreparationKey]
  const activePreparingPaymentMethodKey =
    activePaymentMethod !== null &&
    activePreparationStatus?.status === "preparing"
      ? preparingPaymentMethodKeys[activePaymentMethod.id]
      : null
  const activePreparePaymentErrorKey =
    activePreparationStatus?.status === "failed"
      ? "paymentWait.prepareError"
      : null
  const activePaymentMethodIsPrepared =
    activePaymentMethod !== null &&
    payment !== undefined &&
    ((activePaymentMethod.id === "spark" &&
      (payment.lnInvoice !== null || payment.sparkInvoice !== null)) ||
      (activePaymentMethod.id === "iban" && payment.ibanAccountId !== null) ||
      (activePaymentMethod.id === "cash" &&
        payment.cashRegisterAccountId !== null &&
        payment.cashRegisterAccountId !== undefined) ||
      (activePaymentMethod.id === "card" &&
        payment.cardAccountId !== null &&
        payment.cardAccountId !== undefined) ||
      (activePaymentMethod.id === "qerko" &&
        payment.qerkoAccountId !== null &&
        payment.qerkoAccountId !== undefined) ||
      (activePaymentMethod.id === "qerkoPayment" &&
        payment.qerkoPaymentAccountId !== null &&
        payment.qerkoPaymentAccountId !== undefined) ||
      (activePaymentMethod.id === "cashu" &&
        payment.cashuLnInvoice !== null &&
        payment.cashuLnInvoice !== undefined) ||
      (activePaymentMethod.id === "lightningAddress" &&
        payment.lightningAddressLnInvoice !== null &&
        payment.lightningAddressLnInvoice !== undefined))

  const runPaymentMethodPreparation = useCallback(
    async (
      method: Pick<PaymentMethodOption, "accountId" | "kind">,
      preparationKey: string
    ) => {
      try {
        // Only a Cashu preparation reads the Cashu wallet, and only now: no
        // other method waits on it, or fails with it.
        const prepare = async () => {
          if (method.kind === "cashu") {
            await using run = await cashuAppRun()
            return await run(
              prepareCashuPaymentMethod({
                paymentId,
                accountId: method.accountId,
              })
            )
          }
          await using run = appRun()
          return await run(
            preparePaymentMethod({
              paymentId,
              ...(method.kind === "cashRegister"
                ? { cashRegister: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "cardSwitchio"
                ? { card: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "qerkoTerminal"
                ? { qerkoTerminal: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "qerkoPayment"
                ? { qerkoPayment: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "iban"
                ? { bank: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "spark"
                ? { spark: { accountId: method.accountId } }
                : {}),
              ...(method.kind === "lightningAddress"
                ? { lightningAddress: { accountId: method.accountId } }
                : {}),
            })
          )
        }
        const result = await prepare()

        if (!result.ok) {
          console.error("Failed to prepare payment method", result.error)
          setPaymentMethodPreparationState((state) =>
            failPaymentMethodPreparation(state, preparationKey, result.error)
          )
        }
      } catch (error) {
        console.error("Failed to prepare payment method", error)
        setPaymentMethodPreparationState((state) =>
          failPaymentMethodPreparation(state, preparationKey, error)
        )
      }
    },
    [appRun, cashuAppRun, console, paymentId]
  )

  useEffect(() => {
    if (isPaid) setSuccessVisible(true)
  }, [isPaid])

  useEffect(() => {
    if (
      selectedPaymentMethod === null ||
      orderedPaymentMethods.some(
        (method) => method.id === selectedPaymentMethod
      )
    ) {
      return
    }

    setSelectedPaymentMethod(null)
  }, [orderedPaymentMethods, selectedPaymentMethod])

  useEffect(() => {
    if (
      payment === undefined ||
      activePaymentMethod === null ||
      activePreparationKey === null ||
      isPaid
    ) {
      return
    }

    if (activePaymentMethodIsPrepared) {
      setPaymentMethodPreparationState((state) =>
        clearPaymentMethodPreparation(state, activePreparationKey)
      )
      return
    }

    const transition = requestPaymentMethodPreparation(
      paymentMethodPreparationState,
      activePreparationKey
    )
    if (!transition.shouldPrepare) return

    setPaymentMethodPreparationState(transition.state)
    void paymentMethodPreparationRunner.run(activePreparationKey, () =>
      runPaymentMethodPreparation(activePaymentMethod, activePreparationKey)
    )
  }, [
    activePaymentMethodIsPrepared,
    activePreparationKey,
    activePaymentMethod,
    isPaid,
    payment,
    paymentMethodPreparationRunner,
    paymentMethodPreparationState,
    runPaymentMethodPreparation,
  ])

  const handleRetryPaymentMethodPreparation = () => {
    if (
      activePaymentMethod === null ||
      activePreparationKey === null ||
      activePaymentMethodIsPrepared ||
      isPaid
    ) {
      return
    }

    const transition = retryPaymentMethodPreparation(
      paymentMethodPreparationState,
      activePreparationKey
    )
    if (!transition.shouldPrepare) return

    setPaymentMethodPreparationState(transition.state)
    void paymentMethodPreparationRunner.run(activePreparationKey, () =>
      runPaymentMethodPreparation(activePaymentMethod, activePreparationKey)
    )
  }

  if (!payment) {
    return <RouteMessage>{t("paymentWait.notFound")}</RouteMessage>
  }

  if (payment.canceledAt !== null) {
    return <RouteMessage>{t("paymentWait.canceled")}</RouteMessage>
  }

  const cashRegisterAccountId = payment.cashRegisterAccountId
  const isCashPaymentMethod = activePaymentMethod?.id === "cash"
  const canMarkCashPaid =
    isCashPaymentMethod &&
    cashRegisterAccountId !== null &&
    cashRegisterAccountId !== undefined &&
    !isPaid
  const ibanAccountId = payment.ibanAccountId
  const isIbanPaymentMethod = activePaymentMethod?.id === "iban"
  const canMarkIbanPaid =
    isIbanPaymentMethod &&
    ibanAccountId !== null &&
    ibanAccountId !== undefined &&
    !isPaid
  const cardAccountId = payment.cardAccountId
  const isCardPaymentMethod = activePaymentMethod?.id === "card"
  const cardUnresolvedTransactionId = payment.cardUnresolvedTransactionId
  const canPayCard =
    isCardPaymentMethod &&
    cardAccountId !== null &&
    cardAccountId !== undefined &&
    paymentStatus === "pending"
  const canCancelPayment = payment.canceledAt === null && !isPaid
  const activeAmountSats =
    activePaymentMethod?.id === "cashu"
      ? (payment.cashuAmountSats ?? null)
      : activePaymentMethod?.id === "lightningAddress"
        ? (payment.lightningAddressAmountSats ?? null)
        : payment.amountSats
  // A Bolt Card pays a Lightning invoice, not a Spark one, and only Android
  // has an NFC reader that can wait under the QR for a tap.
  const boltCardPaymentId =
    isNfcPlatform() &&
    paymentStatus === "pending" &&
    ((activePaymentMethod?.id === "spark" && payment.lnInvoice !== null) ||
      (activePaymentMethod?.id === "lightningAddress" &&
        payment.lightningAddressLnInvoice !== null &&
        payment.lightningAddressLnInvoice !== undefined))
      ? paymentId
      : null

  const handleMarkCashPaid = async (receivedAmount: NonNegativeInteger) => {
    if (!canMarkCashPaid) return
    if (!(await require("confirm", "access.action.markCashPaid"))) return

    setCashPaymentErrorKey(null)
    setCashPaymentPending(true)
    // A refused confirmation shows inline; `runToast` only catches the
    // unexpected, which would otherwise surface nowhere.
    await runToast(async (run) => {
      const result = await run(
        markPaymentPaidCash({
          paymentId,
          accountId: cashRegisterAccountId,
          deviceId,
          receivedAmount,
        })
      )

      if (!result.ok) {
        console.error("Failed to mark cash payment paid", result.error)
        setCashPaymentErrorKey("paymentWait.cashPaid.error")
      }
    })
    setCashPaymentPending(false)
  }

  const handleMarkIbanPaid = async () => {
    if (!canMarkIbanPaid) return
    if (!(await require("confirm", "access.action.markIbanPaid"))) return

    setIbanPaymentErrorKey(null)
    setIbanPaymentPending(true)
    await runToast(async (run) => {
      const result = await run(
        markPaymentPaidIban({
          paymentId,
          accountId: ibanAccountId,
          deviceId,
        })
      )

      if (!result.ok) {
        console.error("Failed to mark bank transfer paid", result.error)
        setIbanPaymentErrorKey("paymentWait.ibanPaid.error")
      }
    })
    setIbanPaymentPending(false)
  }

  const handlePayCard = async () => {
    if (!canPayCard) return

    // The last attempt's outcome is unknown, so the card may already have
    // been charged: another attempt only after staff has checked SwitchioPay.
    const retryUnresolved =
      cardUnresolvedTransactionId !== null &&
      cardUnresolvedTransactionId !== undefined
    if (retryUnresolved) {
      const confirmed = await confirm({
        title: t("paymentWait.cardPaid.retryUnresolved.title"),
        description: t("paymentWait.cardPaid.retryUnresolved.description", {
          transactionId: cardUnresolvedTransactionId,
        }),
        confirmLabel: t("paymentWait.cardPaid.retryUnresolved.confirm"),
        cancelLabel: t("paymentWait.cardPaid.retryUnresolved.cancel"),
        variant: "destructive",
      })
      if (!confirmed) return
    }

    setCardPaymentErrorKey(null)
    setCardPaymentPending(true)
    await runToast(async (run) => {
      const result = await run(
        payPaymentWithSwitchioCard({
          paymentId,
          accountId: cardAccountId,
          deviceId,
          retryUnresolved,
        })
      )

      if (!result.ok) {
        console.error("Failed to take the card payment", result.error)
        setCardPaymentErrorKey(cardPaymentErrorKeys[result.error.type])
      }
    })
    setCardPaymentPending(false)
  }

  // A new quote for an expired one: the old topup stays pending in the
  // wallet until the mint confirms it unpaid, and still settles if paid.
  const handleNewCashuQuote = async () => {
    const cashuAccountId = payment.cashuAccountId
    if (cashuAccountId === null || cashuAccountId === undefined) return
    setNewCashuQuotePending(true)
    await cashuRunToast(async (run) => {
      const result = await run(
        prepareCashuPaymentMethod({ paymentId, accountId: cashuAccountId })
      )
      if (!result.ok) {
        console.error("Failed to prepare a new Cashu quote", result.error)
        return "paymentWait.prepareError"
      }
    })
    setNewCashuQuotePending(false)
  }

  const handleCancelPayment = async () => {
    if (!canCancelPayment) return
    if (!(await require("discard", "access.action.cancelPayment"))) return

    setCancelPending(true)
    await runToast(async (run) => {
      const result = await run(cancelPayment(paymentId))

      if (!result.ok) {
        console.error("Failed to cancel payment", result.error)
        return "paymentWait.cancelError"
      }

      // Only a bill payment has a cart to go back to. Sending a keypad
      // payment to `/bill` without a `billId` made the route's `beforeLoad`
      // mint a fresh `createRandomBillId()` and redirect, so cancelling a
      // plain amount payment dropped the user into a brand-new empty bill
      // editor instead of the keypad.
      await (payment.billId === null
        ? navigate({ to: "/" })
        : navigate({ to: "/bill", search: { billId: payment.billId } }))
    })
    setCancelPending(false)
  }

  if (closedOnOpen) return null

  return (
    <>
      <FadeHeader />

      <div className="flex min-h-full flex-col justify-between gap-8">
        <section className="flex flex-1 flex-col items-center justify-start gap-7 pt-10 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t("paymentWait.pay")}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {formatMoney(
                {
                  value: payment.amount,
                  currency: payment.currency,
                },
                locale
              )}
            </h1>
            <p className="text-md font-medium text-muted-foreground tabular-nums">
              {activeAmountSats === null
                ? "\u00A0"
                : `${formatMoney(
                    {
                      value: activeAmountSats,
                      currency: Currency.BTC,
                    },
                    locale
                  )}`}
            </p>
          </div>

          <div className="flex justify-center">
            {activePaymentMethod ? (
              <Tabs
                value={activePaymentMethod.id}
                onValueChange={(value) => {
                  if (isPaymentMethodTab(value)) setSelectedPaymentMethod(value)
                }}
                className="w-fit items-center gap-4"
              >
                {orderedPaymentMethods.map((method) => (
                  <TabsContent
                    key={method.id}
                    value={method.id}
                    className="sr-only"
                  >
                    {method.qrPayload === null
                      ? t("paymentWait.missingRequest")
                      : t("paymentWait.scanOrTap")}
                  </TabsContent>
                ))}
                {/* Same control as the home mode switch: `sliding-pill.tsx`. */}
                <LayoutGroup>
                  <TabsList
                    render={
                      <motion.div {...slidingPillLayout(pillTransition)} />
                    }
                    className="mx-auto h-16 gap-0.5 border border-black/15 bg-background p-2 text-muted-foreground dark:border-white/15"
                  >
                    {orderedPaymentMethods.map((method) => {
                      const active = method.id === activePaymentMethod.id
                      return (
                        <TabsTrigger
                          key={method.id}
                          value={method.id}
                          aria-label={method.label}
                          render={
                            <motion.button
                              {...slidingPillLayout(pillTransition)}
                            />
                          }
                          className="isolate h-full min-w-12 flex-none gap-0 border-0 text-muted-foreground transition-colors duration-300 data-active:bg-transparent data-active:text-background data-active:shadow-none dark:data-active:bg-transparent dark:data-active:text-background motion-reduce:transition-none px-6"
                        >
                          <SlidingPillSegmentContent
                            active={active}
                            pillId="payment-method-pill"
                            icon={method.icon}
                            label={method.label}
                          />
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </LayoutGroup>
              </Tabs>
            ) : (
              <p className="max-w-72 text-balance text-sm text-muted-foreground">
                {t("paymentWait.missingRequest")}
              </p>
            )}
          </div>

          {activePreparePaymentErrorKey ? (
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-72 text-balance text-sm font-medium text-destructive">
                {t(activePreparePaymentErrorKey)}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={activePreparationStatus?.status === "preparing"}
                aria-label={t("paymentWait.prepareRetry")}
                onClick={handleRetryPaymentMethodPreparation}
              >
                {t("paymentWait.prepareRetry")}
              </Button>
            </div>
          ) : null}

          {activePreparingPaymentMethodKey &&
          (isCashPaymentMethod || isCardPaymentMethod) ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="animate-spin" />
              <span>{t(activePreparingPaymentMethodKey)}</span>
            </div>
          ) : null}

          {activePaymentMethod ? (
            // A tab reads its own data only once opened, and its first read
            // suspends. This boundary keeps that to the tab, under a QR-sized
            // placeholder, instead of the route's, which would blank the whole
            // screen for a moment.
            <Suspense
              fallback={
                <QrPaymentRequest
                  qrPayload={null}
                  preparingMessageKey={
                    preparingPaymentMethodKeys[activePaymentMethod.id]
                  }
                />
              }
            >
              <PaymentMethodTabContent
                method={activePaymentMethod}
                boltCardPaymentId={boltCardPaymentId}
                amount={payment.amount}
                currency={payment.currency}
                canMarkCashPaid={canMarkCashPaid}
                cashPaymentErrorKey={cashPaymentErrorKey}
                cashPaymentPending={cashPaymentPending}
                cashRegisterAccountId={cashRegisterAccountId}
                canPayCard={canPayCard}
                cardPaymentErrorKey={cardPaymentErrorKey}
                cardPaymentPending={cardPaymentPending}
                cardAccountId={cardAccountId}
                cardUnresolvedTransactionId={
                  cardPaymentPending ? null : cardUnresolvedTransactionId
                }
                canMarkIbanPaid={canMarkIbanPaid}
                ibanPaymentErrorKey={ibanPaymentErrorKey}
                ibanPaymentPending={ibanPaymentPending}
                ibanVariableSymbol={payment.variableSymbol}
                preparingMessageKey={activePreparingPaymentMethodKey}
                selectedIbanQrFormat={selectedIbanQrFormat}
                onSelectIbanQrFormat={setSelectedIbanQrFormat}
                onMarkCashPaid={(receivedAmount) =>
                  void handleMarkCashPaid(receivedAmount)
                }
                onMarkIbanPaid={() => void handleMarkIbanPaid()}
                onPayCard={() => void handlePayCard()}
                qerkoPaymentId={paymentId}
                qerkoAccountId={payment.qerkoAccountId}
                qerkoPayable={paymentStatus === "pending"}
                qerkoPendingTransactionId={payment.qerkoPendingTransactionId}
                qerkoUnresolvedTransactionId={
                  payment.qerkoUnresolvedTransactionId
                }
                qerkoFailureReason={payment.qerkoFailureReason}
                paymentId={paymentId}
                paymentCreatedAt={payment.createdAt}
                payable={paymentStatus === "pending"}
                newCashuQuotePending={newCashuQuotePending}
                onNewCashuQuote={() => void handleNewCashuQuote()}
              />
            </Suspense>
          ) : null}

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-5 text-foreground">
              <p className="text-lg font-semibold tracking-tight">
                {isCashPaymentMethod
                  ? t("paymentWait.cashPaid.prompt")
                  : isCardPaymentMethod
                    ? t("paymentWait.cardPaid.prompt")
                    : t("paymentWait.scanOrTap")}
              </p>
            </div>
            {wakeLockEnabled && !wakeLockSupported ? (
              <p className="max-w-80 text-balance text-xs text-muted-foreground">
                {t("paymentWait.wakeLockUnsupported")}
              </p>
            ) : null}
            {canCancelPayment ? (
              <div className={"pt-2"}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={cancelPending}
                  onClick={() => void handleCancelPayment()}
                >
                  {cancelPending ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <XIcon />
                  )}
                  {t("paymentWait.cancel")}
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-background transition-opacity duration-300",
            successVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!successVisible}
          data-testid="payment-paid-panel"
        >
          <div className="flex flex-col items-center gap-4">
            <SuccessPanel
              title={t("paymentWait.paid")}
              description={
                isEetSandboxActive ? t("paymentWait.eetSandbox") : undefined
              }
              actions={
                <div className="flex flex-col items-center gap-8 pt-16 w-full">
                  <Button
                    size="lg"
                    nativeButton={false}
                    render={<Link to="/" />}
                    className={"h-16 w-80"}
                  >
                    {t("paymentWait.back")}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className={"h-12 w-80"}
                    nativeButton={false}
                    render={
                      <Link
                        to="/activity/$paymentId"
                        params={{ paymentId }}
                        aria-label={t("paymentWait.detail")}
                      />
                    }
                  >
                    {t("paymentWait.detail")}
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </>
  )
}
