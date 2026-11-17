import { useEffect, useState } from "react"
import { Animated, StyleSheet } from "react-native"
import { type GetProps, styled, useTheme, View } from "tamagui"
import { radius } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/skeleton.tsx`: `animate-pulse
 * rounded-md bg-muted`. The pulse (opacity 1 → 0.5 and back, 2 s, as
 * Tailwind's) runs on RN `Animated` with the native driver. It animates a
 * plain `Animated.View` filling the frame rather than an animated Tamagui view:
 * Animated hands its component a style array, which Tamagui passes to the
 * DOM as is on web, where it crashes the render.
 */

const SkeletonFrame = styled(View, {
  name: "Skeleton",
  rounded: radius.md,
  overflow: "hidden",
})

export function Skeleton(props: GetProps<typeof SkeletonFrame>) {
  const theme = useTheme()
  const [opacity] = useState(() => new Animated.Value(1))
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [opacity])
  return (
    <SkeletonFrame
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.muted?.val, opacity },
        ]}
      />
    </SkeletonFrame>
  )
}
