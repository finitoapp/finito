import {
  catalogCategoriesExistQuery,
  catalogCategoriesPageQuery,
} from "@payky/core/modules/catalog-category/catalog-category-queries"
import Folder from "lucide-react-native/icons/folder"
import { Suspense, useCallback, useState } from "react"
import { YStack } from "tamagui"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import { SearchInput } from "../../../components/search-input.tsx"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CatalogEntityList, CatalogListShell } from "../catalog-list-parts.tsx"

/** Catalog categories, as web's `CategoriesPage`. */
export function CategoriesPage() {
  const { t } = useTranslation()
  return (
    <CatalogListShell
      tab="categories"
      title={t("catalog.categories.title")}
      addLabel={t("catalog.categories.add")}
      addHref="/catalog/categories/new"
    >
      <CategoriesSettingsBody />
    </CatalogListShell>
  )
}

function CategoriesSettingsBody() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const hasAny = useEvoluQuery(catalogCategoriesExistQuery).data.length > 0

  return (
    <YStack flex={1} gap="3">
      {hasAny && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("catalog.categories.search")}
          clearAriaLabel={t("catalog.categories.search.clear.aria")}
        />
      )}
      <Suspense fallback={<ListSkeleton />}>
        <CategoriesList search={debouncedSearch} hasAny={hasAny} />
      </Suspense>
    </YStack>
  )
}

function CategoriesList({
  search,
  hasAny,
}: {
  readonly search: string
  readonly hasAny: boolean
}) {
  const { t } = useTranslation()
  const createPageQuery = useCallback(
    (limit: number) => catalogCategoriesPageQuery({ search, limit }),
    [search]
  )

  return (
    <CatalogEntityList
      deps={[search]}
      createPageQuery={createPageQuery}
      icon={Folder}
      hasAny={hasAny}
      emptyTitle={t("catalog.categories.empty.title")}
      emptyDescription={t("catalog.categories.empty.description")}
      emptySearchLabel={t("catalog.categories.emptySearch")}
      renderRow={(category) => ({
        id: category.id,
        title: category.name,
        href: `/catalog/categories/${category.id}`,
      })}
    />
  )
}
