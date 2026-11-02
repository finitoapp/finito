import { defaultConfig } from "@tamagui/config/v6"
import { createTamagui, isWeb } from "tamagui"
import { appThemes } from "./src/theme/themes"
import { radius } from "./src/theme/tokens"

// The APK carries one Inter face per weight (app.config.ts), which Tamagui
// swaps in by `face`. On web Tamagui sets only the family and the weight,
// so the PWA names the variable Inter it bundles (platform/web-styles.web.ts),
// with sans-serif behind it rather than the browser's serif default.
const inter = {
  family: isWeb ? "'Inter Variable', sans-serif" : "Inter",
  face: {
    400: { normal: "Inter" },
    500: { normal: "InterMedium" },
    600: { normal: "InterSemiBold" },
    700: { normal: "InterBold" },
  },
}

const nativeThemes = {
  light: { ...defaultConfig.themes.light, ...appThemes.light },
  dark: { ...defaultConfig.themes.dark, ...appThemes.dark },
}

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    body: { ...defaultConfig.fonts.body, ...inter },
    heading: { ...defaultConfig.fonts.heading, ...inter },
  },
  themes: nativeThemes,
  settings: {
    ...defaultConfig.settings,
    // React Native's default, which the kit's absolute fills (a skeleton's
    // pulse, a sliding pill) rely on; web's `static` let them cover the page.
    defaultPosition: "relative",
  },
  tokens: {
    ...defaultConfig.tokens,
    radius: { ...defaultConfig.tokens.radius, ...radius },
  },
})

type NativeTamaguiConfig = typeof tamaguiConfig

declare module "tamagui" {
  interface TamaguiCustomConfig extends NativeTamaguiConfig {}
}
