import { useTranslation } from "../../../hooks/use-translation.ts"
import { CatalogListShell } from "../catalog-list-parts.tsx"
import { PosOverviewPage } from "./pos-overview-page.tsx"

/**
 * Sales, the catalog tab's only screen (navigation/0003): web's pos mode of
 * home, the tables and open bills, in the frame the items and tables lists
 * share. Nothing to add here: a bill starts from a tile or the "no table"
 * strip; items and tables are set up under Settings.
 */
export function SalesPage() {
  const { t } = useTranslation()
  return (
    <CatalogListShell title={t("nav.pos")} addLabel="" startAddon={null}>
      <PosOverviewPage />
    </CatalogListShell>
  )
}
