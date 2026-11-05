import { usePathname } from "expo-router"
import { type ReactNode, Suspense, useState } from "react"
import { View, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { MenuBarSpacer } from "../../components/menu-nav.tsx"
import {
  screenPaddingX,
  useScrollAwayHeaderInset,
} from "../../components/screen.tsx"
import { ScrollAwayHeader } from "../../components/scroll-away-header.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { type ActivityTab, ActivityTabs } from "../shared/activity-tabs.tsx"

/**
 * The tab a path under `/activity` belongs to: the screen itself, or the
 * root a detail beside it opened from (the master pane, navigation/0002).
 */
const activityTabOf = (pathname: string): ActivityTab =>
  pathname.startsWith("/activity/bills")
    ? "bills"
    : pathname.startsWith("/activity/stats")
      ? "stats"
      : "payments"

/** The lists' placeholder, below the header as the list will be. */
function ActivityFallback() {
  const headerInset = useScrollAwayHeaderInset()
  return (
    <YStack pt={headerInset ?? 0} px={screenPaddingX}>
      <ListSkeleton rows={5} />
    </YStack>
  )
}

/**
 * Web `apps/web-app/src/features/activity/activity-layout.tsx`: the header
 * and tabs over Activity's three root screens, payments, bills and
 * statistics (navigation/0001), mounted once by `app/activity/(tabs)` so
 * switching tabs swaps only the screen under them: the tabs keep one
 * height on all three and their pill slides to the new tab. The header's
 * start stays empty, as on every root screen of the menu section, whose
 * Home entry leads out. As on web, header and tabs scroll away with the
 * screen under them (`ScrollAwayHeader`).
 *
 * A pressed tab answers at once: its pill slides and the placeholder
 * replaces the screen in the same frame, while the route takes a few more
 * (Expo Router queues the replace, then the root layout re-renders) and the
 * new screen then loads behind the same placeholder. The screens stay
 * mounted, only hidden, meanwhile: they hold the tabs' navigator, and
 * without it mounted Expo Router would replace the whole Activity route on
 * the root stack, which animates the entire screen in. Any route change,
 * Back included, brings the selection in line with the route again.
 */
export function ActivityLayout({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation()
  const routed = activityTabOf(usePathname())
  const [selected, setSelected] = useState(routed)
  const [lastRouted, setLastRouted] = useState(routed)
  if (routed !== lastRouted) {
    setLastRouted(routed)
    setSelected(routed)
  }
  const switching = selected !== routed

  return (
    <ScrollAwayHeader
      resetKey={selected}
      footer={<MenuBarSpacer />}
      header={
        <>
          <FadeHeader title={t("activity.title")} startAddon={null} />
          <ActivityTabs active={selected} onSelect={setSelected} />
        </>
      }
    >
      {switching ? <ActivityFallback /> : null}
      <View flex={1} display={switching ? "none" : "flex"}>
        <Suspense fallback={<ActivityFallback />}>{children}</Suspense>
      </View>
    </ScrollAwayHeader>
  )
}
