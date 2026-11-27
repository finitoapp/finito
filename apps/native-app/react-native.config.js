// Finito uses neither Reanimated nor Worklets: Bun installs them only as peers
// (react-native-drawer-layout, which expo-router depends on, asks for
// Reanimated, and Reanimated for Worklets). Autolinked, they shipped ~2 MB of
// native code per ABI, and once react-native-nitro-modules found Worklets'
// JS, its UI runtime asked Android for every frame, keeping the main thread
// at 60 Hz with nothing to draw. `metro.config.js` resolves Worklets' JS to
// an empty module to match.
const unlinked = { platforms: { android: null, ios: null } }

module.exports = {
  dependencies: {
    "react-native-reanimated": unlinked,
    "react-native-worklets": unlinked,
  },
}
