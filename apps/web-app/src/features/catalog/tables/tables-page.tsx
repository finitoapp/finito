import { tablesExistQuery } from "@payky/core/modules/table/table-queries"
import { type ReactNode, Suspense, useState } from "react"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import { SearchInput } from "@/components/search-input.tsx"
import { CatalogListPage } from "@/features/catalog/catalog-list-page.tsx"
import { SelfPayOptionsCard } from "@/features/catalog/tables/self-pay-options-card.tsx"
import { TablesList } from "@/features/catalog/tables/tables-list.tsx"
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function TablesPage() {
  const { t } = useTranslation()

  return (
    <CatalogListPage
      tab="tables"
      title={t("catalog.tables.title")}
      addAriaLabel={t("catalog.tables.add")}
      addTo="/catalog/tables/new"
    >
      <TablesSettingsBody />
    </CatalogListPage>
  )
}

function TablesSettingsBody() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)

  const searchInput = (
    <SearchInput
      value={search}
      onChange={setSearch}
      placeholder={t("catalog.tables.search")}
      clearAriaLabel={t("catalog.tables.search.clear.aria")}
    />
  )

  return (
    <Suspense
      fallback={
        <>
          {searchInput}
          <ListSkeleton />
        </>
      }
    >
      <TablesSettingsContent
        searchInput={searchInput}
        search={debouncedSearch}
      />
    </Suspense>
  )
}

function TablesSettingsContent({
  searchInput,
  search,
}: {
  readonly searchInput: ReactNode
  readonly search: string
}) {
  const { data: existRows } = useEvoluQuery(tablesExistQuery)
  const hasAny = existRows.length > 0

  return (
    <>
      {hasAny && <SelfPayOptionsCard />}
      {hasAny && searchInput}

      <Suspense fallback={<ListSkeleton />}>
        <TablesList search={search} hasAny={hasAny} />
      </Suspense>
    </>
  )
}
