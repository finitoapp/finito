import { LogBox } from "react-native"
import { nativeEnv } from "../core/native-env.ts"
import { routeE2eSelfPayRelays } from "./e2e-self-pay-relays.ts"

if (nativeEnv.EXPO_PUBLIC_PAYKY_E2E) routeE2eSelfPayRelays()

// A debug e2e build (the runner's --dev) would otherwise lay LogBox's warning
// toasts over the screen under test. Web's `e2e-setup.web.ts` works around
// Maestro's web driver instead.
if (nativeEnv.EXPO_PUBLIC_PAYKY_E2E) LogBox.ignoreAllLogs()
