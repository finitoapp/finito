import type { Evolu } from "@payky/core/evolu/schema"
import { enabledPaymentMethodAccountsQuery } from "@payky/core/modules/account/account-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { claimedPaymentsByBillIdQuery } from "@payky/core/modules/bill/bill-coverage-queries"
import {
  billByIdQuery,
  openBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import {
  catalogItemsPageQuery,
  catalogItemsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import type {
  CatalogItemId,
  CategoryFilter,
} from "@payky/core/modules/catalog-item/catalog-item-types"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { evoluAtom } from "../../atoms/evolu.ts"
import { billStateQueries } from "./use-bill-state.ts"

/**
 * Every query the bill's screen reads whatever the bill holds: its state,
 * the tables and open bills its dialogs read, and the catalog. The screen
 * preloads them itself (`usePreloadEvoluQueries`); the item grid, which
 * needs the bill's currency, is `billGridQuery`.
 */
export const billPageQueries = (billId: BillId) => [
  ...billStateQueries(billId),
  claimedPaymentsByBillIdQuery(billId),
  tablesQuery,
  openBillsQuery,
  settingsQuery,
  enabledPaymentMethodAccountsQuery,
  qerkoPluginQuery("standard"),
  catalogItemsQuery,
  catalogCategoriesQuery,
]

/**
 * The bill's item grid: the whole catalog in one currency, searched,
 * filtered by category or to the given items. Unsearched and unfiltered it
 * keeps each category's items together, as web.
 */
export const billGridQuery = ({
  search,
  categoryFilter,
  currency,
  catalogItemIds,
}: {
  readonly search: string
  readonly categoryFilter: CategoryFilter
  readonly currency: FiatCurrency
  /** Only these items: the "on the bill" filter. */
  readonly catalogItemIds?: ReadonlyArray<CatalogItemId>
}) =>
  catalogItemsPageQuery({
    search,
    categoryFilter,
    currency,
    ...(catalogItemIds === undefined ? {} : { catalogItemIds }),
    groupByCategory:
      catalogItemIds === undefined &&
      categoryFilter === "all" &&
      search.trim() === "",
    // ponytail: no paging, the list is virtualized; raise or page if a
    // catalog ever outgrows this.
    limit: 10_000,
  })

/**
 * The grid in the bill's currency, the settings' for a bill not written
 * yet. Only warms Evolu's cache: the screen loads the same queries and
 * reports a failure itself, so one here is dropped.
 */
const preloadBillGrid = async (evolu: Evolu, billId: BillId): Promise<void> => {
  const [loaded] = await Promise.allSettled([
    Promise.all([
      evolu.loadQuery(billByIdQuery(billId)),
      evolu.loadQuery(settingsQuery),
    ]),
  ])
  if (loaded.status === "rejected") return
  const [[bill], [settings]] = loaded.value
  await Promise.allSettled([
    evolu.loadQuery(
      billGridQuery({
        search: "",
        categoryFilter: "all",
        currency: bill?.currency ?? getFiatCurrency(settings),
      })
    ),
  ])
}

/**
 * Starts loading the bill's screen as the press that opens it lands, as
 * `usePreloadActivity` does for Activity. The grid follows once the bill's
 * currency is known (the settings' for a bill not written yet); both of
 * those come from Evolu's cache when home already reads them.
 */
export function usePreloadBill(): (billId: BillId) => void {
  const evolu = useAtomValue(evoluAtom)
  return useCallback(
    (billId: BillId) => {
      // Only warms Evolu's cache: the screen reads, and reports, the same
      // queries itself.
      void Promise.allSettled(evolu.loadQueries(billPageQueries(billId)))
      void preloadBillGrid(evolu, billId)
    },
    [evolu]
  )
}
