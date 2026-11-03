import { usePathname } from "expo-router"
import { createContext, type ReactNode, useContext } from "react"
import { Platform, useWindowDimensions } from "react-native"
import { View } from "tamagui"
import { maxWidth } from "../theme/tokens.ts"

/** Web's `lg` breakpoint, from which home and the bill use the window's width. */
const WIDE_WINDOW_PX = 1024

/** The empty width on each side of the column; 0 on native and at full width. */
const GutterContext = createContext(0)

/**
 * On web, the screens in a centered column as web-app's `PhoneViewport`
 * (`max-w-xl`), except home and the bill on a wide window, as the
 * `lg:max-w-none` of their routes there; home's keypad and onboarding narrow
 * themselves as on web. Native screens take the device's width. Beside the
 * menu's sidebar the column centres in what the sidebar leaves.
 */
export function WebColumn({
  children,
  reservedWidth = 0,
}: {
  readonly children: ReactNode
  /** Window width beside the column taken by something else, the menu's sidebar. */
  readonly reservedWidth?: number
}) {
  const pathname = usePathname()
  const windowWidth = useWindowDimensions().width
  if (Platform.OS !== "web") return children
  const fullWidth =
    windowWidth >= WIDE_WINDOW_PX && (pathname === "/" || pathname === "/bill")
  const gutter = fullWidth
    ? 0
    : Math.max(0, (windowWidth - reservedWidth - maxWidth.xl) / 2)
  return (
    <View flex={1} bg="background">
      <View
        flex={1}
        w="100%"
        self="center"
        maxW={fullWidth ? undefined : maxWidth.xl}
      >
        <GutterContext value={gutter}>{children}</GutterContext>
      </View>
    </View>
  )
}

/**
 * For a screen's scroll view, which on web spans the window, as web-app's
 * page scroll does, so its scrollbar sits at the window's edge rather than
 * beside the column: `style` widens it over the gutters (and over `inset`,
 * the horizontal padding of the views around it), `padding` is the
 * horizontal content padding that keeps the content in the column. Without
 * a gutter it changes nothing.
 */
export function useColumnScroll(inset = 0) {
  const gutter = useContext(GutterContext)
  const reach = gutter === 0 ? 0 : gutter + inset
  return {
    style: reach === 0 ? null : { marginHorizontal: -reach },
    padding: reach,
  }
}
