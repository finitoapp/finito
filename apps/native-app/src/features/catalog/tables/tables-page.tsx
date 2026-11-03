import {
  tablesExistQuery,
  tablesPageQuery,
} from "@payky/core/modules/table/table-queries"
import Table2 from "lucide-react-native/icons/table-2"
import { Suspense, useCallback, useState } from "react"
import { YStack } from "tamagui"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import { SearchInput } from "../../../components/search-input.tsx"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CatalogEntityList, CatalogListShell } from "../catalog-list-parts.tsx"

/** Tables, as web's `TablesPage`. */
export function TablesPage() {
  const { t } = useTranslation()
  return (
    <CatalogListShell
      tab="tables"
      title={t("catalog.tables.title")}
      addLabel={t("catalog.tables.add")}
      addHref="/catalog/tables/new"
    >
      <TablesSettingsBody />
    </CatalogListShell>
  )
}

function TablesSettingsBody() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const hasAny = useEvoluQuery(tablesExistQuery).data.length > 0

  return (
    <YStack flex={1} gap="3">
      {hasAny && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("catalog.tables.search")}
          clearAriaLabel={t("catalog.tables.search.clear.aria")}
        />
      )}
      <Suspense fallback={<ListSkeleton />}>
        <TablesList search={debouncedSearch} hasAny={hasAny} />
      </Suspense>
    </YStack>
  )
}

function TablesList({
  search,
  hasAny,
}: {
  readonly search: string
  readonly hasAny: boolean
}) {
  const { t } = useTranslation()
  const createPageQuery = useCallback(
    (limit: number) => tablesPageQuery({ search, limit }),
    [search]
  )

  return (
    <CatalogEntityList
      deps={[search]}
      createPageQuery={createPageQuery}
      icon={Table2}
      hasAny={hasAny}
      emptyTitle={t("catalog.tables.empty.title")}
      emptyDescription={t("catalog.tables.empty.description")}
      emptySearchLabel={t("catalog.tables.emptySearch")}
      renderRow={(table) => ({
        id: table.id,
        title: table.name,
        href: `/catalog/tables/${table.id}`,
        trailing: t("catalog.tables.seatCount", { value: table.seatCount }),
      })}
    />
  )
}
