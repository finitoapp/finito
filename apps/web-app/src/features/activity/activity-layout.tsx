import { Outlet } from "@tanstack/react-router"

import { FadeHeader } from "@/components/fade-header.tsx"
import { ActivityTabs } from "@/features/shared/activity-tabs.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The header and tabs over Activity's three root screens, payments, bills
 * and statistics (navigation/0001). Drawn once by the layout route above
 * them, so switching tabs swaps only what is under the tabs: the tabs stay
 * at one height on all three and their pill slides to the new tab. The
 * tabs scroll away with the page, as the header does.
 */
export function ActivityLayout() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("activity.title")} startAddon={null} />

      <div className="flex flex-col gap-6">
        <ActivityTabs />
        <Outlet />
      </div>
    </>
  )
}
