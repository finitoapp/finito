import type { ViewStyle } from "react-native"
import type { EdgeInsets } from "react-native-safe-area-context"

export type SafeAreaEdge = keyof EdgeInsets

const sidePadding = {
  top: ["paddingTop", "paddingVertical"],
  bottom: ["paddingBottom", "paddingVertical"],
  left: ["paddingLeft", "paddingHorizontal"],
  right: ["paddingRight", "paddingHorizontal"],
} as const satisfies Record<
  SafeAreaEdge,
  readonly [keyof ViewStyle, keyof ViewStyle]
>

const numberOr0 = (value: unknown): number =>
  typeof value === "number" ? value : 0

/**
 * The padding `SafeAreaView` lays its view out with: the style's own
 * padding on each side (the most specific of `paddingTop`,
 * `paddingVertical`, `padding`), plus the inset on each of `edges`, as
 * react-native-safe-area-context's own view adds them. Only numeric padding
 * is added to; the screens pad in numbers.
 */
export const safeAreaPadding = (
  style: ViewStyle,
  insets: EdgeInsets,
  edges: ReadonlyArray<SafeAreaEdge>
): Pick<
  ViewStyle,
  "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight"
> =>
  Object.fromEntries(
    edges.map((edge) => {
      const [side, axis] = sidePadding[edge]
      const own = style[side] ?? style[axis] ?? style.padding
      return [side, numberOr0(own) + insets[edge]]
    })
  )
