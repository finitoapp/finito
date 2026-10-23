import { tablesExistQuery } from "@payky/core/modules/table/table-queries"
import { selfPayTablesQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import { type ReactNode, Suspense, useState } from "react"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import { SearchInput } from "@/components/search-input.tsx"
import { CatalogListPage } from "@/features/catalog/catalog-list-page.tsx"
import { SelfPayGuestNameCard } from "@/features/catalog/tables/self-pay-guest-name-card.tsx"
import { SelfPayOptionsCard } from "@/features/catalog/tables/self-pay-options-card.tsx"
import { TableStickerCheck } from "@/features/catalog/tables/table-sticker-check.tsx"
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
  const { data: selfPayTables } = useEvoluQuery(selfPayTablesQuery)
  const hasAny = existRows.length > 0
  const takesSelfPay = selfPayTables.some(
    ({ selfPayEnabled }) => selfPayEnabled === 1
  )

  return (
    <>
      {hasAny && searchInput}
      {hasAny && <TableStickerCheck />}

      <Suspense fallback={<ListSkeleton />}>
        <TablesList search={search} hasAny={hasAny} />
      </Suspense>
      {takesSelfPay && <SelfPayGuestNameCard />}
      {takesSelfPay && <SelfPayOptionsCard />}
    </>
  )
}
