import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import {
  catalogItemsPageQuery,
  catalogItemsQuery,
  catalogItemUsedCategoryIdsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import type { CategoryFilter } from "@payky/core/modules/catalog-item/catalog-item-types"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import { Integer } from "@payky/core/modules/shared/schema"
import { router } from "expo-router"
import Tag from "lucide-react-native/icons/tag"
import { Suspense, useCallback, useMemo, useState } from "react"
import { YStack } from "tamagui"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import { SearchInput } from "../../../components/search-input.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { useMasterPane } from "../../../core/master-pane.ts"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../../hooks/use-hardware-scanner.ts"
import { useIsConfirmOpen } from "../../../hooks/use-is-confirm-open.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"
import { CategoryFilterBar } from "../../shared/category-filter-bar.tsx"
import { CatalogEntityList, CatalogListShell } from "../catalog-list-parts.tsx"

/** Catalog items, as web's `ItemsPage`, under Settings (navigation/0003). */
export function ItemsPage() {
  const { t } = useTranslation()
  return (
    <CatalogListShell
      title={t("catalog.items.title")}
      addLabel={t("catalog.items.add")}
      addHref="/settings/items/new"
    >
      <ItemsSettingsBody />
    </CatalogListShell>
  )
}

function ItemsSettingsBody() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const debouncedSearch = useDebouncedValue(search, 250)
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  const { data: usedCategoryIdRows } = useEvoluQuery(
    catalogItemUsedCategoryIdsQuery
  )
  const usedCategoryIds = useMemo(
    () => new Set(usedCategoryIdRows.map((row) => row.categoryId)),
    [usedCategoryIdRows]
  )
  const hasAny = usedCategoryIds.size > 0
  const confirmOpen = useIsConfirmOpen()
  // Beside an item's form on a wide window the form owns the scan.
  const inMasterPane = useMasterPane() !== null
  const { data: allItems } = useEvoluQuery(catalogItemsQuery)

  // A scan opens the item it identifies, or a new one carrying the code.
  // Several matches (the code is not unique across devices) are left to the
  // list: searching for the code shows exactly them.
  useHardwareScanner({
    enabled: !confirmOpen && !inMasterPane,
    onScan: (code) => {
      const matches = findCatalogItemsByScanCode(allItems, code)
      const [match] = matches
      // A focused search field received the code's characters too.
      setSearch((current) =>
        current.endsWith(code) ? current.slice(0, -code.length) : current
      )
      if (matches.length > 1) setSearch(code)
      else if (match === undefined)
        router.push({ pathname: "/settings/items/new", params: { scan: code } })
      else
        router.push({
          pathname: "/settings/items/[catalogItemId]",
          params: { catalogItemId: match.id },
        })
    },
  })

  return (
    <YStack flex={1} gap="3">
      {hasAny && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("catalog.items.search")}
          clearAriaLabel={t("catalog.items.search.clear.aria")}
        />
      )}
      <CategoryFilterBar<never>
        categories={categories}
        usedCategoryIds={usedCategoryIds}
        value={categoryFilter}
        onValueChange={setCategoryFilter}
        allLabel={t("catalog.items.category.all")}
        uncategorizedLabel={t("catalog.items.category.uncategorized")}
      />
      <Suspense fallback={<ListSkeleton />}>
        <ItemsList
          search={debouncedSearch}
          categoryFilter={categoryFilter}
          hasAny={hasAny}
          categories={categories}
        />
      </Suspense>
    </YStack>
  )
}

function ItemsList({
  search,
  categoryFilter,
  hasAny,
  categories,
}: {
  readonly search: string
  readonly categoryFilter: CategoryFilter
  readonly hasAny: boolean
  readonly categories: ReadonlyArray<{
    readonly id: string
    readonly name: string
  }>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  )
  const createPageQuery = useCallback(
    (limit: number) => catalogItemsPageQuery({ search, categoryFilter, limit }),
    [search, categoryFilter]
  )

  return (
    <CatalogEntityList
      deps={[search, categoryFilter]}
      createPageQuery={createPageQuery}
      icon={Tag}
      hasAny={hasAny}
      emptyTitle={t("catalog.items.empty.title")}
      emptyDescription={t("catalog.items.empty.description")}
      emptySearchLabel={t("catalog.items.emptySearch")}
      renderRow={(item) => ({
        id: item.id,
        title: getStaffDisplayName(item),
        badge:
          item.inMenu === null ? undefined : item.soldOut === null ? (
            <Badge variant="secondary" label={t("catalog.items.inMenu")} />
          ) : (
            <Badge variant="destructive" label={t("catalog.items.soldOut")} />
          ),
        href: `/settings/items/${item.id}`,
        subtitle:
          item.categoryId === null
            ? undefined
            : categoryNameById.get(item.categoryId),
        trailing: formatMoney(
          { value: Integer(item.unitAmount), currency: item.currency },
          locale
        ),
      })}
    />
  )
}
