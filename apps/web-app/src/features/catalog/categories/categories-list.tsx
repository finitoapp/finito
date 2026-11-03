import { catalogCategoriesPageQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import { FolderIcon } from "lucide-react"
import { useCallback } from "react"
import { CatalogEntityList } from "@/features/catalog/catalog-entity-list.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

export function CategoriesList({
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
      hasAny={hasAny}
      emptyTitle={t("catalog.categories.empty.title")}
      emptyDescription={t("catalog.categories.empty.description")}
      emptySearchLabel={t("catalog.categories.emptySearch")}
      renderItem={(category) => ({
        id: category.id,
        kind: "link" as const,
        to: "/catalog/categories/$catalogCategoryId",
        params: { catalogCategoryId: category.id },
        icon: <FolderIcon className="text-muted-foreground" />,
        label: category.name,
      })}
    />
  )
}
