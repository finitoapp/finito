import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { catalogItemsPageQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import type { CategoryFilter } from "@payky/core/modules/catalog-item/catalog-item-types"
import { getStaffDisplayName } from "@payky/core/modules/catalog-item/catalog-item-utils"
import { Integer } from "@payky/core/modules/shared/schema"
import { ChevronRight, TagIcon } from "lucide-react"
import { useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge.tsx"
import { CatalogEntityList } from "@/features/catalog/catalog-entity-list.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

export function ItemsList({
  search,
  categoryFilter,
  hasAny,
  categories,
}: {
  readonly search: string
  readonly categoryFilter: CategoryFilter
  readonly hasAny: boolean
  readonly categories: ReadonlyArray<{
    readonly id: CatalogCategoryId
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
      hasAny={hasAny}
      emptyTitle={t("catalog.items.empty.title")}
      emptyDescription={t("catalog.items.empty.description")}
      emptySearchLabel={t("catalog.items.emptySearch")}
      renderItem={(item) => ({
        id: item.id,
        kind: "link" as const,
        to: "/catalog/items/$catalogItemId",
        params: { catalogItemId: item.id },
        icon: <TagIcon className="text-muted-foreground" />,
        label: (
          <span className="flex flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span>{getStaffDisplayName(item)}</span>
              {item.inMenu !== null &&
                (item.soldOut === null ? (
                  <Badge variant="secondary">{t("catalog.items.inMenu")}</Badge>
                ) : (
                  <Badge variant="destructive">
                    {t("catalog.items.soldOut")}
                  </Badge>
                ))}
            </span>
            {item.categoryId !== null &&
              categoryNameById.get(item.categoryId) !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {categoryNameById.get(item.categoryId)}
                </span>
              )}
          </span>
        ),
        action: (
          <span className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {formatMoney(
                { value: Integer(item.unitAmount), currency: item.currency },
                locale
              )}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </span>
        ),
      })}
    />
  )
}
