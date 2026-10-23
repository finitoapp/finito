import { sqliteTrue } from "@evolu/common"
import {
  tablesExistQuery,
  tablesPageQuery,
} from "@payky/core/modules/table/table-queries"
import { selfPayTablesQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import QrCode from "lucide-react-native/icons/qr-code"
import Table2 from "lucide-react-native/icons/table-2"
import { Suspense, useCallback, useState } from "react"
import { ScrollView } from "react-native"
import { YStack } from "tamagui"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import { SearchInput } from "../../../components/search-input.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { useDebouncedValue } from "../../../hooks/use-debounced-value.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CatalogEntityList, CatalogListShell } from "../catalog-list-parts.tsx"
import { SelfPayGuestNameCard } from "./self-pay-guest-name-card.tsx"
import { TableStickerCheck } from "./table-sticker-check.tsx"

/** Tables, as web's `TablesPage`, under Settings (navigation/0003). */
export function TablesPage() {
  const { t } = useTranslation()
  return (
    <CatalogListShell
      title={t("catalog.tables.title")}
      addLabel={t("catalog.tables.add")}
      addHref="/settings/tables/new"
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
  const takesSelfPay = useEvoluQuery(selfPayTablesQuery).data.some(
    ({ selfPayEnabled }) => selfPayEnabled === sqliteTrue
  )

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <YStack gap="3">
        {hasAny && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("catalog.tables.search")}
            clearAriaLabel={t("catalog.tables.search.clear.aria")}
          />
        )}
        {hasAny && <TableStickerCheck />}
        <Suspense fallback={<ListSkeleton />}>
          <TablesList search={debouncedSearch} hasAny={hasAny} />
        </Suspense>
        {takesSelfPay && <SelfPayGuestNameCard />}
      </YStack>
    </ScrollView>
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
      scrollEnabled={false}
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
        badge:
          table.selfPayEnabled === sqliteTrue ? (
            <Badge
              variant="secondary"
              icon={QrCode}
              label={t("catalog.tables.selfPay.title")}
              testID="table-self-pay-badge"
            />
          ) : undefined,
        href: `/settings/tables/${table.id}`,
        trailing: t("catalog.tables.seatCount", { value: table.seatCount }),
      })}
    />
  )
}
