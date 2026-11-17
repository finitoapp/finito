/**
 * The kit's `transition`: the `fast` preset (`animations.ts`, CSS on the PWA)
 * on the fill, the text color and the opacity only, which is every state a
 * kit control fades between. Not the bare preset, which covers every
 * property: Tamagui's React Native driver runs a node whose transition
 * covers a height or a width on the JS driver, every value of it and every
 * frame (`@tamagui/animations-react-native`, `hasAnimatedLayoutKey`), and a
 * kit `Button` carries a height. On a PAX A920Pro one tap on Charge started
 * some 57 JS-driven animations, a quarter of the JS work of the navigation
 * behind it; without them the navigation took ~30% less (2026-11-17).
 * `ui-kit.test.ts` fails on a bare `"fast"`.
 */
export const fadeTransition = "background-color fast, color fast, opacity fast"
