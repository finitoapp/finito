import { Tabs } from "expo-router"
import { useAtomValue } from "jotai"
import { Fragment, type ReactNode, useCallback } from "react"
import { evoluCounterAtom } from "../../src/atoms/evolu-counter.ts"

/** The root layout draws the bar and the rail itself (`MenuBar`, `MenuNav`). */
const noTabBar = () => null

const screenOptions = {
  headerShown: false,
  // A tab switch swaps the screen at once (navigation/0001, navigation/0006).
  animation: "none",
} as const

/**
 * The root screens of the four tabs (navigation/0004), each kept mounted
 * once opened, so switching back to a tab shows it as it was left instead
 * of building it again (navigation/0006). A tab is first built when it is
 * first opened (`lazy`, the default); while another tab shows, React's
 * `Activity` hides it, which keeps its state and its rendered tree and
 * runs its effects' cleanups, so a hidden tab subscribes to nothing and
 * keeps no timer going. Back from any tab returns to home, the first, as
 * the menu section is left the way it was entered (navigation/0001).
 *
 * Each tab is built again when the app Evolu client is (an account switch,
 * an account added or removed, the demo data): a hidden tab hears no atom
 * while its effects are cleaned up, so shown again it would render once
 * more with the client just disposed. The key sits in `screenLayout`,
 * outside the `Activity` that hides the tab, where it is always heard.
 *
 * The screens a tab opens (a setting, a payment's detail, the bill) stay on
 * the root stack above this navigator, with Back and their transition.
 */
export default function MenuTabsLayout() {
  const accountVersion = useAtomValue(evoluCounterAtom)
  const screenLayout = useCallback(
    ({ children }: { readonly children: ReactNode }) => (
      <Fragment key={accountVersion}>{children}</Fragment>
    ),
    [accountVersion]
  )
  return (
    <Tabs
      tabBar={noTabBar}
      backBehavior="firstRoute"
      activityEnabled
      screenOptions={screenOptions}
      screenLayout={screenLayout}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity/(tabs)" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
