import { Slot } from "expo-router"
import { ActivityLayout } from "../../../src/features/activity/activity-layout.tsx"

/**
 * Activity's three root screens under one header and one set of tabs: the
 * group keeps them a single stack entry, so a tab switch swaps the screen
 * in this layout instead of animating a new one in.
 */
export default function ActivityTabsLayout() {
  return (
    <ActivityLayout>
      <Slot />
    </ActivityLayout>
  )
}
