import { router } from "expo-router"
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

export type ActivityTab = "payments" | "bills" | "stats"

const activityTabHrefs = {
  payments: "/activity",
  bills: "/activity/bills",
  stats: "/activity/stats",
} as const satisfies Record<ActivityTab, string>

/**
 * Web `apps/web-app/src/features/shared/activity-tabs.tsx`: Activity's
 * payments, bills and statistics (navigation/0001), each its own route;
 * switching replaces rather than pushes, so Back and the menu's Home leave
 * Activity instead of rewinding through tabs. The statistics need `stats`,
 * so the access gate asks for the PIN there (access/0010). `onSelect`
 * hears the tab as it is pressed, before the route follows, so the screen
 * can answer the press at once.
 */
export function ActivityTabs({
  active,
  onSelect,
}: {
  readonly active: ActivityTab
  readonly onSelect: (tab: ActivityTab) => void
}) {
  const { t } = useTranslation()
  const go = (tab: ActivityTab) => {
    if (tab === active) return
    onSelect(tab)
    router.replace(activityTabHrefs[tab])
  }

  return (
    <Tabs value={active}>
      <TabsList>
        <TabsTrigger value="payments" onPress={() => go("payments")}>
          {t("activity.tabs.payments")}
        </TabsTrigger>
        <TabsTrigger value="bills" onPress={() => go("bills")}>
          {t("activity.tabs.bills")}
        </TabsTrigger>
        <TabsTrigger value="stats" onPress={() => go("stats")}>
          {t("activity.tabs.stats")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
