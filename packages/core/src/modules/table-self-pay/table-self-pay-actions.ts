import {
  createIdFromString,
  err,
  type MutationOptions,
  ok,
  type Result,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js"
import { subDays } from "date-fns"
import { z } from "zod"

import type {
  DateDep,
  DeviceIdDep,
  EvoluOwnerDep,
  SelfPayDefaultRelaysDep,
  TableSelfPayRootDep,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { NostrRelayDep } from "../../integrations/nostr/nostr-relay-client.ts"
import type {
  SparkPaymentWallet,
  SparkWalletDep,
} from "../../spark/spark-wallet.ts"
import { jsonCodec } from "../../zod-utils.ts"
import {
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import type {
  AccountTransactionId,
  AccountTransactionKind,
} from "../account-transaction/account-transaction-types.ts"
import { selfPaySettingsQuery } from "../app-settings/app-settings-queries.ts"
import { offersOrders } from "../app-settings/app-settings-utils.ts"
import type { BillRow } from "../bill/bill.ts"
import { claimedTransactionsByBillIdQuery } from "../bill/bill-coverage-queries.ts"
import { billByIdQuery } from "../bill/bill-queries.ts"
import type { BillId } from "../bill/bill-types.ts"
import { calculateClaimedSum } from "../bill/bill-utils.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import { deriveBillSummaryTotal } from "../bill-line/bill-line-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import { activeFioPluginsQuery } from "../fio-plugin/fio-plugin-queries.ts"
import {
  deriveMenuOrderBillId,
  loadMenuOrderArrivalRows,
  loadSelfPayMenuVersion,
  type MenuOrderArrivalRows,
  raiseWrittenOrderLine,
  type WrittenOrderRest,
} from "../menu-order/menu-order-actions.ts"
import { menuOrderByBillIdQuery } from "../menu-order/menu-order-queries.ts"
import {
  type SelfPayOrderIntent,
  SelfPayOrderIntentSchema,
} from "../menu-order/menu-order-utils.ts"
import { activeMonetaPluginsQuery } from "../moneta-plugin/moneta-plugin-queries.ts"
import type { SelfPayPaymentRows } from "../payment/payment-row-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  deriveSelfPayMenuKeys,
  deriveSelfPayRateKey,
  deriveSelfPaySelectionKey,
} from "../shared/key-derivation.ts"
import { parseLightningInvoice } from "../shared/lightning-invoice-utils.ts"
import { currencyFractionDigits } from "../shared/money.ts"
import {
  type Currency,
  type FiatCurrency,
  type NonEmptyString,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMs,
  VariableSymbol,
  type WssUrl,
} from "../shared/schema.ts"
import type { TableId } from "../table/table-types.ts"
import {
  createSelfPaySelectionFilter,
  deriveSelfPayShareBillVersion,
  openSelfPaySelection,
  type SelfPayShareSelection,
  SelfPayShareSelectionSchema,
} from "./table-self-pay-pointer-utils.ts"
import {
  deriveSelfPayLineKey,
  findOfferedSelfPayReferences,
  projectSelfPayViewBill,
  projectTableSelfPayView,
  type SelfPayInstructions,
  selfPayConfirmationsEndedAfter,
} from "./table-self-pay-projection-utils.ts"
import {
  billIdsBySelfPayReferenceQuery,
  expiredSelfPayViewVersionsQuery,
  openBillIdsQuery,
  type SelfPayTableRow,
  selfPayRelaysQuery,
  selfPayViewPublicationByIdQuery,
  selfPayViewVersionsByBillIdQuery,
  tableSelfPayBillsQuery,
  tableSelfPayConfirmationsQuery,
  tableSelfPayVersionQuery,
  tableSelfPayViewVersionIdsQuery,
} from "./table-self-pay-queries.ts"
import {
  selfPayCreditForSats,
  selfPayExchangeRate,
  selfPayRatePayableUntil,
  selfPayRateValidUntil,
  verifySelfPayRate,
} from "./table-self-pay-rate-utils.ts"
import {
  pickSelfPayAccounts,
  SelfPayPublishResultJson,
} from "./table-self-pay-reach-utils.ts"
import {
  deriveOrderSelfPayReference,
  isOrderSelfPayReference,
  parseSelfPayBankMessage,
  parseSelfPayLightningMemo,
  type SelfPayPointer,
  type SelfPayReference,
  SelfPayReferenceSchema,
} from "./table-self-pay-reference-utils.ts"
import {
  activeSelfPayRelays,
  listSelfPayRelays,
} from "./table-self-pay-relay-utils.ts"
import {
  calculateSelfPayShare,
  meetsSelfPayMinimum,
  type SelfPayShare,
  type SelfPayShareBill,
} from "./table-self-pay-share-utils.ts"
import type { SelfPayAllocationId } from "./table-self-pay-types.ts"
import {
  createDisabledSelfPayView,
  SelfPayShareBillSchema,
  type SelfPayView,
} from "./table-self-pay-view-utils.ts"

const ENDED_BILL_RETENTION_DAYS = 7
const SELECTION_LOOKUP_GRACE_MS = 10 * 60 * 1000

const SelfPayShareBillJson = jsonCodec(SelfPayShareBillSchema)

export interface SelfPayTransaction {
  readonly id: AccountTransactionId
  readonly kind: AccountTransactionKind
  readonly accountId: AccountId
  readonly amount: number
  readonly currency: Currency
  readonly occurredAt: TimestampMs
  readonly variableSymbol: string | null
  readonly recipientMessage: NonEmptyString | null
  readonly lnInvoice: NonEmptyString | null
  readonly paymentHash: NonEmptyString | null
  readonly firstSeenAt: TimestampMs
}

type SelfPayBill = BillRow & {
  readonly deviceId: NonNullable<BillRow["deviceId"]>
  readonly currency: FiatCurrency
}

const loadSelfPayBill =
  (
    reference: SelfPayReference,
    arrivedAt: TimestampMs,
    orderBillId: BillId | null = null
  ): Task<SelfPayBill | null, never, EvoluDep> =>
  async (run) => {
    const matches = (
      await run.deps.evolu.loadQuery(
        billIdsBySelfPayReferenceQuery(
          reference,
          TimestampMs(subDays(arrivedAt, ENDED_BILL_RETENTION_DAYS).getTime())
        )
      )
    ).filter(({ id }) => orderBillId === null || id === orderBillId)
    const [match] = matches
    if (match === undefined || matches.length > 1) return ok(null)

    const [bill] = await run.deps.evolu.loadQuery(billByIdQuery(match.id))
    if (bill?.deviceId === null || bill?.deviceId === undefined) return ok(null)
    return ok({ ...bill, deviceId: bill.deviceId })
  }

export interface SelfPayAllocationWrite {
  readonly id: SelfPayAllocationId
  readonly paymentId: PaymentId
  readonly billId: BillId
  readonly lineKey: NonEmptyString255
  readonly amount: PositiveInteger
}

interface SelfPayArrival {
  readonly rows: SelfPayPaymentRows
  readonly allocations: ReadonlyArray<SelfPayAllocationWrite>
  readonly order: MenuOrderArrivalRows | null
  readonly writtenOrderRest: WrittenOrderRest | null
}

interface SelfPaySelectionAllocation {
  readonly tipAmount: number
  readonly lines: SelfPayShare["lines"]
}

const loadSelfPayShareCandidates =
  (
    bill: SelfPayBill,
    reference: SelfPayReference
  ): Task<ReadonlyArray<SelfPayShareBill>, never, EvoluDep> =>
  async (run) => {
    const stored = await run.ok(loadSelfPayViewVersions(bill.id))
    if (bill.tableId === null) return ok(stored)
    const rows = await run.deps.evolu.loadQuery(
      tableSelfPayBillsQuery(bill.tableId)
    )
    const current = rows.find(({ id }) => id === bill.id)
    return ok(
      current === undefined
        ? stored
        : [...stored, projectSelfPayViewBill(current, reference)]
    )
  }

type SelfPayLookupDeps = EvoluDep &
  Partial<
    NostrRelayDep & SelfPayDefaultRelaysDep & TableSelfPayRootDep & DeviceIdDep
  >

export type SelfPayArrivalDeps = SelfPayLookupDeps & DateDep

export const lookUpSelfPaySelection =
  <T>(
    pointer: SelfPayPointer,
    schema: z.ZodType<T>
  ): Task<T | null, never, SelfPayLookupDeps> =>
  async (run) => {
    const { nostrRelayClient, selfPayDefaultRelays, tableSelfPayRoot } =
      run.deps
    if (
      nostrRelayClient === undefined ||
      selfPayDefaultRelays === undefined ||
      tableSelfPayRoot === undefined
    ) {
      return ok(null)
    }
    const rows = await run.deps.evolu.loadQuery(selfPayRelaysQuery)
    const relays = [
      ...new Set([
        ...activeSelfPayRelays(listSelfPayRelays(selfPayDefaultRelays, rows)),
        ...selfPayDefaultRelays,
      ]),
    ]
    const selectionKey = deriveSelfPaySelectionKey(tableSelfPayRoot)
    const events = await nostrRelayClient.query(
      relays,
      createSelfPaySelectionFilter(pointer, selectionKey)
    )
    return ok(openSelfPaySelection({ events, pointer, selectionKey, schema }))
  }

type SelfPaySelectionLookup =
  | {
      readonly type: "resolved"
      readonly selection: SelfPayShareSelection | null
    }
  | { readonly type: "waiting" }

const resolveSelfPaySelection =
  (
    pointer: SelfPayPointer | null,
    firstSeenAt: TimestampMs
  ): Task<SelfPaySelectionLookup, never, SelfPayArrivalDeps> =>
  async (run) => {
    if (pointer === null) return ok({ type: "resolved", selection: null })
    const selection = await run.ok(
      lookUpSelfPaySelection(pointer, SelfPayShareSelectionSchema)
    )
    if (selection !== null) return ok({ type: "resolved", selection })
    const waited = run.deps.date.now().getTime() - firstSeenAt
    return ok(
      waited < SELECTION_LOOKUP_GRACE_MS
        ? { type: "waiting" }
        : { type: "resolved", selection: null }
    )
  }

const allocateSelfPaySelection =
  ({
    selection,
    bill,
    summaries,
    reference,
    credited,
  }: {
    readonly selection: SelfPayShareSelection | null
    readonly bill: SelfPayBill
    readonly summaries: ReadonlyArray<BillLineSummary>
    readonly reference: SelfPayReference
    readonly credited: number
  }): Task<SelfPaySelectionAllocation, never, EvoluDep> =>
  async (run) => {
    const unallocated: SelfPaySelectionAllocation = { tipAmount: 0, lines: [] }
    if (selection === null || selection.reference !== reference) {
      return ok(unallocated)
    }
    const candidates = await run.ok(loadSelfPayShareCandidates(bill, reference))
    const seen = candidates.find(
      (candidate) =>
        deriveSelfPayShareBillVersion(candidate) === selection.version
    )
    if (seen === undefined) return ok(unallocated)
    const share = calculateSelfPayShare(seen, selection.split, bill.currency)
    if (credited < share.amount) return ok(unallocated)

    const lineKeys = new Set(
      summaries.map((summary) => deriveSelfPayLineKey(summary.id))
    )
    return ok({
      tipAmount: credited - share.amount,
      lines: share.lines.filter(({ key }) => lineKeys.has(key)),
    })
  }

const selfPayPaymentId = (transaction: SelfPayTransaction) =>
  createIdFromString<"Payment">(`self-pay:${transaction.id}`)

const selfPayPaymentRows = ({
  transaction,
  bill,
  amount,
  tipAmount,
  ...method
}: Pick<SelfPayPaymentRows, "iban" | "spark" | "pointer"> & {
  readonly transaction: SelfPayTransaction
  readonly bill: {
    readonly id: BillId
    readonly deviceId: DeviceId
    readonly tableId?: TableId | null
    readonly currency: FiatCurrency
  }
  readonly amount: number
  readonly tipAmount: number
}): SelfPayPaymentRows => ({
  payment: {
    id: selfPayPaymentId(transaction),
    deviceId: bill.deviceId,
    billId: bill.id,
    tableId: bill.tableId,
    amount: NonNegativeInteger(amount),
    currency: bill.currency,
    tipAmount: NonNegativeInteger(tipAmount),
    canceledAt: null,
    expiresAt: null,
  },
  ...method,
})

const loadSelfPayCoveredBefore =
  (
    bill: SelfPayBill,
    transaction: SelfPayTransaction
  ): Task<number, never, EvoluDep> =>
  async (run) => {
    const claimedTransactions = await run.deps.evolu.loadQuery(
      claimedTransactionsByBillIdQuery(bill.id)
    )
    const paymentId = selfPayPaymentId(transaction)
    return ok(
      calculateClaimedSum(
        claimedTransactions.filter((claimed) => claimed.paymentId !== paymentId)
      )
    )
  }

const loadSelfPayRemainder =
  (
    bill: SelfPayBill,
    summaries: ReadonlyArray<BillLineSummary>,
    transaction: SelfPayTransaction
  ): Task<number, never, EvoluDep> =>
  async (run) => {
    const covered = await run.ok(loadSelfPayCoveredBefore(bill, transaction))
    return ok(Math.max(0, deriveBillSummaryTotal(summaries) - covered))
  }

const creditSelfPayArrival =
  ({
    transaction,
    bill,
    reference,
    amount,
    pointer,
    selection,
    ...method
  }: Pick<SelfPayPaymentRows, "iban" | "spark" | "pointer"> & {
    readonly transaction: SelfPayTransaction
    readonly bill: SelfPayBill
    readonly reference: SelfPayReference
    readonly amount: number
    readonly selection: SelfPayShareSelection | null
  }): Task<SelfPayArrival | null, never, EvoluDep> =>
  async (run) => {
    const summaries = await run.ok(loadCalculatedBillLineSummaries(bill.id))
    const remainder = await run.ok(
      loadSelfPayRemainder(bill, summaries, transaction)
    )
    if (!meetsSelfPayMinimum({ amount, remainder, currency: bill.currency })) {
      return ok(null)
    }

    const allocation = await run.ok(
      allocateSelfPaySelection({
        selection,
        bill,
        summaries,
        reference,
        credited: amount,
      })
    )
    const rows = selfPayPaymentRows({
      transaction,
      bill,
      amount,
      tipAmount: allocation.tipAmount,
      pointer,
      ...method,
    })
    return ok({
      rows,
      allocations: allocationWrites(rows.payment.id, bill.id, allocation.lines),
      order: null,
      writtenOrderRest: null,
    })
  }

const allocationWrites = (
  paymentId: PaymentId,
  billId: BillId,
  lines: SelfPayShare["lines"]
): ReadonlyArray<SelfPayAllocationWrite> =>
  lines.map(({ key, amount }) => ({
    id: createIdFromString<"SelfPayAllocation">(
      `selfPayAllocation:${paymentId}:${key}`
    ),
    paymentId,
    billId,
    lineKey: NonEmptyString255(key),
    amount: PositiveInteger(amount),
  }))

interface MenuOrderIntent {
  readonly selection: SelfPayOrderIntent
  readonly currency: FiatCurrency
}

type SelfPayTarget =
  | {
      readonly type: "bill"
      readonly bill: SelfPayBill
      readonly selection: SelfPayShareSelection | null
    }
  | {
      readonly type: "writtenOrderRest"
      readonly bill: SelfPayBill
      readonly writtenAmount: number
    }
  | { readonly type: "newOrder"; readonly intent: MenuOrderIntent }
  | { readonly type: "waiting" }

type ResolvedSelfPayTarget = Exclude<
  SelfPayTarget,
  { readonly type: "waiting" }
>

const loadMenuOrderIntent =
  (
    pointer: SelfPayPointer
  ): Task<MenuOrderIntent | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const selection = await run.ok(
      lookUpSelfPaySelection(pointer, SelfPayOrderIntentSchema)
    )
    if (selection === null) return ok(null)
    const menu = await run.ok(loadSelfPayMenuVersion(selection.menu))
    return ok(menu === null ? null : { selection, currency: menu.currency })
  }

const isOrderDevice =
  (): Task<boolean, never, SelfPayArrivalDeps> => async (run) => {
    const [settings] = await run.deps.evolu.loadQuery(selfPaySettingsQuery)
    return ok(
      run.deps.deviceId !== undefined &&
        settings?.orderDeviceId === run.deps.deviceId
    )
  }

const resolveSelfPayTarget =
  ({
    transaction,
    reference,
    pointer,
  }: {
    readonly transaction: SelfPayTransaction
    readonly reference: SelfPayReference
    readonly pointer: SelfPayPointer | null
  }): Task<SelfPayTarget | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    if (isOrderSelfPayReference(reference)) {
      if (
        pointer === null ||
        reference !== deriveOrderSelfPayReference(pointer) ||
        !(await run.ok(isOrderDevice()))
      ) {
        return ok(null)
      }
      const orderBillId = deriveMenuOrderBillId(pointer)
      const bill = await run.ok(
        loadSelfPayBill(reference, transaction.occurredAt, orderBillId)
      )
      const [recorded] = await run.deps.evolu.loadQuery(
        menuOrderByBillIdQuery(orderBillId)
      )
      const writtenAmount = recorded?.writtenAmount ?? null
      if (bill !== null) {
        return ok(
          writtenAmount === null
            ? { type: "bill", bill, selection: null }
            : { type: "writtenOrderRest", bill, writtenAmount }
        )
      }
      if (recorded !== undefined) return ok(null)
      const intent = await run.ok(loadMenuOrderIntent(pointer))
      return ok(
        intent === null ? { type: "waiting" } : { type: "newOrder", intent }
      )
    }

    const bill = await run.ok(
      loadSelfPayBill(reference, transaction.occurredAt)
    )
    if (bill === null) return ok(null)
    const lookup = await run.ok(
      resolveSelfPaySelection(pointer, transaction.firstSeenAt)
    )
    return ok(
      lookup.type === "waiting"
        ? lookup
        : { type: "bill", bill, selection: lookup.selection }
    )
  }

const selfPayTargetCurrency = (target: ResolvedSelfPayTarget): FiatCurrency =>
  target.type === "newOrder" ? target.intent.currency : target.bill.currency

const creditMenuOrderArrival =
  ({
    transaction,
    reference,
    amount,
    pointer,
    intent,
    ...method
  }: Pick<SelfPayPaymentRows, "iban" | "spark"> & {
    readonly transaction: SelfPayTransaction
    readonly reference: SelfPayReference
    readonly amount: number
    readonly pointer: SelfPayPointer
    readonly intent: MenuOrderIntent
  }): Task<SelfPayArrival | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const { deviceId, tableSelfPayRoot } = run.deps
    if (deviceId === undefined || tableSelfPayRoot === undefined) {
      return ok(null)
    }
    const order = await run.ok(
      loadMenuOrderArrivalRows({
        pointer,
        reference,
        selection: intent.selection,
        arrived: amount,
        deviceId,
        root: tableSelfPayRoot,
      })
    )
    if (
      order === null ||
      !meetsSelfPayMinimum({
        amount,
        remainder: order.askedToPay,
        currency: intent.currency,
      })
    ) {
      return ok(null)
    }

    const covers = amount >= order.total
    const rows = selfPayPaymentRows({
      transaction,
      bill: { ...order.bill.bill, deviceId, currency: intent.currency },
      amount,
      tipAmount: covers ? amount - order.total : 0,
      pointer,
      ...method,
    })
    return ok({
      rows,
      allocations: covers
        ? allocationWrites(rows.payment.id, order.bill.bill.id, order.lines)
        : [],
      order,
      writtenOrderRest: null,
    })
  }

const creditWrittenOrderRest =
  ({
    transaction,
    bill,
    writtenAmount,
    amount,
    pointer,
    ...method
  }: Pick<SelfPayPaymentRows, "iban" | "spark"> & {
    readonly transaction: SelfPayTransaction
    readonly bill: SelfPayBill
    readonly writtenAmount: number
    readonly amount: number
    readonly pointer: SelfPayPointer
  }): Task<SelfPayArrival | null, never, EvoluDep> =>
  async (run) => {
    const coveredBefore = await run.ok(
      loadSelfPayCoveredBefore(bill, transaction)
    )
    if (
      !meetsSelfPayMinimum({
        amount,
        remainder: Math.max(0, writtenAmount - coveredBefore),
        currency: bill.currency,
      })
    ) {
      return ok(null)
    }
    return ok({
      rows: selfPayPaymentRows({
        transaction,
        bill,
        amount,
        tipAmount: 0,
        pointer,
        ...method,
      }),
      allocations: [],
      order: null,
      writtenOrderRest: raiseWrittenOrderLine({
        pointer,
        writtenAmount,
        coveredBefore,
        amount,
      }),
    })
  }

const creditSelfPayTarget =
  ({
    target,
    ...arrival
  }: Pick<SelfPayPaymentRows, "iban" | "spark"> & {
    readonly target: ResolvedSelfPayTarget
    readonly transaction: SelfPayTransaction
    readonly reference: SelfPayReference
    readonly amount: number
    readonly pointer: SelfPayPointer | null
  }): Task<SelfPayArrival | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    if (target.type === "bill") {
      return run(
        creditSelfPayArrival({
          ...arrival,
          bill: target.bill,
          selection: target.selection,
        })
      )
    }
    if (arrival.pointer === null) return ok(null)
    if (target.type === "writtenOrderRest") {
      return run(
        creditWrittenOrderRest({
          ...arrival,
          pointer: arrival.pointer,
          bill: target.bill,
          writtenAmount: target.writtenAmount,
        })
      )
    }
    return run(
      creditMenuOrderArrival({
        ...arrival,
        pointer: arrival.pointer,
        intent: target.intent,
      })
    )
  }

const loadBankArrival =
  (
    transaction: SelfPayTransaction
  ): Task<SelfPayArrival | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const reference = SelfPayReferenceSchema.safeParse(
      transaction.variableSymbol
    )
    if (!reference.success) return ok(null)

    const pointer =
      parseSelfPayBankMessage(transaction.recipientMessage)?.pointer ?? null
    const target = await run.ok(
      resolveSelfPayTarget({ transaction, reference: reference.data, pointer })
    )
    if (
      target === null ||
      target.type === "waiting" ||
      selfPayTargetCurrency(target) !== transaction.currency
    ) {
      return ok(null)
    }

    return run(
      creditSelfPayTarget({
        target,
        transaction,
        reference: reference.data,
        amount: transaction.amount,
        pointer,
        iban: {
          accountId: transaction.accountId,
          variableSymbol: VariableSymbol(reference.data),
          specificSymbol: null,
        },
        spark: null,
      })
    )
  }

const loadLightningArrival =
  (
    transaction: SelfPayTransaction & { readonly lnInvoice: string },
    root: TableSelfPayRootDep["tableSelfPayRoot"]
  ): Task<SelfPayArrival | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    const invoice = parseLightningInvoice(transaction.lnInvoice)
    const memo = parseSelfPayLightningMemo(
      invoice.ok ? invoice.value.description : null
    )
    if (!invoice.ok || memo === null) return ok(null)

    const target = await run.ok(
      resolveSelfPayTarget({
        transaction,
        reference: memo.reference,
        pointer: memo.pointer,
      })
    )
    if (target === null || target.type === "waiting") return ok(null)
    const currency = selfPayTargetCurrency(target)

    const rateKey = deriveSelfPayRateKey(root)
    const { rate } = memo
    if (
      !verifySelfPayRate(rateKey, currency, rate) ||
      invoice.value.createdAt < rate.validFrom * 1000 ||
      invoice.value.createdAt > selfPayRateValidUntil(rate.validFrom) * 1000 ||
      transaction.occurredAt > selfPayRatePayableUntil(rate.validFrom) * 1000
    ) {
      return ok(null)
    }

    const amount = Math.min(
      memo.amount,
      selfPayCreditForSats({
        sats: transaction.amount,
        fractionDigits: currencyFractionDigits[currency],
        msatPerMajor: rate.msatPerMajor,
      })
    )

    return run(
      creditSelfPayTarget({
        target,
        transaction,
        reference: memo.reference,
        amount,
        pointer: memo.pointer,
        iban: null,
        spark: {
          accountId: transaction.accountId,
          amountSats: NonNegativeInteger(transaction.amount),
          exchangeRate: PositiveNumber(selfPayExchangeRate(rate.msatPerMajor)),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(rate.validFrom * 1000),
          lightning: {
            lnInvoice: transaction.lnInvoice,
            paymentHash: transaction.paymentHash,
          },
        },
      })
    )
  }

export const loadSelfPayArrival =
  (
    transaction: SelfPayTransaction
  ): Task<SelfPayArrival | null, never, SelfPayArrivalDeps> =>
  async (run) => {
    if (transaction.amount <= 0) return ok(null)

    const { lnInvoice } = transaction
    if (transaction.currency !== "BTC") {
      return ok(await run.ok(loadBankArrival(transaction)))
    }
    const root = run.deps.tableSelfPayRoot
    if (lnInvoice === null || root === undefined) return ok(null)

    return ok(
      await run.ok(loadLightningArrival({ ...transaction, lnInvoice }, root))
    )
  }

export const upsertSelfPayAllocations = (
  evolu: EvoluDep["evolu"],
  allocations: ReadonlyArray<SelfPayAllocationWrite>,
  options: MutationOptions
): void => {
  for (const allocation of allocations) {
    evolu.upsert("selfPayAllocation", allocation, options)
  }
}

export const upsertBillSelfPayReferences = (
  evolu: EvoluDep["evolu"],
  references: ReadonlyArray<{
    readonly billId: BillId
    readonly reference: SelfPayReference
  }>,
  options: MutationOptions
): void => {
  for (const { billId, reference } of references) {
    evolu.upsert("billSelfPayReference", { id: billId, reference }, options)
  }
}

const createSparkWalletPublicError = defineError("SparkWalletPublic")()
type SparkWalletPublicError = ReturnType<typeof createSparkWalletPublicError>

const makeSparkWalletPrivate = async (
  wallet: SparkPaymentWallet
): Promise<Result<void, SparkWalletPublicError>> => {
  const settings = await wallet.getWalletSettings()
  if (settings?.privateEnabled === true) return ok()
  const updated = await wallet.setPrivacyEnabled(true)
  return updated?.privateEnabled === true
    ? ok()
    : err(createSparkWalletPublicError())
}

export const loadSelfPayInstructions =
  (): Task<
    SelfPayInstructions,
    never,
    EvoluDep & SparkWalletDep & TableSelfPayRootDep
  > =>
  async (run) => {
    const [
      [bankAccount],
      [sparkAccount],
      activeFioPlugins,
      activeMonetaPlugins,
      [settings],
    ] = await Promise.all(
      run.deps.evolu.loadQueries([
        fiatBankAccountQuery,
        sparkAccountQuery,
        activeFioPluginsQuery,
        activeMonetaPluginsQuery,
        selfPaySettingsQuery,
      ])
    )
    const payee = settings?.selfPayGuestName ?? null
    const menuKeys = deriveSelfPayMenuKeys(run.deps.tableSelfPayRoot)
    const menuPointer = {
      publicKey: bytesToHex(menuKeys.publicKey),
      readKey: bytesToHex(menuKeys.readKey),
    }
    const accounts = pickSelfPayAccounts({
      bankAccount,
      sparkAccount,
      activeBankPlugins: [...activeFioPlugins, ...activeMonetaPlugins],
    })
    const bank =
      accounts.bank === null
        ? null
        : {
            iban: accounts.bank.iban,
            accountName: payee ?? "",
            currency: accounts.bank.currency,
            qrFormat: accounts.bank.defaultQrFormat ?? "spayd",
          }
    let lightning: SelfPayInstructions["lightning"] = null
    if (accounts.spark !== null) {
      try {
        await using wallet = await run.deps.sparkWallet.create(
          accounts.spark.secret
        )
        const privacy = await makeSparkWalletPrivate(wallet)
        if (privacy.ok) {
          lightning = {
            identityPublicKey: await wallet.getIdentityPublicKey(),
          }
        } else {
          run.deps.console.warn(
            "Offered no Lightning while the Spark wallet stays public."
          )
        }
      } catch {
        run.deps.console.warn(
          "Offered no Lightning while Spark is unreachable."
        )
      }
    }

    return ok({
      payee,
      bank,
      lightning,
      selectionKey: bytesToHex(
        deriveSelfPaySelectionKey(run.deps.tableSelfPayRoot)
      ),
      menu: offersOrders(settings) ? menuPointer : null,
    })
  }

const createSelfPayViewVersionRow = (
  billId: BillId,
  bill: SelfPayShareBill
) => {
  const content = z.encode(SelfPayShareBillJson, bill)
  return {
    id: createIdFromString<"SelfPayViewVersion">(
      `selfPayViewVersion:${billId}:${content}`
    ),
    billId,
    content: NonEmptyStringSchema.decode(content),
  }
}

type SelfPayViewVersionWrite = ReturnType<typeof createSelfPayViewVersionRow>

const upsertSelfPayViewVersions = (
  evolu: EvoluDep["evolu"],
  versions: ReadonlyArray<SelfPayViewVersionWrite>,
  options: MutationOptions
): void => {
  for (const version of versions) {
    evolu.upsert("selfPayViewVersion", version, options)
  }
}

const parseSelfPayViewVersion = (content: string): SelfPayShareBill | null => {
  const parsed = z.safeDecode(SelfPayShareBillJson, content)
  return parsed.success ? parsed.data : null
}

export const loadSelfPayViewVersions =
  (billId: BillId): Task<ReadonlyArray<SelfPayShareBill>, never, EvoluDep> =>
  async (run) => {
    const rows = await run.deps.evolu.loadQuery(
      selfPayViewVersionsByBillIdQuery(billId)
    )
    return ok(
      rows.flatMap(({ content }) => {
        const version = parseSelfPayViewVersion(content)
        return version === null ? [] : [version]
      })
    )
  }

export const dropExpiredSelfPayViewVersions =
  (): Task<number, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const expired = await evolu.loadQuery(
      expiredSelfPayViewVersionsQuery(
        TimestampMs(
          subDays(run.deps.date.now(), ENDED_BILL_RETENTION_DAYS).getTime()
        )
      )
    )
    if (expired.length === 0) return ok(0)

    await runMutationWithCompletion((options) => {
      for (const { id } of expired) {
        evolu.update(
          "selfPayViewVersion",
          { id, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      }
    })
    return ok(expired.length)
  }

interface TableSelfPayViewSnapshot {
  readonly view: SelfPayView
  readonly version: number
  readonly currencies: ReadonlySet<FiatCurrency>
  readonly references: ReadonlyArray<{
    readonly billId: BillId
    readonly reference: SelfPayReference
  }>
  readonly versions: ReadonlyArray<SelfPayViewVersionWrite>
}

export const loadTableSelfPayView =
  (
    table: SelfPayTableRow
  ): Task<
    TableSelfPayViewSnapshot,
    never,
    EvoluDep & SparkWalletDep & TableSelfPayRootDep
  > =>
  async (run) => {
    const [bills, openBills, [change], storedVersions] = await Promise.all(
      run.deps.evolu.loadQueries([
        tableSelfPayBillsQuery(table.id),
        openBillIdsQuery,
        tableSelfPayVersionQuery(table.id),
        tableSelfPayViewVersionIdsQuery(table.id),
      ])
    )
    const version = Math.max(
      0,
      ...[change?.createdAt, change?.updatedAt].flatMap((changedAt) =>
        changedAt === null || changedAt === undefined
          ? []
          : [Math.floor(Date.parse(changedAt) / 1000)]
      )
    )
    if (table.selfPayEnabled !== sqliteTrue) {
      return ok({
        view: createDisabledSelfPayView(table.name),
        version,
        currencies: new Set(),
        references: [],
        versions: [],
      })
    }

    const [instructions, confirmations, [settings]] = await Promise.all([
      run.ok(loadSelfPayInstructions()),
      run.deps.evolu.loadQuery(
        tableSelfPayConfirmationsQuery(
          table.id,
          selfPayConfirmationsEndedAfter(version)
        )
      ),
      run.deps.evolu.loadQuery(selfPaySettingsQuery),
    ])
    const shownBills =
      settings?.selfPayBillsHidden === sqliteTrue
        ? []
        : bills.filter(
            ({ reference }) =>
              reference === null || !isOrderSelfPayReference(reference)
          )
    const offered = findOfferedSelfPayReferences(openBills)
    const view = projectTableSelfPayView({
      tableName: table.name,
      bills: shownBills,
      confirmations,
      offered,
      instructions,
    })
    const billIdByReference = new Map(
      [...offered].map(([billId, reference]) => [reference, billId])
    )
    const storedVersionIds = new Set(storedVersions.map(({ id }) => id))
    return ok({
      view,
      version,
      currencies: new Set(shownBills.map(({ currency }) => currency)),
      references: shownBills.flatMap(({ id, deviceId, reference }) => {
        const offeredReference = offered.get(id)
        return deviceId !== null &&
          reference === null &&
          offeredReference !== undefined
          ? [{ billId: id, reference: offeredReference }]
          : []
      }),
      versions: view.bills.flatMap((bill) => {
        const billId = billIdByReference.get(bill.reference)
        if (billId === undefined) return []
        const row = createSelfPayViewVersionRow(billId, bill)
        return storedVersionIds.has(row.id) ? [] : [row]
      }),
    })
  }

export const saveTableSelfPayViewSnapshot =
  ({
    references,
    versions,
  }: TableSelfPayViewSnapshot): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    if (references.length === 0 && versions.length === 0) return ok()
    await runMutationWithCompletion((options) => {
      const owned = { ...options, owner: run.deps.evoluOwner }
      upsertBillSelfPayReferences(run.deps.evolu, references, owned)
      upsertSelfPayViewVersions(run.deps.evolu, versions, owned)
    })
    return ok()
  }

const selfPayViewPublicationId = (deviceId: DeviceId, tag: string) =>
  createIdFromString<"SelfPayViewPublication">(
    `selfPayViewPublication:${deviceId}:${tag}`
  )

export const loadSelfPayViewPublishedAt =
  (tag: string): Task<number | null, never, EvoluDep & DeviceIdDep> =>
  async (run) => {
    const [publication] = await run.deps.evolu.loadQuery(
      selfPayViewPublicationByIdQuery(
        selfPayViewPublicationId(run.deps.deviceId, tag)
      )
    )
    return ok(publication?.eventCreatedAt ?? null)
  }

export const saveSelfPayViewPublishResult =
  ({
    tag,
    createdAt,
    version,
    content,
    relays,
  }: {
    readonly tag: string
    readonly createdAt: number
    readonly version: number
    readonly content: string
    readonly relays: ReadonlyArray<{
      readonly url: WssUrl
      readonly accepted: boolean
    }>
  }): Task<void, never, EvoluDep & EvoluOwnerDep & DeviceIdDep & DateDep> =>
  async (run) => {
    const { evolu, evoluOwner, deviceId, date } = run.deps
    const row = {
      id: selfPayViewPublicationId(deviceId, tag),
      tag: NonEmptyString255(tag),
      lastPublishJson: z.encode(SelfPayPublishResultJson, {
        at: TimestampMs(date.now().getTime()),
        version: NonNegativeInteger(version),
        contentHash: bytesToHex(sha256(utf8ToBytes(content))),
        relays,
      }),
    }
    await runMutationWithCompletion((options) => {
      const owned = { ...options, owner: evoluOwner }
      if (relays.some(({ accepted }) => accepted)) {
        evolu.upsert(
          "selfPayViewPublication",
          { ...row, eventCreatedAt: PositiveInteger(createdAt) },
          owned
        )
      } else {
        evolu.update("selfPayViewPublication", row, owned)
      }
    })
    return ok()
  }

export const loadActiveSelfPayRelays =
  (): Task<ReadonlyArray<WssUrl>, never, EvoluDep & SelfPayDefaultRelaysDep> =>
  async (run) => {
    const rows = await run.deps.evolu.loadQuery(selfPayRelaysQuery)
    return ok(
      activeSelfPayRelays(
        listSelfPayRelays(run.deps.selfPayDefaultRelays, rows)
      )
    )
  }

export const setSelfPayRelayActive =
  ({
    url,
    isActive,
  }: {
    readonly url: WssUrl
    readonly isActive: boolean
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "selfPayRelay",
        {
          id: createIdFromString<"SelfPayRelay">(url),
          url,
          isActive: isActive ? sqliteTrue : sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    )
    return ok()
  }
