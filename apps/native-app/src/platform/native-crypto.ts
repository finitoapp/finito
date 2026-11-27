import { installBip39Pbkdf2 } from "@payky/core/modules/shared/bip39-seed"
import { installHmacSha512 } from "@payky/core/modules/shared/hmac-sha512"
import { installSecp256k1PublicKey } from "@payky/core/modules/shared/secp256k1-public-key"
import { finitoCrypto } from "./finito-crypto.ts"
import { finitoSecp256k1 } from "./finito-secp256k1.ts"

// Payky's key derivations on native code rather than in pure JS on Hermes:
// each BIP-39 seed (the Cashu wallet's, the Spark wallet's) blocked the JS
// thread for ~1.6 s, the HMAC-SHA512 behind the account ids, which the
// device migration check derives for every account at each start, cost a few
// milliseconds per call, and the secp256k1 public keys behind the account's
// Nostr identity held the first settings screen up for hundreds.
installBip39Pbkdf2(
  (password, salt, iterations, keyLength) =>
    new Uint8Array(
      finitoCrypto.pbkdf2("SHA-512", password, salt, iterations, keyLength)
    )
)
installHmacSha512(
  (key, data) => new Uint8Array(finitoCrypto.hmac("SHA-512", key, data))
)
if (finitoSecp256k1 !== null) {
  const { publicKey } = finitoSecp256k1
  // Uncompressed, as core expects; it compresses it.
  installSecp256k1PublicKey(
    (privateKey) => new Uint8Array(publicKey(privateKey))
  )
}
