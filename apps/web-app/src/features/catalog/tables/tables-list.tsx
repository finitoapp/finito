import { sqliteTrue } from "@evolu/common"
import { tablesPageQuery } from "@payky/core/modules/table/table-queries"
import { QrCodeIcon, Table2Icon } from "lucide-react"
import { useCallback } from "react"
import { Badge } from "@/components/ui/badge.tsx"
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
        label: (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {table.name}
            {table.selfPayEnabled === sqliteTrue && (
              <Badge variant="secondary">
                <QrCodeIcon data-icon="inline-start" />
                {t("catalog.tables.selfPay.title")}
              </Badge>
            )}
          </span>
        ),
        action: (
          <span className="text-sm font-medium text-muted-foreground">
            {t("catalog.tables.seatCount", { value: table.seatCount })}
          </span>
        ),
      })}
    />
  )
}
