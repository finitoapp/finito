import type { ReactNode } from "react"
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { type SafeAreaEdge, safeAreaPadding } from "./safe-area-padding.ts"

const allEdges: ReadonlyArray<SafeAreaEdge> = ["top", "right", "bottom", "left"]

/**
 * A view padded by the safe area, in place of react-native-safe-area-context's
 * `SafeAreaView`, with its `edges` and `style`. That one is native and
 * applies its insets on Android only once the view is attached to the
 * window, which a stack screen is after its first layout, so a screen
 * opening could draw a frame without the status bar's inset, its content
 * higher, before settling (Activity's header was seen to jump so). Here the
 * insets come from the provider, which knows them before the first render,
 * so a screen lays out once, in place. `safe-area-view.test.ts` keeps the
 * native one out of the app.
 */
export function SafeAreaView({
  edges = allEdges,
  style,
  children,
}: {
  readonly edges?: ReadonlyArray<SafeAreaEdge>
  readonly style?: StyleProp<ViewStyle>
  readonly children?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const flat = StyleSheet.flatten(style) ?? {}
  return (
    <View style={[flat, safeAreaPadding(flat, insets, edges)]}>{children}</View>
  )
}
