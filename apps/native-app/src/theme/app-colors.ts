import { createContext, useContext } from "react"
import { appThemes } from "./themes.ts"

/** The current theme's colors as values, keyed as the kit's theme keys. */
export type AppColors = (typeof appThemes)["light"]

/**
 * The current theme's colors, provided once by the root layout. For a view
 * drawn with React Native's own components, which takes a color value
 * rather than a theme key: reading them here is one context read, where
 * Tamagui's `useTheme` subscribes each caller to the theme (a list's every
 * row and icon did).
 */
export const AppColorsContext = createContext<AppColors>(appThemes.light)

export const useAppColors = (): AppColors => useContext(AppColorsContext)
