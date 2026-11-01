import { brandName } from "@payky/app-shared/brand"
import { Image, useColorScheme, useWindowDimensions, View } from "react-native"
import appIcon from "../../../assets/app-icon.png"
import { appBrand } from "../../core/app-brand.ts"
import { palette } from "../../theme/palette.ts"

/**
 * Web's `#app-loader` (`apps/web-app/index.html`): the app icon centered at
 * `min(36vw, 11rem)` on the theme background while the app starts. It shows
 * before fonts, Tamagui and the device database (which holds the theme
 * preference) are ready, so it is plain RN on the system scheme's palette
 * background, as web's boot script reads the system scheme.
 *
 * The label is English, as web's: no translations are loaded yet.
 * ponytail: no 420 ms fade-out or drop shadow as web has; add an Animated
 * opacity if the cut to the first screen feels abrupt.
 */
export function AppLoader() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light"
  const { width } = useWindowDimensions()
  const size = Math.min(width * 0.36, 176)
  return (
    <View
      accessible
      role="progressbar"
      aria-label={`Loading ${brandName(appBrand)}`}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette[scheme].background,
      }}
    >
      <Image
        source={appIcon}
        style={{ width: size, height: size, borderRadius: size * 0.15 }}
        accessibilityIgnoresInvertColors
      />
    </View>
  )
}
