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
import {
  buildCashuPaymentUri,
  defaultCashuPaymentRequestLegs,
} from "@payky/core/cashu/cashu-payment-request"
import {
  fetchNostrProfile,
  getNostrIdentity,
} from "@payky/core/integrations/nostr/nostr-client"
import {
  cashuAccountQuery,
  enabledPaymentMethodAccountsQuery,
} from "@payky/core/modules/account/account-queries"
import type {
  AccountId,
  BankQrFormat,
} from "@payky/core/modules/account/account-types"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import type { DefaultPaymentMethod } from "@payky/core/modules/app-settings/app-settings-types"
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
import { Integer } from "@payky/core/modules/shared/schema"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue } from "jotai"
import Banknote from "lucide-react-native/icons/banknote"
import Bitcoin from "lucide-react-native/icons/bitcoin"
import Check from "lucide-react-native/icons/check"
import CreditCard from "lucide-react-native/icons/credit-card"
import Landmark from "lucide-react-native/icons/landmark"
import Nfc from "lucide-react-native/icons/nfc"
import X from "lucide-react-native/icons/x"
import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { useSettleStoredSwitchioResult } from "../../components/app/switchio-restored-result.tsx"
import { CopyableQrCode } from "../../components/copyable-qr-code.tsx"
import { FadeHeader } from "../../components/fade-header.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import { Screen } from "../../components/screen.tsx"
import { SuccessPanel } from "../../components/success-panel.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { Input } from "../../components/ui/input.tsx"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.tsx"
import { nativeEnv } from "../../core/native-env.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun, useCashuAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useCashuRunToast, useRunToast } from "../../hooks/use-run-toast.ts"
import { useScreenVisit } from "../../hooks/use-screen-visit.ts"
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney, formatMoneyParts } from "../../lib/format-money.ts"
import { isSwitchioSupported } from "../../platform/switchio.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { satsAmountParts, useBitcoinUnit } from "../shared/bitcoin-amount.tsx"
import { useEetSettings } from "../shared/use-eet-settings.ts"
import { readCashReceived } from "./cash-received.ts"
import { BoltCardReader } from "./payment-wait-bolt-card.tsx"
import { CardPaymentTab } from "./payment-wait-card-tab.tsx"
import { CashuPaymentTab } from "./payment-wait-cashu-tab.tsx"
import { IbanPaymentTab } from "./payment-wait-iban-tab.tsx"
import { LightningAddressPaymentTab } from "./payment-wait-lightning-address-tab.tsx"
import { QerkoPaymentTab } from "./payment-wait-qerko-tab.tsx"

// Spark/Lightning (with a Bolt Card tap under the QR), cash, bank transfer,
// Cashu, the merchant's own Lightning address and the card terminals are
// offered here.

type MethodId =
  | "spark"
  | "cash"
  | "iban"
  | "cashu"
  | "card"
  | "qerko"
  | "lightningAddress"

// The three bitcoin wallets are one "Bitcoin" to the customer, as they are
// one method in Settings (settings/0002); at most one of them is offered.
const methodLabelKeys = {
  spark: "paymentWait.method.bitcoin",
  cash: "paymentWait.method.cash",
  iban: "paymentWait.method.iban",
  cashu: "paymentWait.method.bitcoin",
  card: "paymentWait.method.card",
  qerko: "paymentWait.method.qerko",
  lightningAddress: "paymentWait.method.bitcoin",
} satisfies Record<MethodId, TranslationKey>

const methodIcons = {
  spark: Bitcoin,
  cash: Banknote,
  iban: Landmark,
  cashu: Bitcoin,
  card: CreditCard,
  qerko: Nfc,
  lightningAddress: Bitcoin,
} as const satisfies Record<MethodId, unknown>

/**
 * What `preparePaymentMethod` is asked for each method a run of it prepares.
 * A lookup, so a new method cannot fall through to another's preparation.
 * Cashu prepares through its own Task.
 */
const preparationRequests = {
  spark: (accountId: AccountId) => ({ spark: { accountId } }),
  cash: (accountId: AccountId) => ({ cashRegister: { accountId } }),
  iban: (accountId: AccountId) => ({ bank: { accountId } }),
  card: (accountId: AccountId) => ({ card: { accountId } }),
  qerko: (accountId: AccountId) => ({ qerkoTerminal: { accountId } }),
  lightningAddress: (accountId: AccountId) => ({
    lightningAddress: { accountId },
  }),
} satisfies Record<Exclude<MethodId, "cashu">, (accountId: AccountId) => object>

/**
 * A card decline and an unreadable terminal result must never read the same:
 * after an unreadable result the card may well have been charged, so staff
 * has to check SwitchioPay instead of simply tapping again.
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

const goHome = () => router.dismissTo("/")

export function PaymentWaitPage() {
  const { t } = useTranslation()
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>()
  const parsed = PaymentId.safeParse(paymentId)
  if (!parsed.success)
    return <RouteMessage>{t("paymentWait.invalidId")}</RouteMessage>
  return <PaymentWaitRequest paymentId={parsed.data} />
}

function PaymentWaitRequest({ paymentId }: { readonly paymentId: PaymentId }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const appRun = useAppRun()
  const cashuAppRun = useCashuAppRun()
  const runToast = useRunToast()
  const confirm = useConfirm()
  const settleStoredSwitchioResult = useSettleStoredSwitchioResult()
  const cashuRunToast = useCashuRunToast()
  const { require } = useRequirePermission()
  const deviceId = useAtomValue(accountAtom).device.id
  usePreloadEvoluQueries(
    useMemo(
      () => [
        paymentRequestQuery(paymentId),
        paymentClaimsQuery(paymentId),
        enabledPaymentMethodAccountsQuery,
        cashuAccountQuery,
        settingsQuery,
      ],
      [paymentId]
    )
  )
  const [payment] = useEvoluQuery(paymentRequestQuery(paymentId)).data
  const claims = useEvoluQuery(paymentClaimsQuery(paymentId)).data
  const accounts = useEvoluQuery(enabledPaymentMethodAccountsQuery).data
  const [cashuAccountRow] = useEvoluQuery(cashuAccountQuery).data
  const [settings] = useEvoluQuery(settingsQuery).data
  const masterKey = useAtomValue(accountAtom).masterKey
  // A secp256k1 derivation in JS: once per account, not on every render.
  const nostrPubkey = useMemo(
    () => getNostrIdentity(masterKey).pubkey,
    [masterKey]
  )
  const [edited, setEdited] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [ibanErrorKey, setIbanErrorKey] = useState<TranslationKey | null>(null)
  const [markPending, setMarkPending] = useState(false)
  const [ibanPending, setIbanPending] = useState(false)
  const [cancelPending, setCancelPending] = useState(false)
  const [newQuotePending, setNewQuotePending] = useState(false)
  const [cardPending, setCardPending] = useState(false)
  const [cardErrorKey, setCardErrorKey] = useState<TranslationKey | null>(null)
  const [selected, setSelected] = useState<MethodId | null>(null)
  const [selectedQrFormat, setSelectedQrFormat] = useState<BankQrFormat | null>(
    null
  )
  // The profile name is the recipient the bank QR names (payment/0005). It
  // comes from relays, so the QR shows at once and takes the name when it
  // lands rather than waiting on a relay that may be slow or down.
  const [profileName, setProfileName] = useState<string | null>(null)
  // Refs close the window before the pending state re-renders, so repeated
  // taps neither stack PIN prompts nor settle or cancel twice.
  const busyRef = useRef(false)
  const [preparation, setPreparation] = useState<PaymentMethodPreparationState>(
    {}
  )
  const [runner] = useState(createPaymentMethodPreparationRunner)

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        await using run = appRun()
        const result = await run(fetchNostrProfile({ pubkey: nostrPubkey }))
        if (!ignore && result.ok) setProfileName(result.value.name ?? null)
      } catch (error) {
        nativeConsole.error("Failed to read the profile name", error)
      }
    })()
    return () => {
      ignore = true
    }
  }, [appRun, nostrPubkey])

  // The enabled accounts in the payment's currency, like web's tab list, in
  // the merchant's method order.
  const sparkAccount = accounts.find(
    (account) => account.kind === "spark" && account.sparkSecret !== null
  )
  const cashAccount = accounts.find(
    (account) =>
      account.kind === "cashRegister" &&
      account.cashRegisterCurrency === payment?.currency
  )
  const ibanAccount = accounts.find(
    (account) =>
      account.kind === "iban" &&
      account.iban !== null &&
      account.ibanCurrency === payment?.currency
  )
  // A Cashu account is not tied to a currency: the quote is for the sats.
  const cashuAccount = accounts.find((account) => account.kind === "cashu")
  // The terminal is driven through Android intents: offered only where the
  // module is linked, since a tab whose button can never work is worse.
  const cardAccount = isSwitchioSupported()
    ? accounts.find(
        (account) =>
          account.kind === "cardSwitchio" &&
          account.cardCurrency === payment?.currency
      )
    : undefined
  // Qerko is plain HTTP with CORS open, so unlike the Switchio terminal it
  // needs no module and is offered everywhere.
  const qerkoAccount = accounts.find(
    (account) =>
      account.kind === "qerkoTerminal" &&
      account.qerkoTerminalCurrency === payment?.currency
  )
  const lightningAddressAccount = accounts.find(
    (account) =>
      account.kind === "lightningAddress" && account.lightningAddress !== null
  )
  const methods = useMemo(() => {
    const order = getPaymentMethodOrder(settings)
    const found: { id: MethodId; accountId: AccountId }[] = []
    if (sparkAccount !== undefined)
      found.push({ id: "spark", accountId: sparkAccount.id })
    if (cashAccount !== undefined)
      found.push({ id: "cash", accountId: cashAccount.id })
    if (ibanAccount !== undefined)
      found.push({ id: "iban", accountId: ibanAccount.id })
    if (cardAccount !== undefined)
      found.push({ id: "card", accountId: cardAccount.id })
    if (qerkoAccount !== undefined)
      found.push({ id: "qerko", accountId: qerkoAccount.id })
    if (cashuAccount !== undefined)
      found.push({ id: "cashu", accountId: cashuAccount.id })
    if (lightningAddressAccount !== undefined)
      found.push({
        id: "lightningAddress",
        accountId: lightningAddressAccount.id,
      })
    const kindOf = {
      spark: "spark",
      cash: "cashRegister",
      iban: "iban",
      cashu: "cashu",
      card: "cardSwitchio",
      qerko: "qerkoTerminal",
      lightningAddress: "lightningAddress",
    } as const satisfies Record<MethodId, DefaultPaymentMethod>
    return found.toSorted(
      (a, b) => order.indexOf(kindOf[a.id]) - order.indexOf(kindOf[b.id])
    )
  }, [
    settings,
    sparkAccount,
    cashAccount,
    ibanAccount,
    cashuAccount,
    cardAccount,
    qerkoAccount,
    lightningAddressAccount,
  ])
  const active = methods.find(({ id }) => id === selected) ?? methods[0]
  const preparationKey =
    active === undefined
      ? null
      : `${paymentId}:${active.id}:${active.accountId}`
  const sparkInvoice = payment?.lnInvoice ?? payment?.sparkInvoice ?? null
  const isSet = (value: unknown) => value !== null && value !== undefined
  const preparedBy = {
    spark: sparkInvoice !== null,
    cash: isSet(payment?.cashRegisterAccountId),
    iban: isSet(payment?.ibanAccountId),
    card: isSet(payment?.cardAccountId),
    qerko: isSet(payment?.qerkoAccountId),
    cashu: isSet(payment?.cashuLnInvoice),
    lightningAddress: isSet(payment?.lightningAddressLnInvoice),
  } satisfies Record<MethodId, boolean>
  const prepared = active !== undefined && preparedBy[active.id]
  const preparationStatus =
    preparationKey === null ? undefined : preparation[preparationKey]
  // Spark invoices carry an `expiresAt` and nothing writes a row when it
  // passes, so the clock ticks to flip the derived status.
  const now = useNow([
    payment?.expiresAt ?? null,
    payment?.cashuQuoteExpiresAt ?? null,
  ])
  const status =
    payment === undefined
      ? null
      : derivePaymentStatus({
          canceledAt: payment.canceledAt,
          confirmedPaidAt: payment.confirmedPaidAt,
          expiresAt: payment.expiresAt,
          hasActiveClaim: claims.length > 0,
          now,
        })
  useScreenWakeLock(status === "pending")
  // The payment screen serves only an open payment (access/0008): opened on a
  // paid or canceled one (a typed link, Back) it hands it to its activity
  // detail. Decided once per arrival — this payment, this visit of the
  // screen — so a payment paid while open still shows Paid.
  const visit = useScreenVisit()
  const bitcoinUnit = useBitcoinUnit()
  const closedOnOpen = useRedirectIfClosedOnOpen(
    `${paymentId}@${visit}`,
    status === "paid" || status === "canceled",
    () =>
      router.replace({
        pathname: "/activity/[paymentId]",
        params: { paymentId },
      })
  )

  const ibanNumber = ibanAccount?.iban ?? null
  const ibanName = ibanAccount?.name ?? null
  // Rebuilt only when what they encode changes, not on every tab switch.
  const hasPayment = payment !== undefined
  const ibanAccountIdOfPayment = payment?.ibanAccountId
  const paymentAmount = payment?.amount
  const paymentCurrency = payment?.currency
  const specificSymbol = payment?.specificSymbol ?? null
  const variableSymbol = payment?.variableSymbol ?? null
  const bankQrPayloads: ReadonlyArray<BankQrPayload> = useMemo(
    () =>
      hasPayment &&
      ibanAccountIdOfPayment !== null &&
      paymentAmount !== undefined &&
      paymentCurrency !== undefined &&
      ibanNumber !== null &&
      ibanName !== null
        ? createBankQrPayloads({
            profileName,
            bankAccountName: ibanName,
            iban: ibanNumber,
            amount: paymentAmount,
            currency: paymentCurrency,
            specificSymbol,
            variableSymbol,
          })
        : [],
    [
      hasPayment,
      ibanAccountIdOfPayment,
      paymentAmount,
      paymentCurrency,
      ibanNumber,
      ibanName,
      profileName,
      specificSymbol,
      variableSymbol,
    ]
  )
  const cashuLnInvoice = payment?.cashuLnInvoice ?? null
  const cashuMintUrl = payment?.cashuMintUrl ?? null
  const cashuAmountSats = payment?.cashuAmountSats ?? 0
  // Both legs unless the Cashu account narrows the QR to one (settings/0003).
  const cashuLegs =
    cashuAccountRow?.paymentRequestLegs ?? defaultCashuPaymentRequestLegs
  const cashuQrPayload = useMemo(
    () =>
      cashuLnInvoice === null || cashuMintUrl === null
        ? null
        : buildCashuPaymentUri({
            paymentId,
            lnInvoice: cashuLnInvoice,
            amountSats: cashuAmountSats,
            mintUrl: cashuMintUrl,
            nostrPubkey,
            relays: nativeEnv.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS,
            legs: cashuLegs,
          }),
    [
      paymentId,
      cashuLnInvoice,
      cashuAmountSats,
      cashuMintUrl,
      nostrPubkey,
      cashuLegs,
    ]
  )
  const defaultQrFormat = ibanAccount?.ibanDefaultQrFormat ?? "spayd"
  const activeQrFormat = selectedQrFormat ?? defaultQrFormat
  const bankQrPayload =
    (
      bankQrPayloads.find(({ format }) => format === activeQrFormat) ??
      bankQrPayloads.find(({ format }) => format === defaultQrFormat) ??
      bankQrPayloads[0]
    )?.payload ?? null

  // Attaches the method's account to the payment once; the runner dedups an
  // in-flight attempt, the state a finished or failed one.
  const prepare = (
    method: { id: MethodId; accountId: AccountId },
    key: string
  ) =>
    runner.run(key, async () => {
      try {
        // Only a Cashu preparation reads the Cashu wallet, and only now: no
        // other method waits on it, or fails with it.
        const attach = async () => {
          if (method.id === "cashu") {
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
              ...preparationRequests[method.id](method.accountId),
            })
          )
        }
        const result = await attach()
        if (!result.ok) {
          nativeConsole.error("Failed to prepare payment method", result.error)
          setPreparation((state) =>
            failPaymentMethodPreparation(state, key, result.error)
          )
        }
      } catch (error) {
        nativeConsole.error("Failed to prepare payment method", error)
        setPreparation((state) =>
          failPaymentMethodPreparation(state, key, error)
        )
      }
    })

  // `prepare` closes over stable inputs; the preparation state guards re-entry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (status !== "pending" || active === undefined || preparationKey === null)
      return
    if (prepared) {
      setPreparation((state) =>
        clearPaymentMethodPreparation(state, preparationKey)
      )
      return
    }
    const transition = requestPaymentMethodPreparation(
      preparation,
      preparationKey
    )
    if (!transition.shouldPrepare) return
    setPreparation(transition.state)
    void prepare(active, preparationKey)
  }, [status, active, preparationKey, prepared, preparation])

  if (closedOnOpen)
    return (
      <YStack flex={1} items="center" justify="center">
        <ActivityIndicator size="large" />
      </YStack>
    )
  if (payment === undefined || status === null)
    return <RouteMessage>{t("paymentWait.notFound")}</RouteMessage>
  if (status === "canceled")
    return <RouteMessage>{t("paymentWait.canceled")}</RouteMessage>
  if (status === "paid") return <Paid paymentId={paymentId} />

  const cashRegisterAccountId = payment.cashRegisterAccountId
  const { text, leastReceived, receivedAmount } = readCashReceived({
    amount: payment.amount,
    currency: payment.currency,
    edited,
  })
  const formatMinor = (value: number) =>
    formatMoney({ value: Integer(value), currency: payment.currency }, locale)
  const canMarkCashPaid =
    cashRegisterAccountId !== null && cashRegisterAccountId !== undefined
  const cashuQuoteExpiresAt = payment.cashuQuoteExpiresAt ?? null
  const ibanAccountId = payment.ibanAccountId
  const canMarkIbanPaid = ibanAccountId !== null && ibanAccountId !== undefined
  const preparing =
    active !== undefined && !prepared && preparationStatus?.status !== "failed"

  const markPaid = async () => {
    if (busyRef.current || receivedAmount === null) return
    if (cashRegisterAccountId === null || cashRegisterAccountId === undefined)
      return
    busyRef.current = true
    try {
      if (!(await require("confirm", "access.action.markCashPaid"))) return
      setErrorKey(null)
      setMarkPending(true)
      // A refused settle shows inline; `runToast` only catches the unexpected.
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
          nativeConsole.error("Failed to mark cash payment paid", result.error)
          setErrorKey("paymentWait.cashPaid.error")
        }
      })
    } finally {
      setMarkPending(false)
      busyRef.current = false
    }
  }

  const cardAccountId = payment.cardAccountId
  const cardUnresolvedTransactionId =
    payment.cardUnresolvedTransactionId ?? null
  const canPayCard =
    active?.id === "card" &&
    cardAccountId !== null &&
    cardAccountId !== undefined &&
    status === "pending"

  const payCard = async () => {
    if (!canPayCard || busyRef.current) return
    busyRef.current = true
    try {
      // The last attempt's outcome is unknown, so the card may already have
      // been charged: another attempt only after staff has checked SwitchioPay.
      const retryUnresolved = cardUnresolvedTransactionId !== null
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

      setCardErrorKey(null)
      setCardPending(true)
      // An earlier attempt's result nobody has settled would be refused (and
      // could be overwritten): settle it first.
      await settleStoredSwitchioResult()
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
          nativeConsole.error("Failed to take the card payment", result.error)
          setCardErrorKey(cardPaymentErrorKeys[result.error.type])
        }
        return undefined
      })
    } finally {
      setCardPending(false)
      busyRef.current = false
    }
  }

  const markIbanPaid = async () => {
    if (busyRef.current) return
    if (ibanAccountId === null || ibanAccountId === undefined) return
    busyRef.current = true
    try {
      if (!(await require("confirm", "access.action.markIbanPaid"))) return
      setIbanErrorKey(null)
      setIbanPending(true)
      await runToast(async (run) => {
        const result = await run(
          markPaymentPaidIban({ paymentId, accountId: ibanAccountId, deviceId })
        )
        if (!result.ok) {
          nativeConsole.error("Failed to mark bank transfer paid", result.error)
          setIbanErrorKey("paymentWait.ibanPaid.error")
        }
      })
    } finally {
      setIbanPending(false)
      busyRef.current = false
    }
  }

  const cancel = async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      if (!(await require("discard", "access.action.cancelPayment"))) return
      setCancelPending(true)
      await runToast(async (run) => {
        const result = await run(cancelPayment(paymentId))
        if (!result.ok) {
          nativeConsole.error("Failed to cancel payment", result.error)
          return "paymentWait.cancelError"
        }
        // Only a bill payment has a cart to go back to; a keypad payment
        // sent to `/bill` without an id would open a brand-new empty bill.
        if (payment.billId === null) goHome()
        else
          router.dismissTo({
            pathname: "/bill",
            params: { billId: payment.billId },
          })
      })
    } finally {
      setCancelPending(false)
      busyRef.current = false
    }
  }

  // A new quote for an expired one: the old topup stays pending in the
  // wallet until the mint confirms it unpaid, and still settles if paid.
  const requestNewQuote = async () => {
    if (cashuAccount === undefined || busyRef.current) return
    busyRef.current = true
    setNewQuotePending(true)
    try {
      await cashuRunToast(async (run) => {
        const result = await run(
          prepareCashuPaymentMethod({
            paymentId,
            accountId: cashuAccount.id,
          })
        )
        if (!result.ok) {
          nativeConsole.error(
            "Failed to prepare a new Cashu quote",
            result.error
          )
          return "paymentWait.prepareError"
        }
      })
    } finally {
      setNewQuotePending(false)
      busyRef.current = false
    }
  }

  const retryPreparation = () => {
    if (active === undefined || preparationKey === null || prepared) return
    const transition = retryPaymentMethodPreparation(
      preparation,
      preparationKey
    )
    if (!transition.shouldPrepare) return
    setPreparation(transition.state)
    void prepare(active, preparationKey)
  }

  const sats =
    active?.id === "spark"
      ? payment.amountSats
      : active?.id === "cashu"
        ? (payment.cashuAmountSats ?? null)
        : active?.id === "lightningAddress"
          ? (payment.lightningAddressAmountSats ?? null)
          : null
  // The payment's own amount is exact, so no "~" as an estimate carries.
  const amountParts =
    sats !== null && bitcoinUnit.unit === "sats"
      ? satsAmountParts(sats, locale, t)
      : formatMoneyParts(
          { value: payment.amount, currency: payment.currency },
          locale
        )

  return (
    <Screen>
      <FadeHeader />
      <YStack items="center" gap={28}>
        <YStack items="center" gap={8}>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="muted-foreground"
          >
            {t("paymentWait.pay")}
          </Text>
          {/* One unit at a time: the shop's money, and for a bitcoin method
              sats once the amount is tapped (`bitcoinUnitAtom`). */}
          <AmountFigure
            number={amountParts.number}
            unit={amountParts.unit}
            unitFirst={amountParts.unitFirst}
            label={amountParts.text}
            onPress={sats === null ? undefined : bitcoinUnit.toggle}
            pressLabel={sats === null ? undefined : bitcoinUnit.switchLabel}
            testID="payment-amount"
          />
        </YStack>

        {active === undefined ? (
          <Text
            maxW={288}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
            text="center"
          >
            {t("paymentWait.missingRequest")}
          </Text>
        ) : (
          <Tabs value={active.id} onValueChange={setSelected}>
            {/* The method tabs as Activity's: the active one an accent pill
                with its icon and name, the others their icon alone. */}
            <TabsList h={46} p={4} gap={2} self="center">
              {methods.map(({ id }) => {
                const isActive = id === active.id
                return (
                  <TabsTrigger
                    key={id}
                    value={id}
                    aria-label={t(methodLabelKeys[id])}
                    grow={0}
                    shrink={0}
                    flexBasis="auto"
                    minW={48}
                    px={isActive ? 16 : 12}
                  >
                    <Icon
                      icon={methodIcons[id]}
                      color={
                        isActive ? "primary-foreground" : "muted-foreground"
                      }
                    />
                    {isActive ? (
                      <Text
                        color="primary-foreground"
                        fontSize={fontSize.sm}
                        lineHeight={fontSize.sm}
                        fontWeight={fontWeight.medium}
                      >
                        {t(methodLabelKeys[id])}
                      </Text>
                    ) : null}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        )}

        {active !== undefined && preparationStatus?.status === "failed" ? (
          <YStack gap={12} items="center">
            <Text
              maxW={288}
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              color="destructive"
              text="center"
            >
              {t("paymentWait.prepareError")}
            </Text>
            <Button
              variant="outline"
              label={t("paymentWait.prepareRetry")}
              onPress={retryPreparation}
            />
          </YStack>
        ) : active === undefined ? null : active.id === "spark" ? (
          <YStack gap={12} items="center" w="100%">
            {sparkInvoice !== null ? (
              <CopyableQrCode value={sparkInvoice} />
            ) : (
              <XStack items="center" gap={8}>
                <ActivityIndicator />
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                >
                  {t("paymentWait.preparing.spark")}
                </Text>
              </XStack>
            )}
            {status === "expired" ? (
              <Text color="muted-foreground">
                {t("payment.status.expired")}
              </Text>
            ) : null}
            {/* A Bolt Card pays a Lightning invoice, not a Spark one. */}
            {status === "pending" && payment.lnInvoice !== null ? (
              <BoltCardReader paymentId={paymentId} />
            ) : null}
          </YStack>
        ) : active.id === "lightningAddress" ? (
          <LightningAddressPaymentTab
            paymentId={paymentId}
            invoice={payment.lightningAddressLnInvoice ?? null}
            payable={status === "pending"}
            expired={status === "expired"}
          />
        ) : active.id === "cashu" ? (
          <YStack gap={12} items="center" w="100%">
            <CashuPaymentTab
              paymentId={paymentId}
              qrPayload={cashuQrPayload}
              quoteExpired={
                cashuQuoteExpiresAt !== null &&
                now.getTime() >= cashuQuoteExpiresAt
              }
              newQuotePending={newQuotePending}
              onNewQuote={() => void requestNewQuote()}
            />
          </YStack>
        ) : active.id === "iban" && ibanNumber !== null ? (
          <IbanPaymentTab
            paymentId={paymentId}
            accountId={active.accountId}
            createdAt={payment.createdAt}
            payable={status === "pending"}
            qrPayload={bankQrPayload}
            qrPayloads={bankQrPayloads}
            activeFormat={activeQrFormat}
            onSelectFormat={setSelectedQrFormat}
            iban={ibanNumber}
            variableSymbol={payment.variableSymbol}
            preparing={preparing}
            canMarkPaid={canMarkIbanPaid}
            pending={ibanPending}
            errorKey={ibanErrorKey}
            onMarkPaid={() => void markIbanPaid()}
          />
        ) : active.id === "qerko" ? (
          <QerkoPaymentTab
            paymentId={paymentId}
            accountId={payment.qerkoAccountId}
            payable={status === "pending"}
            pendingTransactionId={payment.qerkoPendingTransactionId}
            unresolvedTransactionId={payment.qerkoUnresolvedTransactionId}
            failureReason={payment.qerkoFailureReason}
          />
        ) : active.id === "card" ? (
          <CardPaymentTab
            canPayCard={canPayCard}
            pending={cardPending}
            errorKey={cardErrorKey}
            hasAccount={cardAccountId !== null && cardAccountId !== undefined}
            unresolvedTransactionId={cardUnresolvedTransactionId}
            onPayCard={() => void payCard()}
          />
        ) : (
          <YStack w="100%" items="center" gap={12} py={16}>
            {preparing ? (
              <XStack items="center" gap={8}>
                <ActivityIndicator />
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                >
                  {t("paymentWait.preparing.cash")}
                </Text>
              </XStack>
            ) : null}
            <Field w="100%" maxW={288}>
              <FieldLabel>{t("paymentWait.cashPaid.received")}</FieldLabel>
              <Input
                h={48}
                text="center"
                fontSize={fontSize.lg}
                lineHeight={fontSize.lg}
                fontWeight={fontWeight.semibold}
                value={text}
                keyboardType="decimal-pad"
                autoComplete="off"
                disabled={markPending}
                invalid={receivedAmount === null}
                onChangeText={setEdited}
              />
              {receivedAmount === null ? (
                <FieldError>
                  {t("paymentWait.cashPaid.receivedTooLow", {
                    amount: formatMinor(leastReceived),
                  })}
                </FieldError>
              ) : receivedAmount === payment.amount ? null : (
                <FieldDescription>
                  {t("paymentWait.cashPaid.difference", {
                    amount: formatMinor(receivedAmount - payment.amount),
                  })}
                </FieldDescription>
              )}
            </Field>
            <Button
              size="lg"
              h={56}
              px={32}
              iconStart={Check}
              label={
                markPending
                  ? t("paymentWait.cashPaid.pending")
                  : t("paymentWait.cashPaid.action")
              }
              pending={markPending}
              disabled={!canMarkCashPaid || receivedAmount === null}
              onPress={() => void markPaid()}
            />
            {errorKey === null ? null : (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                color="destructive"
                role="alert"
              >
                {t(errorKey)}
              </Text>
            )}
            {canMarkCashPaid ? null : (
              <Text
                maxW={288}
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
                text="center"
              >
                {t("paymentWait.cashPaid.unavailable")}
              </Text>
            )}
          </YStack>
        )}

        <YStack items="center" gap={16}>
          <Text
            fontSize={fontSize.lg}
            lineHeight={fontSize.lg}
            fontWeight={fontWeight.semibold}
            text="center"
          >
            {t(
              active?.id === "cash"
                ? "paymentWait.cashPaid.prompt"
                : active?.id === "card" || active?.id === "qerko"
                  ? "paymentWait.cardPaid.prompt"
                  : "paymentWait.scanOrTap"
            )}
          </Text>
          <YStack pt={8}>
            <Button
              size="lg"
              variant="outline"
              iconStart={X}
              label={t("paymentWait.cancel")}
              pending={cancelPending}
              disabled={markPending || ibanPending || cardPending}
              onPress={() => void cancel()}
            />
          </YStack>
        </YStack>
      </YStack>
    </Screen>
  )
}

/** Shown from the derived status alone, so a reopened paid payment shows it too. */
function Paid({ paymentId }: { readonly paymentId: PaymentId }) {
  const { t } = useTranslation()
  const { isSandboxActive: isEetSandboxActive } = useEetSettings()
  return (
    <Screen>
      <YStack
        flex={1}
        items="center"
        justify="center"
        testID="payment-paid-panel"
      >
        <SuccessPanel
          title={t("paymentWait.paid")}
          description={
            isEetSandboxActive ? t("paymentWait.eetSandbox") : undefined
          }
          actions={
            <YStack items="center" gap={32} pt={64} w={320} maxW="100%">
              <Button
                size="lg"
                h={64}
                w="100%"
                label={t("paymentWait.back")}
                onPress={goHome}
              />
              <Button
                size="lg"
                variant="outline"
                h={48}
                w="100%"
                label={t("paymentWait.detail")}
                onPress={() =>
                  router.push({
                    pathname: "/activity/[paymentId]",
                    params: { paymentId },
                  })
                }
              />
            </YStack>
          }
        />
      </YStack>
    </Screen>
  )
}
