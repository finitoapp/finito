import {
  createIdFromString,
  DateIso,
  err,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { format, subDays } from "date-fns"
import { z } from "zod"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { unclaimedIncomingTransactionsSinceQuery } from "../account-transaction/account-transaction-queries.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import {
  selfPaySettingsQuery,
  settingsQuery,
} from "../app-settings/app-settings-queries.ts"
import { getFiatCurrency } from "../app-settings/app-settings-utils.ts"
import {
  cancelBill,
  loadNextBillDisplayNumber,
  type MenuOrderBillRows,
} from "../bill/bill-actions.ts"
import { claimedTransactionsByBillIdQuery } from "../bill/bill-coverage-queries.ts"
import {
  type BillCoverageSummary,
  loadBillCoverage,
  loadBillStatus,
} from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { claimedPaymentIdSet } from "../bill/bill-utils.ts"
import type { BillLineRow } from "../bill-line/bill-line.ts"
import {
  loadCalculatedBillLineSummaries,
  updateBillLineItem,
} from "../bill-line/bill-line-actions.ts"
import { billLinesByBillIdQuery } from "../bill-line/bill-line-queries.ts"
import type {
  BillLineId,
  BillLineSummaryId,
} from "../bill-line/bill-line-types.ts"
import { createBillLineSummaryId } from "../bill-line/bill-line-utils.ts"
import { catalogCategoriesQuery } from "../catalog-category/catalog-category-queries.ts"
import type { CatalogItemRow } from "../catalog-item/catalog-item.ts"
import { putCatalogItemInMenuUntil } from "../catalog-item/catalog-item-actions.ts"
import { catalogItemsQuery } from "../catalog-item/catalog-item-queries.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { getStaffDisplayName } from "../catalog-item/catalog-item-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { ItemRow } from "../item/item.ts"
import { upsertItemSnapshot } from "../item/item-actions.ts"
import { itemsByBillIdQuery } from "../item/item-queries.ts"
import { createStandaloneItemSnapshot } from "../item/item-utils.ts"
import { legalEntityQuery } from "../legal-entity/legal-entity-queries.ts"
import { isVatPayer } from "../legal-entity/legal-entity-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { deriveTableSelfPayKeys } from "../shared/key-derivation.ts"
import type { Money } from "../shared/money.ts"
import {
  type Currency,
  DateStringSchema,
  type FiatCurrency,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMs,
} from "../shared/schema.ts"
import { tablesQuery } from "../table/table-queries.ts"
import { deriveSelfPayLineKey } from "../table-self-pay/table-self-pay-projection-utils.ts"
import { selfPayTablesQuery } from "../table-self-pay/table-self-pay-queries.ts"
import {
  isOrderSelfPayReference,
  parseSelfPayBankMessage,
  type SelfPayPointer,
  type SelfPayReference,
  SelfPayReferenceSchema,
} from "../table-self-pay/table-self-pay-reference-utils.ts"
import { taxRatesQuery } from "../tax-rate/tax-rate-queries.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { filterSelectableTaxRates } from "../tax-rate/tax-rate-utils.ts"
import type { MenuOrderRow } from "./menu-order.ts"
import {
  lastMenuOrderNumberQuery,
  menuOrderByBillIdQuery,
  menuOrdersToServeQuery,
  menuVersionByIdQuery,
  menuVersionsNewestFirstQuery,
  rejectedMenuOrdersByPointerQuery,
} from "./menu-order-queries.ts"
import type { MenuOrderId } from "./menu-order-types.ts"
import {
  buildSelfPayMenu,
  countSelfPayMenuItems,
  deriveSelfPayMenuItemKey,
  fillWrittenOrderLines,
  fitSelfPayMenuIntoEvent,
  isOfferedInMenu,
  isWrittenAmountInRange,
  MAX_WRITTEN_LINES,
  MenuJson,
  menuDayEndAfter,
  menuDayEndHourOf,
  priceSelfPayOrder,
  type SelfPayMenu,
  type SelfPayOrderIntent,
  type SelfPayOrderSelection,
  type SelfPayWrittenSelection,
  type WrittenOrderColumns,
  writtenOrderOf,
  writtenOrderTotal,
} from "./menu-order-utils.ts"

const REPLACED_MENU_RETENTION_DAYS = 7
const ORDER_LOOKUP_DAYS = 7

export const deriveMenuVersionRowId = (version: string) =>
  createIdFromString<"MenuVersion">(`menuVersion:${version}`)

export const deriveMenuOrderBillId = (pointer: SelfPayPointer): BillId =>
  createIdFromString<"Bill">(`menu-order:${pointer}`)

const deriveMenuOrderId = (pointer: SelfPayPointer): MenuOrderId =>
  createIdFromString<"MenuOrder">(`menu-order:${pointer}`)

export interface SelfPayMenuSnapshot {
  readonly menu: SelfPayMenu
  readonly leftOut: number
  readonly otherCurrency: number
}

export const loadSelfPayMenu =
  (): Task<SelfPayMenuSnapshot, never, EvoluDep & DateDep> => async (run) => {
    const now = run.deps.date.now()
    const [items, categories, [settings], [selfPaySettings], [legalEntity]] =
      await Promise.all(
        run.deps.evolu.loadQueries([
          catalogItemsQuery,
          catalogCategoriesQuery,
          settingsQuery,
          selfPaySettingsQuery,
          legalEntityQuery,
        ])
      )
    const currency = getFiatCurrency(settings)
    const full = buildSelfPayMenu({
      items: selfPaySettings?.menuOrdering === sqliteTrue ? items : [],
      categories,
      currency,
      written:
        selfPaySettings?.writtenOrders === sqliteTrue &&
        (selfPaySettings.writtenOrderTaxRateId !== null ||
          !isVatPayer(legalEntity)),
      now,
    })
    const menu = fitSelfPayMenuIntoEvent(full)
    return ok({
      menu,
      leftOut: countSelfPayMenuItems(full) - countSelfPayMenuItems(menu),
      otherCurrency: items.filter(
        (item) => isOfferedInMenu(item, now) && item.currency !== currency
      ).length,
    })
  }

export const saveSelfPayMenuVersion =
  (menu: SelfPayMenu): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const id = deriveMenuVersionRowId(menu.version)
    const [[stored], [newest]] = await Promise.all(
      run.deps.evolu.loadQueries([
        menuVersionByIdQuery(id),
        menuVersionsNewestFirstQuery,
      ])
    )
    if (newest?.id === id) return ok()
    await runMutationWithCompletion((options) =>
      stored === undefined
        ? run.deps.evolu.upsert(
            "menuVersion",
            {
              id,
              content: NonEmptyStringSchema.decode(z.encode(MenuJson, menu)),
              isDeleted: sqliteFalse,
            },
            { ...options, owner: run.deps.evoluOwner }
          )
        : run.deps.evolu.update(
            "menuVersion",
            { id, isDeleted: sqliteFalse },
            { ...options, owner: run.deps.evoluOwner }
          )
    )
    return ok()
  }

export const loadSelfPayMenuVersion =
  (version: string): Task<SelfPayMenu | null, never, EvoluDep> =>
  async (run) => {
    const [stored] = await run.deps.evolu.loadQuery(
      menuVersionByIdQuery(deriveMenuVersionRowId(version))
    )
    if (stored === undefined) return ok(null)
    const parsed = z.safeDecode(MenuJson, stored.content)
    return ok(parsed.success ? parsed.data : null)
  }

export const dropReplacedMenuVersions =
  (
    liveVersion: string
  ): Task<number, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const versions = await run.deps.evolu.loadQuery(
      menuVersionsNewestFirstQuery
    )
    const keptAfter = subDays(
      run.deps.date.now(),
      REPLACED_MENU_RETENTION_DAYS
    ).getTime()
    const live = deriveMenuVersionRowId(liveVersion)
    const replaced = versions.filter(({ id }, index) => {
      const newerOnOfferAt = versions[index - 1]?.onOfferAt
      return (
        id !== live &&
        newerOnOfferAt !== undefined &&
        Date.parse(newerOnOfferAt) < keptAfter
      )
    })
    if (replaced.length === 0) return ok(0)
    await runMutationWithCompletion((options) => {
      for (const { id } of replaced) {
        run.deps.evolu.update(
          "menuVersion",
          { id, isDeleted: sqliteTrue },
          { ...options, owner: run.deps.evoluOwner }
        )
      }
    })
    return ok(replaced.length)
  }

export const acceptMenuOrder =
  (id: MenuOrderId): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "menuOrder",
        { id, acceptedAt: TimestampMs(run.deps.date.now().getTime()) },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

export const markMenuOrderServed =
  (id: MenuOrderId): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "menuOrder",
        { id, servedAt: TimestampMs(run.deps.date.now().getTime()) },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

export type RejectedMenuOrderRefund =
  | { readonly type: "payment"; readonly paymentId: PaymentId }
  | { readonly type: "bill"; readonly billId: BillId }

export const rejectMenuOrder =
  ({
    id,
    billId,
  }: {
    readonly id: MenuOrderId
    readonly billId: BillId
  }): Task<
    RejectedMenuOrderRefund,
    never,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const status = await run(loadBillStatus(billId))
    if (status.ok && status.value === "open") {
      await run.orThrow(cancelBill(billId))
    }
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "menuOrder",
        { id, rejectedAt: TimestampMs(run.deps.date.now().getTime()) },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    const [paymentId, ...otherPayments] = claimedPaymentIdSet(
      await run.deps.evolu.loadQuery(claimedTransactionsByBillIdQuery(billId))
    )
    return ok(
      paymentId !== undefined && otherPayments.length === 0
        ? { type: "payment", paymentId }
        : { type: "bill", billId }
    )
  }

export interface MenuOrderArrivalRows {
  readonly bill: MenuOrderBillRows
  readonly reference: SelfPayReference
  readonly menuOrder: Omit<
    MenuOrderRow,
    "acceptedAt" | "servedAt" | "rejectedAt"
  >
  readonly askedToPay: number
  readonly total: number
  readonly lines: ReadonlyArray<{
    readonly key: string
    readonly amount: number
  }>
}

export const upsertMenuOrderRows = (
  evolu: EvoluDep["evolu"],
  menuOrder: MenuOrderArrivalRows["menuOrder"],
  options: MutationOptions
): void => {
  evolu.upsert("menuOrder", menuOrder, options)
}

interface OrderedLine {
  readonly snapshot: ItemRow
  readonly line: BillLineRow
  readonly allocation: { readonly key: string; readonly amount: number }
}

const mergeAllocations = (
  allocations: ReadonlyArray<OrderedLine["allocation"]>
): ReadonlyArray<OrderedLine["allocation"]> => {
  const byKey = new Map<string, number>()
  for (const { key, amount } of allocations) {
    byKey.set(key, (byKey.get(key) ?? 0) + amount)
  }
  return [...byKey].flatMap(([key, amount]) =>
    amount > 0 ? [{ key, amount }] : []
  )
}

const orderedLine = ({
  billId,
  lineId,
  snapshot,
  type,
  quantity,
  totalAmount,
  deviceId,
}: {
  readonly billId: BillId
  readonly lineId: BillLineId
  readonly snapshot: ItemRow
  readonly type: BillLineRow["type"]
  readonly quantity: number
  readonly totalAmount: number
  readonly deviceId: DeviceId
}): OrderedLine => {
  const line: BillLineRow = {
    id: lineId,
    billId,
    deviceId,
    catalogItemId: snapshot.catalogItemId,
    itemId: snapshot.id,
    type,
    kind: "add",
    quantity: PositiveNumber(quantity),
    totalAmount: NonNegativeInteger(totalAmount),
  }
  const summaryId = createBillLineSummaryId({
    billId,
    catalogItemId: line.catalogItemId,
    itemId: snapshot.id,
    type,
  })
  return {
    snapshot,
    line,
    allocation: { key: deriveSelfPayLineKey(summaryId), amount: totalAmount },
  }
}

const deriveWrittenOrderLineId = (
  pointer: SelfPayPointer,
  index: number
): BillLineId =>
  createIdFromString<"BillLine">(`menu-order-line:${pointer}:written:${index}`)

interface MenuOrderLines {
  readonly askedToPay: number
  readonly ordered: ReadonlyArray<OrderedLine>
}

const writtenOrderLines = ({
  pointer,
  billId,
  selection,
  currency,
  taxRateId,
  arrived,
  deviceId,
}: {
  readonly pointer: SelfPayPointer
  readonly billId: BillId
  readonly selection: SelfPayWrittenSelection
  readonly currency: FiatCurrency
  readonly taxRateId: TaxRateId | null
  readonly arrived: number
  readonly deviceId: DeviceId
}): MenuOrderLines | null => {
  const askedToPay = writtenOrderTotal(selection.lines)
  if (!isWrittenAmountInRange(askedToPay, currency)) return null
  const filled = fillWrittenOrderLines(
    selection.lines.map(({ amount }) => amount),
    arrived
  )
  return {
    askedToPay,
    ordered: selection.lines.map(({ text, amount }, index) =>
      orderedLine({
        billId,
        lineId: deriveWrittenOrderLineId(pointer, index),
        snapshot: createStandaloneItemSnapshot({
          catalogItemId: null,
          name: NonEmptyString255(text),
          description: null,
          currency,
          unitAmount: NonNegativeInteger(amount),
          taxRateId,
        }),
        type: "manualAmount",
        quantity: 1,
        totalAmount: filled[index] ?? 0,
        deviceId,
      })
    ),
  }
}

const pricedOrderLines = ({
  pointer,
  billId,
  selection,
  menu,
  catalogItems,
  deviceId,
}: {
  readonly pointer: SelfPayPointer
  readonly billId: BillId
  readonly selection: SelfPayOrderSelection
  readonly menu: SelfPayMenu
  readonly catalogItems: ReadonlyArray<CatalogItemRow>
  readonly deviceId: DeviceId
}): MenuOrderLines | null => {
  const priced = priceSelfPayOrder(menu, selection.items)
  if (priced === null) return null
  const catalogByKey = new Map(
    catalogItems.map((item) => [deriveSelfPayMenuItemKey(item.id), item])
  )
  return {
    askedToPay: priced.total,
    ordered: priced.lines.map(({ item, quantity, totalAmount }) => {
      const catalogItem = catalogByKey.get(item.key)
      return orderedLine({
        billId,
        lineId: createIdFromString<"BillLine">(
          `menu-order-line:${pointer}:${item.key}`
        ),
        snapshot: createStandaloneItemSnapshot({
          catalogItemId: catalogItem?.id ?? null,
          name: NonEmptyString255(item.name),
          description:
            item.description === null
              ? null
              : NonEmptyString255(item.description),
          currency: menu.currency,
          unitAmount: NonNegativeInteger(item.unitAmount),
          taxRateId: catalogItem?.taxRateId ?? null,
        }),
        type: catalogItem === undefined ? "manualAmount" : "catalogItem",
        quantity,
        totalAmount,
        deviceId,
      })
    }),
  }
}

export const loadMenuOrderArrivalRows =
  ({
    pointer,
    reference,
    selection,
    arrived,
    deviceId,
    root,
  }: {
    readonly pointer: SelfPayPointer
    readonly reference: SelfPayReference
    readonly selection: SelfPayOrderIntent
    readonly arrived: number
    readonly deviceId: DeviceId
    readonly root: Uint8Array
  }): Task<MenuOrderArrivalRows | null, never, EvoluDep & DateDep> =>
  async (run) => {
    const menu = await run.ok(loadSelfPayMenuVersion(selection.menu))
    if (menu === null || menu.version !== selection.menu) return ok(null)

    const [tables, catalogItems, [settings]] = await Promise.all(
      run.deps.evolu.loadQueries([
        selfPayTablesQuery,
        catalogItemsQuery,
        selfPaySettingsQuery,
      ])
    )
    const takesKind =
      selection.kind === "written"
        ? settings?.writtenOrders
        : settings?.menuOrdering
    if (takesKind !== sqliteTrue) return ok(null)
    const table = tables.find(
      (candidate) =>
        candidate.selfPayEnabled === sqliteTrue &&
        bytesToHex(
          deriveTableSelfPayKeys(
            root,
            candidate.id,
            candidate.selfPayEpoch ?? 0
          ).publicKey
        ) === selection.table
    )
    if (table === undefined) return ok(null)

    const billId = deriveMenuOrderBillId(pointer)
    const lines =
      selection.kind === "written"
        ? writtenOrderLines({
            pointer,
            billId,
            selection,
            currency: menu.currency,
            taxRateId: settings?.writtenOrderTaxRateId ?? null,
            arrived,
            deviceId,
          })
        : pricedOrderLines({
            pointer,
            billId,
            selection,
            menu,
            catalogItems,
            deviceId,
          })
    if (lines === null) return ok(null)
    const { askedToPay, ordered } = lines

    const now = run.deps.date.now()
    const day = DateStringSchema.decode(format(now, "yyyy-MM-dd"))
    const [displayNumber, [last]] = await Promise.all([
      run.ok(loadNextBillDisplayNumber()),
      run.deps.evolu.loadQuery(lastMenuOrderNumberQuery(day)),
    ])

    return ok({
      bill: {
        bill: {
          id: billId,
          deviceId,
          tableId: table.id,
          currency: menu.currency,
          displayNumber,
          label: null,
        },
        items: ordered.map(({ snapshot }) => snapshot),
        lines: ordered.map(({ line }) => line),
      },
      reference,
      menuOrder: {
        id: deriveMenuOrderId(pointer),
        billId,
        pointer,
        day,
        number: PositiveInteger((last?.number ?? 0) + 1),
        note:
          selection.kind === "order" && selection.note !== null
            ? NonEmptyString255(selection.note)
            : null,
        writtenAmount:
          selection.kind === "written" ? PositiveInteger(askedToPay) : null,
      },
      askedToPay,
      total: ordered.reduce((sum, { line }) => sum + line.totalAmount, 0),
      lines: mergeAllocations(ordered.map(({ allocation }) => allocation)),
    })
  }

export interface WrittenOrderLineRow {
  readonly id: BillLineId
  readonly text: string
  readonly currency: FiatCurrency
  readonly named: number
  readonly arrived: number
  readonly taxRateId: TaxRateId | null
}

export const loadWrittenOrderLines =
  ({
    billId,
    pointer,
  }: {
    readonly billId: BillId
    readonly pointer: SelfPayPointer
  }): Task<ReadonlyArray<WrittenOrderLineRow>, never, EvoluDep> =>
  async (run) => {
    const [lines, items] = await Promise.all(
      run.deps.evolu.loadQueries([
        billLinesByBillIdQuery(billId),
        itemsByBillIdQuery(billId),
      ])
    )
    const lineById = new Map(lines.map((line) => [line.id, line]))
    const itemById = new Map(items.map((item) => [item.id, item]))
    return ok(
      Array.from({ length: MAX_WRITTEN_LINES }, (_, index) =>
        lineById.get(deriveWrittenOrderLineId(pointer, index))
      ).flatMap((line) => {
        const item = line === undefined ? undefined : itemById.get(line.itemId)
        return line === undefined || item === undefined
          ? []
          : [
              {
                id: line.id,
                text: item.name,
                currency: item.currency,
                named: item.unitAmount,
                arrived: line.totalAmount,
                taxRateId: item.taxRateId,
              },
            ]
      })
    )
  }

const createMenuOrderDecidedError = defineError("MenuOrderDecided")<{
  readonly billId: BillId
}>()
export type MenuOrderDecidedError = ReturnType<
  typeof createMenuOrderDecidedError
>

const createWrittenOrderLineNotFoundError = defineError(
  "WrittenOrderLineNotFound"
)<{ readonly lineId: BillLineId }>()
export type WrittenOrderLineNotFoundError = ReturnType<
  typeof createWrittenOrderLineNotFoundError
>

const createTaxRateNotOfferedError = defineError("TaxRateNotOffered")<{
  readonly taxRateId: TaxRateId
}>()
export type TaxRateNotOfferedError = ReturnType<
  typeof createTaxRateNotOfferedError
>

export const setWrittenOrderLineTaxRate =
  ({
    billId,
    lineId,
    taxRateId,
  }: {
    readonly billId: BillId
    readonly lineId: BillLineId
    readonly taxRateId: TaxRateId
  }): Task<
    void,
    | MenuOrderDecidedError
    | WrittenOrderLineNotFoundError
    | TaxRateNotOfferedError,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const [order] = await run.deps.evolu.loadQuery(
      menuOrderByBillIdQuery(billId)
    )
    if (order === undefined || order.pointer === null) {
      return err(createWrittenOrderLineNotFoundError({ lineId }))
    }
    if (order.acceptedAt !== null || order.rejectedAt !== null) {
      return err(createMenuOrderDecidedError({ billId }))
    }
    const lines = await run.ok(
      loadWrittenOrderLines({ billId, pointer: order.pointer })
    )
    const line = lines.find(({ id }) => id === lineId)
    if (line === undefined) {
      return err(createWrittenOrderLineNotFoundError({ lineId }))
    }
    const rates = await run.deps.evolu.loadQuery(taxRatesQuery)
    if (
      !filterSelectableTaxRates(rates, line.taxRateId).some(
        ({ id }) => id === taxRateId
      )
    ) {
      return err(createTaxRateNotOfferedError({ taxRateId }))
    }
    const snapshot = createStandaloneItemSnapshot({
      catalogItemId: null,
      name: NonEmptyString255(line.text),
      description: null,
      currency: line.currency,
      unitAmount: NonNegativeInteger(line.named),
      taxRateId,
    })
    await runMutationWithCompletion((options) => {
      const owned = { ...options, owner: run.deps.evoluOwner }
      upsertItemSnapshot(run.deps.evolu, snapshot, owned)
      updateBillLineItem(run.deps.evolu, lineId, snapshot.id, owned)
    })
    return ok()
  }

export const deriveRememberedCatalogItemId = (
  lineId: BillLineId
): CatalogItemId => createIdFromString<"CatalogItem">(`remembered:${lineId}`)

export const rememberWrittenItemForToday =
  ({
    billId,
    lineId,
    name,
    unitAmount,
  }: {
    readonly billId: BillId
    readonly lineId: BillLineId
    readonly name: NonEmptyString255
    readonly unitAmount: NonNegativeInteger
  }): Task<
    CatalogItemId,
    WrittenOrderLineNotFoundError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const [[order], [settings]] = await Promise.all(
      run.deps.evolu.loadQueries([
        menuOrderByBillIdQuery(billId),
        selfPaySettingsQuery,
      ])
    )
    if (order === undefined || order.pointer === null) {
      return err(createWrittenOrderLineNotFoundError({ lineId }))
    }
    const lines = await run.ok(
      loadWrittenOrderLines({ billId, pointer: order.pointer })
    )
    const line = lines.find(({ id }) => id === lineId)
    if (line === undefined) {
      return err(createWrittenOrderLineNotFoundError({ lineId }))
    }
    const until = menuDayEndAfter(
      run.deps.date.now(),
      menuDayEndHourOf(settings)
    )
    return ok(
      await run.ok(
        putCatalogItemInMenuUntil({
          id: deriveRememberedCatalogItemId(lineId),
          name,
          currency: line.currency,
          unitAmount,
          taxRateId: line.taxRateId,
          inMenuUntil: TimestampMs(until.getTime()),
        })
      )
    )
  }

export interface WrittenOrderRest {
  readonly lineId: BillLineId
  readonly totalAmount: NonNegativeInteger
}

export const raiseWrittenOrderLines = ({
  lines,
  coveredBefore,
  amount,
}: {
  readonly lines: ReadonlyArray<Pick<WrittenOrderLineRow, "id" | "named">>
  readonly coveredBefore: number
  readonly amount: number
}): ReadonlyArray<WrittenOrderRest> | null => {
  const named = lines.map((line) => line.named)
  if (coveredBefore >= named.reduce((sum, value) => sum + value, 0)) {
    return null
  }
  const filled = fillWrittenOrderLines(named, coveredBefore + amount)
  return lines.map(({ id }, index) => ({
    lineId: id,
    totalAmount: NonNegativeInteger(filled[index] ?? 0),
  }))
}

export interface WrittenOrderToServe {
  readonly lines: ReadonlyArray<
    Pick<WrittenOrderLineRow, "id" | "text" | "taxRateId"> & {
      readonly arrived: Money
      readonly named: Money
    }
  >
  readonly arrived: Money
  readonly named: Money
}

const toServePayment = (
  order: WrittenOrderColumns,
  writtenLines: ReadonlyArray<WrittenOrderLineRow>,
  { claimedSum, coverage }: BillCoverageSummary
): Pick<MenuOrderToServe, "written" | "isFullyPaid"> => {
  const written = writtenOrderOf(order)
  const money = (value: number): Money => ({
    value: Integer(value),
    currency: order.currency,
  })
  return written === null
    ? { written: null, isFullyPaid: coverage !== "underpaid" }
    : {
        written: {
          lines: writtenLines.map(({ named, arrived, currency, ...line }) => ({
            ...line,
            named: money(named),
            arrived: money(arrived),
          })),
          arrived: written.arrived,
          named: written.named,
        },
        isFullyPaid: claimedSum >= written.named.value,
      }
}

export interface MenuOrderToServe {
  readonly id: MenuOrderId
  readonly billId: BillId
  readonly number: number
  readonly tableName: string | null
  readonly createdAt: string
  readonly note: string | null
  readonly written: WrittenOrderToServe | null
  readonly isFullyPaid: boolean
  readonly isAccepted: boolean
  readonly lines: ReadonlyArray<{
    readonly id: BillLineSummaryId
    readonly name: string
    readonly quantity: number
    readonly isSoldOut: boolean
  }>
}

export const loadMenuOrdersToServe =
  (): Task<ReadonlyArray<MenuOrderToServe>, never, EvoluDep> => async (run) => {
    const [orders, tables, catalogItems] = await Promise.all(
      run.deps.evolu.loadQueries([
        menuOrdersToServeQuery,
        tablesQuery,
        catalogItemsQuery,
      ])
    )
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]))
    const tableNames = new Map(tables.map(({ id, name }) => [id, name]))
    return ok(
      await Promise.all(
        orders.map(async (order) => {
          const [summaries, coverage, writtenLines] = await Promise.all([
            run.ok(loadCalculatedBillLineSummaries(order.billId)),
            run.ok(loadBillCoverage(order.billId)),
            order.writtenAmount === null
              ? []
              : run.ok(loadWrittenOrderLines(order)),
          ])
          return {
            id: order.id,
            billId: order.billId,
            number: order.number,
            tableName:
              order.tableId === null
                ? null
                : (tableNames.get(order.tableId) ?? null),
            createdAt: order.createdAt,
            note: order.note,
            ...toServePayment(order, writtenLines, coverage),
            isAccepted: order.acceptedAt !== null,
            lines: summaries.map((summary) => {
              const catalogItem =
                summary.catalogItemId === null
                  ? undefined
                  : catalogById.get(summary.catalogItemId)
              return {
                id: summary.id,
                name:
                  catalogItem === undefined
                    ? summary.name
                    : getStaffDisplayName(catalogItem),
                quantity: summary.quantity,
                isSoldOut:
                  catalogItem !== undefined && catalogItem.soldOut !== null,
              }
            }),
          }
        })
      )
    )
  }

export interface MenuOrderNotFoundYet {
  readonly id: AccountTransactionId
  readonly amount: Integer
  readonly currency: Currency
  readonly occurredAt: TimestampMs
  readonly rejectedOrderNumber: number | null
}

export const loadMenuOrdersNotFoundYet =
  (): Task<ReadonlyArray<MenuOrderNotFoundYet>, never, EvoluDep & DateDep> =>
  async (run) => {
    const rows = await run.deps.evolu.loadQuery(
      unclaimedIncomingTransactionsSinceQuery(
        DateIso.orThrow(
          subDays(run.deps.date.now(), ORDER_LOOKUP_DAYS).toISOString()
        )
      )
    )
    const unmatched = rows.flatMap((row) => {
      const reference = SelfPayReferenceSchema.safeParse(row.variableSymbol)
      const pointer = parseSelfPayBankMessage(row.recipientMessage)?.pointer
      return reference.success &&
        isOrderSelfPayReference(reference.data) &&
        pointer !== undefined &&
        row.amount !== null &&
        row.currency !== null &&
        row.occurredAt !== null
        ? [
            {
              id: row.id,
              amount: row.amount,
              currency: row.currency,
              occurredAt: row.occurredAt,
              pointer,
            },
          ]
        : []
    })
    const rejected = await run.deps.evolu.loadQuery(
      rejectedMenuOrdersByPointerQuery(unmatched.map(({ pointer }) => pointer))
    )
    const rejectedNumbers = new Map(
      rejected.map(({ pointer, number }) => [pointer, number])
    )
    return ok(
      unmatched.map(({ pointer, ...entry }) => ({
        ...entry,
        rejectedOrderNumber: rejectedNumbers.get(pointer) ?? null,
      }))
    )
  }
