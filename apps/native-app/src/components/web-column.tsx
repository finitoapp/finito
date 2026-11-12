import { usePathname } from "expo-router"
import { createContext, type ReactNode, useContext } from "react"
import { Platform, useWindowDimensions } from "react-native"
import { View } from "tamagui"
import { maxWidth } from "../theme/tokens.ts"

/** Web's `lg` breakpoint, from which home and the bill use the window's width. */
export const WIDE_WINDOW_PX = 1024

/** Web's `2xl` breakpoint, from which the bill's summary panel widens. */
const EXTRA_WIDE_WINDOW_PX = 1536

/**
 * Whether the window is at least web's `lg` wide. From this width the bill
 * draws web's large-monitor layout (the summary in a side panel), on the web
 * and on a wide Android tablet alike.
 */
export function useWideWindow(): boolean {
  return useWindowDimensions().width >= WIDE_WINDOW_PX
}

/**
 * The width of the bill's summary panel on a wide window, as web's
 * `lg:w-100 2xl:w-120`: 400, or 480 from web's `2xl`.
 */
export function useBillSummaryPanelWidth(): number {
  return useWindowDimensions().width >= EXTRA_WIDE_WINDOW_PX ? 480 : 400
}

/** The empty width on each side of the column; 0 on native and at full width. */
const GutterContext = createContext(0)

/** The space between a wide window's master pane and the detail beside it. */
export const paneGap = 24

/**
 * On web, the screens in a centered column as web-app's `PhoneViewport`
 * (`max-w-xl`), except home and the bill on a wide window, as the
 * `lg:max-w-none` of their routes there; home's keypad and onboarding narrow
 * themselves as on web. Native screens take the device's width. Beside the
 * menu's sidebar the column centres in what the sidebar leaves. With
 * `panes` (a root screen beside its detail, navigation/0002) the column is
 * two of them, and each pane scrolls within itself, so no gutter.
 */
export function WebColumn({
  children,
  reservedWidth = 0,
  panes = false,
}: {
  readonly children: ReactNode
  /** Window width beside the column taken by something else, the menu's sidebar. */
  readonly reservedWidth?: number
  /** Two screens side by side: twice the column, no gutters. */
  readonly panes?: boolean
}) {
  const pathname = usePathname()
  const windowWidth = useWindowDimensions().width
  if (Platform.OS !== "web") return children
  const fullWidth =
    windowWidth >= WIDE_WINDOW_PX && (pathname === "/" || pathname === "/bill")
  const columnWidth = panes ? 2 * maxWidth.xl + paneGap : maxWidth.xl
  const gutter =
    fullWidth || panes
      ? 0
      : Math.max(0, (windowWidth - reservedWidth - columnWidth) / 2)
  return (
    <View flex={1} bg="background">
      <View
        flex={1}
        w="100%"
        self="center"
        maxW={fullWidth ? undefined : columnWidth}
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
