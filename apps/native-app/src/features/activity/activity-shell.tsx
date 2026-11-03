import {
  createContext,
  type ReactElement,
  type ReactNode,
  Suspense,
  useContext,
  useState,
} from "react"
import { Animated } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import {
  ScreenScrollContext,
  screenPadding,
  screenPaddingX,
} from "../../components/screen.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { type ActivityTab, ActivityTabs } from "../shared/activity-tabs.tsx"

const ActivityHeaderContext = createContext<ReactElement | null>(null)

/** The header and tabs `ActivityList` draws at the top of its scroll. */
export const useActivityHeader = () => useContext(ActivityHeaderContext)

/**
 * Header and Activity's tabs around a history list, as web's
 * `activity-pages.tsx` and `ActivityTabs`: the header's start stays empty,
 * as on every root screen of the menu section, whose Home entry leads out
 * (navigation/0001), and each tab is its own route;
 * switching replaces rather than pushes, so back always leaves Activity
 * instead of rewinding through tabs.
 *
 * As on web, the header and tabs scroll away with the list: `ActivityList`
 * draws them (`useActivityHeader`) at the top of its own scroll and reports
 * that scroll to `FadeHeader` through `ScreenScrollContext`.
 */
export function ActivityShell({
  active,
  children,
}: {
  readonly active: Exclude<ActivityTab, "stats">
  readonly children: ReactNode
}) {
  const theme = useTheme()
  const { t } = useTranslation()

  const [scrollY] = useState(() => new Animated.Value(0))

  const header = (
    <YStack pb={16}>
      <FadeHeader title={t("activity.title")} startAddon={null} />
      <ActivityTabs active={active} />
    </YStack>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <ScreenScrollContext value={scrollY}>
        <ActivityHeaderContext value={header}>
          <Suspense
            fallback={
              <YStack py={screenPadding} px={screenPaddingX} gap={16}>
                {header}
                <ListSkeleton rows={5} />
              </YStack>
            }
          >
            {children}
          </Suspense>
        </ActivityHeaderContext>
      </ScreenScrollContext>
    </SafeAreaView>
  )
}
