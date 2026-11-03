import { router } from "expo-router"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

export type CatalogTab = "items" | "categories" | "tables"

const catalogTabHrefs = {
  items: "/catalog/items",
  categories: "/catalog/categories",
  tables: "/catalog/tables",
} as const satisfies Record<CatalogTab, string>

/**
 * The catalog's three lists, as web's `CatalogTabs` and `ActivityShell`'s
 * tabs: each list is its own route, and switching replaces rather than
 * pushes, so the menu's Home still leaves the section
 * (navigation/0001).
 */
export function CatalogTabs({ active }: { readonly active: CatalogTab }) {
  const { t } = useTranslation()
  const go = (tab: CatalogTab) => {
    if (tab !== active) router.replace(catalogTabHrefs[tab])
  }

  return (
    <Tabs value={active}>
      <TabsList>
        <TabsTrigger value="items" onPress={() => go("items")}>
          {t("catalog.items.title")}
        </TabsTrigger>
        <TabsTrigger value="categories" onPress={() => go("categories")}>
          {t("catalog.categories.title")}
        </TabsTrigger>
        <TabsTrigger value="tables" onPress={() => go("tables")}>
          {t("catalog.tables.title")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
