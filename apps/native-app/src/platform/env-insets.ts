import type { EdgeInsets } from "react-native-safe-area-context"

type Padding = Pick<
  CSSStyleDeclaration,
  "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
>

const toPixels = (value: string): number => {
  const pixels = Number.parseFloat(value)
  return Number.isFinite(pixels) && pixels > 0 ? pixels : 0
}

/** The insets a probe padded by `env(safe-area-inset-*)` computes to. */
export const insetsFromPadding = (padding: Padding): EdgeInsets => ({
  top: toPixels(padding.paddingTop),
  right: toPixels(padding.paddingRight),
  bottom: toPixels(padding.paddingBottom),
  left: toPixels(padding.paddingLeft),
})

export const sameInsets = (a: EdgeInsets, b: EdgeInsets): boolean =>
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.left === b.left
