import { catalogCategoriesExistQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import { type ReactNode, Suspense, useState } from "react"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import { SearchInput } from "@/components/search-input.tsx"
import { CatalogListPage } from "@/features/catalog/catalog-list-page.tsx"
import { CategoriesList } from "@/features/catalog/categories/categories-list.tsx"
import { useDebouncedValue } from "@/hooks/use-debounced-value.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function CategoriesPage() {
  const { t } = useTranslation()

  return (
    <CatalogListPage
      tab="categories"
      title={t("catalog.categories.title")}
      addAriaLabel={t("catalog.categories.add")}
      addTo="/catalog/categories/new"
    >
      <CategoriesSettingsBody />
    </CatalogListPage>
  )
}

function CategoriesSettingsBody() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)

  const searchInput = (
    <SearchInput
      value={search}
      onChange={setSearch}
      placeholder={t("catalog.categories.search")}
      clearAriaLabel={t("catalog.categories.search.clear.aria")}
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
      <CategoriesSettingsContent
        searchInput={searchInput}
        search={debouncedSearch}
      />
    </Suspense>
  )
}

function CategoriesSettingsContent({
  searchInput,
  search,
}: {
  readonly searchInput: ReactNode
  readonly search: string
}) {
  const { data: existRows } = useEvoluQuery(catalogCategoriesExistQuery)
  const hasAny = existRows.length > 0

  return (
    <>
      {hasAny && searchInput}

      <Suspense fallback={<ListSkeleton />}>
        <CategoriesList search={search} hasAny={hasAny} />
      </Suspense>
    </>
  )
}
