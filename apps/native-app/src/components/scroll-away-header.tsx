import { type ReactNode, useEffect, useState } from "react"
import { Animated } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme, View } from "tamagui"
import {
  ScreenScrollContext,
  ScrollAwayHeaderInsetContext,
  screenPadding,
  screenPaddingX,
} from "./screen.tsx"

/** The space under the header, web's `gap-6` below a page's tabs. */
const headerGap = 24

/**
 * A header shared by sibling screens that swap below it, such as a page's
 * header and tabs over the screens the tabs switch between: mounted once,
 * so it keeps its state and its animations across the switch, and still
 * scrolling away with whichever screen is under it, as if it were the top
 * of that screen's scroll.
 *
 * It floats over the top of the content and moves up as the content
 * scrolls; the scroll below (a `Screen`, or a list that reads
 * `useScrollAwayHeaderInset`) leaves its measured height free and reports
 * its offset through `ScreenScrollContext`, which a `FadeHeader` inside
 * follows as it would inside a `Screen`. Nothing below renders until the
 * header has been measured, so the content never starts under it.
 * `resetKey` is the screen below: a new one starts at the top, so the
 * header comes back with it.
 */
export function ScrollAwayHeader({
  header,
  resetKey,
  children,
}: {
  readonly header: ReactNode
  readonly resetKey: string
  readonly children: ReactNode
}) {
  const theme = useTheme()
  const [scrollY] = useState(() => new Animated.Value(0))
  const [height, setHeight] = useState<number | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new screen below is what resets it.
  useEffect(() => {
    scrollY.setValue(0)
  }, [resetKey, scrollY])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <ScreenScrollContext value={scrollY}>
        <View flex={1}>
          {height === null ? null : (
            <ScrollAwayHeaderInsetContext value={height}>
              {children}
            </ScrollAwayHeaderInsetContext>
          )}
          <Animated.View
            pointerEvents="box-none"
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              paddingTop: screenPadding,
              paddingBottom: headerGap,
              paddingHorizontal: screenPaddingX,
              transform: [{ translateY: Animated.multiply(scrollY, -1) }],
            }}
          >
            {header}
          </Animated.View>
        </View>
      </ScreenScrollContext>
    </SafeAreaView>
  )
}
