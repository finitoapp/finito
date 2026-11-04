import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { Link, useLocation } from "@tanstack/react-router"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

type ActivityTab = "payments" | "bills" | "stats"

/** The tab a path under `/activity` belongs to; payments for the rest. */
const activityTabOf = (pathname: string): ActivityTab =>
  pathname.startsWith("/activity/bills")
    ? "bills"
    : pathname.startsWith("/activity/stats")
      ? "stats"
      : "payments"

/**
 * The trigger's own active fill, which the sliding indicator replaces: the
 * vendored trigger paints it on `data-active`, so it is cleared here.
 */
const triggerClassName =
  "z-[1] data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent"

/**
 * Navigates between `/activity` (payments), `/activity/bills` and
 * `/activity/stats` (the sales statistics, behind `stats`: the access gate
 * asks for the PIN, access/0010) — each tab is its own route rather than
 * `TabsContent`, so the active tab follows the location and selecting a
 * trigger navigates instead of swapping local state. `ActivityLayout` draws
 * them once above all three, so Base UI's indicator, the active tab's fill,
 * slides from the tab that had it. `replace` keeps switching tabs from
 * stacking up in history, so back always exits the screen instead of
 * rewinding through tabs, and without a view transition the screen stays
 * put while only the indicator moves.
 */
export function ActivityTabs() {
  const { t } = useTranslation()
  const active = activityTabOf(useLocation({ select: (l) => l.pathname }))

  return (
    <Tabs value={active}>
      <TabsList className="relative w-full">
        <TabsPrimitive.Indicator className="absolute top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width) rounded-md bg-background shadow-sm transition-[left,width] duration-200 ease-out motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30" />
        <TabsTrigger
          value="payments"
          className={triggerClassName}
          nativeButton={false}
          render={<Link to="/activity" replace viewTransition={false} />}
        >
          {t("activity.tabs.payments")}
        </TabsTrigger>
        <TabsTrigger
          value="bills"
          className={triggerClassName}
          nativeButton={false}
          render={<Link to="/activity/bills" replace viewTransition={false} />}
        >
          {t("activity.tabs.bills")}
        </TabsTrigger>
        <TabsTrigger
          value="stats"
          className={triggerClassName}
          nativeButton={false}
          render={<Link to="/activity/stats" replace viewTransition={false} />}
        >
          {t("activity.tabs.stats")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
