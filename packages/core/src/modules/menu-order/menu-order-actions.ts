import {
  createIdFromString,
  DateIso,
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
import { unclaimedIncomingTransactionsSinceQuery } from "../account-transaction/account-transaction-queries.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import { settingsQuery } from "../app-settings/app-settings-queries.ts"
import { getFiatCurrency } from "../app-settings/app-settings-utils.ts"
import {
  loadNextBillDisplayNumber,
  type MenuOrderBillRows,
} from "../bill/bill-actions.ts"
import { loadBillCoverage } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { BillLineRow } from "../bill-line/bill-line.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import type { BillLineSummaryId } from "../bill-line/bill-line-types.ts"
import { createBillLineSummaryId } from "../bill-line/bill-line-utils.ts"
import { catalogCategoriesQuery } from "../catalog-category/catalog-category-queries.ts"
import { catalogItemsQuery } from "../catalog-item/catalog-item-queries.ts"
import { getStaffDisplayName } from "../catalog-item/catalog-item-utils.ts"
import type { DeviceId } from "../device/device-types.ts"
import { createStandaloneItemSnapshot } from "../item/item-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { deriveTableSelfPayKeys } from "../shared/key-derivation.ts"
import {
  type Currency,
  DateStringSchema,
  type Integer,
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
import type { MenuOrderRow } from "./menu-order.ts"
import {
  lastMenuOrderNumberQuery,
  menuOrdersToServeQuery,
  menuVersionByIdQuery,
  menuVersionsNewestFirstQuery,
} from "./menu-order-queries.ts"
import type { MenuOrderId } from "./menu-order-types.ts"
import {
  buildSelfPayMenu,
  countSelfPayMenuItems,
  deriveSelfPayMenuItemKey,
  fitSelfPayMenuIntoEvent,
  isOfferedInMenu,
  MenuJson,
  priceSelfPayOrder,
  type SelfPayMenu,
  type SelfPayOrderSelection,
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
  (): Task<SelfPayMenuSnapshot, never, EvoluDep> => async (run) => {
    const [items, categories, [settings]] = await Promise.all(
      run.deps.evolu.loadQueries([
        catalogItemsQuery,
        catalogCategoriesQuery,
        settingsQuery,
      ])
    )
    const currency = getFiatCurrency(settings)
    const full = buildSelfPayMenu({ items, categories, currency })
    const menu = fitSelfPayMenuIntoEvent(full)
    return ok({
      menu,
      leftOut: countSelfPayMenuItems(full) - countSelfPayMenuItems(menu),
      otherCurrency: items.filter(
        (item) => isOfferedInMenu(item) && item.currency !== currency
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

export interface MenuOrderArrivalRows {
  readonly bill: MenuOrderBillRows
  readonly reference: SelfPayReference
  readonly menuOrder: Omit<MenuOrderRow, "servedAt">
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

export const loadMenuOrderArrivalRows =
  ({
    pointer,
    reference,
    selection,
    deviceId,
    root,
  }: {
    readonly pointer: SelfPayPointer
    readonly reference: SelfPayReference
    readonly selection: SelfPayOrderSelection
    readonly deviceId: DeviceId
    readonly root: Uint8Array
  }): Task<MenuOrderArrivalRows | null, never, EvoluDep & DateDep> =>
  async (run) => {
    const menu = await run.ok(loadSelfPayMenuVersion(selection.menu))
    if (menu === null || menu.version !== selection.menu) return ok(null)
    const priced = priceSelfPayOrder(menu, selection.items)
    if (priced === null) return ok(null)

    const [tables, catalogItems] = await Promise.all(
      run.deps.evolu.loadQueries([selfPayTablesQuery, catalogItemsQuery])
    )
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
    const catalogByKey = new Map(
      catalogItems.map((item) => [deriveSelfPayMenuItemKey(item.id), item])
    )
    const ordered = priced.lines.map(({ item, quantity, totalAmount }) => {
      const catalogItem = catalogByKey.get(item.key)
      const snapshot = createStandaloneItemSnapshot({
        catalogItemId: catalogItem?.id ?? null,
        name: NonEmptyString255(item.name),
        description:
          item.description === null
            ? null
            : NonEmptyString255(item.description),
        currency: menu.currency,
        unitAmount: NonNegativeInteger(item.unitAmount),
        taxRateId: catalogItem?.taxRateId ?? null,
      })
      const type = catalogItem === undefined ? "manualAmount" : "catalogItem"
      const line: BillLineRow = {
        id: createIdFromString<"BillLine">(
          `menu-order-line:${pointer}:${item.key}`
        ),
        billId,
        deviceId,
        catalogItemId: catalogItem?.id ?? null,
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
        allocation: {
          key: deriveSelfPayLineKey(summaryId),
          amount: totalAmount,
        },
      }
    })

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
          selection.note === null ? null : NonEmptyString255(selection.note),
      },
      total: priced.total,
      lines: ordered.map(({ allocation }) => allocation),
    })
  }

export interface MenuOrderToServe {
  readonly id: MenuOrderId
  readonly number: number
  readonly tableName: string | null
  readonly createdAt: string
  readonly note: string | null
  readonly isFullyPaid: boolean
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
          const [summaries, coverage] = await Promise.all([
            run.ok(loadCalculatedBillLineSummaries(order.billId)),
            run.ok(loadBillCoverage(order.billId)),
          ])
          return {
            id: order.id,
            number: order.number,
            tableName:
              order.tableId === null
                ? null
                : (tableNames.get(order.tableId) ?? null),
            createdAt: order.createdAt,
            note: order.note,
            isFullyPaid: coverage.coverage !== "underpaid",
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
    return ok(
      rows.flatMap((row) => {
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
              },
            ]
          : []
      })
    )
  }
