import { getRandomValues, randomUUID } from "expo-crypto"
import { finitoCrypto } from "./finito-crypto.ts"
import { createSubtle } from "./native-subtle.ts"

// Web Crypto's `subtle`, as far as the app and its libraries use it, over
// Android's own crypto provider: the PIN hash (PBKDF2, core's access-utils),
// SLIP-39 shares and EET's diagnostics need it; EET itself gets its crypto
// explicitly (platform/eet-crypto.ts).
const subtle = createSubtle(finitoCrypto)

// Evolu creates query IDs during import, before any route or provider mounts.
Object.defineProperty(globalThis, "crypto", {
  value: Object.assign(globalThis.crypto ?? {}, {
    getRandomValues,
    randomUUID,
    subtle,
  }),
  configurable: true,
  writable: true,
})
