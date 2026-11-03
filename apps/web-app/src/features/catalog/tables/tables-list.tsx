import { tablesPageQuery } from "@payky/core/modules/table/table-queries"
import { Table2Icon } from "lucide-react"
import { useCallback } from "react"
import { CatalogEntityList } from "@/features/catalog/catalog-entity-list.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

export function TablesList({
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
      hasAny={hasAny}
      emptyTitle={t("catalog.tables.empty.title")}
      emptyDescription={t("catalog.tables.empty.description")}
      emptySearchLabel={t("catalog.tables.emptySearch")}
      renderItem={(table) => ({
        id: table.id,
        kind: "link" as const,
        to: "/catalog/tables/$tableId",
        params: { tableId: table.id },
        icon: <Table2Icon className="text-muted-foreground" />,
        label: table.name,
        action: (
          <span className="text-sm font-medium text-muted-foreground">
            {t("catalog.tables.seatCount", { value: table.seatCount })}
          </span>
        ),
      })}
    />
  )
}
