import { defaultConfig } from "@tamagui/config/v6"
import { createTamagui, isWeb } from "tamagui"
import { appThemes } from "./src/theme/themes"
import { radius } from "./src/theme/tokens"

// Manrope, as Linky's `packages/ui/src/config.ts`: regular, semibold and
// bold. The APK carries one face per weight (app.config.ts), which Tamagui
// swaps in by `face`. On web Tamagui sets only the family and the weight,
// so the PWA names the Manrope it bundles (platform/web-styles.web.ts), with
// sans-serif behind it rather than the browser's serif default.
const manrope = {
  family: isWeb ? "Manrope, sans-serif" : "Manrope",
  face: {
    400: { normal: "Manrope" },
    500: { normal: "ManropeSemiBold" },
    600: { normal: "ManropeSemiBold" },
    700: { normal: "ManropeBold" },
  },
}

const nativeThemes = {
  light: { ...defaultConfig.themes.light, ...appThemes.light },
  dark: { ...defaultConfig.themes.dark, ...appThemes.dark },
}

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    body: { ...defaultConfig.fonts.body, ...manrope },
    heading: { ...defaultConfig.fonts.heading, ...manrope },
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
