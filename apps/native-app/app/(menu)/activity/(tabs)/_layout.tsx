import { Slot } from "expo-router"
import { ActivityLayout } from "../../../../src/features/activity/activity-layout.tsx"

/**
 * Activity's three root screens under one header and one set of tabs: the
 * group keeps them a single tab of the menu's tabs navigator
 * (`app/(menu)/_layout.tsx`), so a switch between them swaps the screen in
 * this layout instead of building the whole tab again.
 */
export default function ActivityTabsLayout() {
  return (
    <ActivityLayout>
      <Slot />
    </ActivityLayout>
  )
}
