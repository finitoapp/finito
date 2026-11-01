// Diagnostic source of the account transfer, run from the repo root:
//   bun apps/native-app/scripts/pair-source.ts
// Not bundled into the app. Creates a disposable account key, prints the
// adb deep link for the native pair target, then type the 6-digit code the
// phone shows (a wrong one tests the attempt limit).

import { createInterface } from "node:readline"
import { createAppOwner } from "@evolu/common"
import { createDateDep } from "@payky/core/deps"
import { createAccountMasterKey } from "@payky/core/evolu/device-account"
import {
  startTransferSource,
  type TransferPayload,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { deriveEvoluOwnerSecret } from "@payky/core/modules/shared/key-derivation"
import { NonEmptyString255, WssUrl } from "@payky/core/modules/shared/schema"

// Same defaults as VITE_PAYKY_NOSTR_RELAYS.
const relays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.0xchat.com",
  "wss://nostr.linky.fit",
]

const masterKey = createAccountMasterKey()
const payload: TransferPayload = {
  masterKey,
  accountName: NonEmptyString255("Pair spike account"),
  transports: [WssUrl("wss://evolu.eu.freedomrelay.dev")],
}
console.log(
  "expected owner id:",
  createAppOwner(deriveEvoluOwnerSecret(masterKey)).id
)

const rl = createInterface({ input: process.stdin })
let announced = false
const session = startTransferSource(
  { ...createNostrDep(relays), ...createDateDep() },
  {
    payload,
    onState: (state) => {
      if (state.phase === "waiting" && !announced) {
        announced = true
        console.log("pair uri:", state.uri)
        console.log(
          `adb shell am start -a android.intent.action.VIEW -d "finito://pair?hex=${Buffer.from(state.uri).toString("hex")}" fit.finito.app`
        )
      }
      console.log("state:", JSON.stringify({ ...state, uri: undefined }))
      if (state.phase === "locked")
        console.log("type the code shown on the phone:")
      if (["expired", "failed", "done"].includes(state.phase)) {
        rl.close()
        setTimeout(() => process.exit(0), 500)
      }
    },
  }
)
rl.on("line", (line) => session.submitCode(line.trim()))
