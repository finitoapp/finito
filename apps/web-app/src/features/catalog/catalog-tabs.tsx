import { Link } from "@tanstack/react-router"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

export type CatalogTab = "items" | "categories" | "tables"

/**
 * Navigates between the catalog's three lists, each its own route like
 * `ActivityTabs`: `value` only marks the active trigger, and `replace` keeps
 * switching lists from stacking up in history, so the menu's Home still
 * leaves the section (navigation/0001).
 */
export function CatalogTabs({ active }: { readonly active: CatalogTab }) {
  const { t } = useTranslation()

  return (
    <Tabs value={active}>
      <TabsList className="w-full">
        <TabsTrigger
          value="items"
          nativeButton={false}
          render={<Link to="/catalog/items" replace />}
        >
          {t("catalog.items.title")}
        </TabsTrigger>
        <TabsTrigger
          value="categories"
          nativeButton={false}
          render={<Link to="/catalog/categories" replace />}
        >
          {t("catalog.categories.title")}
        </TabsTrigger>
        <TabsTrigger
          value="tables"
          nativeButton={false}
          render={<Link to="/catalog/tables" replace />}
        >
          {t("catalog.tables.title")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
