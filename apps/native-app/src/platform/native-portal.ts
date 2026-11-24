/**
 * Hands Tamagui's portal to `react-native-teleport`, which moves a portal's
 * native views to the root host while its React tree stays where it was
 * rendered, so sheets, dialogs and toasts keep every React context (Jotai,
 * translations, a Select's own). Without it Tamagui falls back to a JS
 * portal that renders at the root and loses them. Imported first in
 * `entry.ts`: Tamagui's dialog reads the portal setup once, when it loads.
 */
import "@tamagui/native/setup-teleport"
