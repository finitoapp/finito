import { installBip39Pbkdf2 } from "@payky/core/modules/shared/bip39-seed"
import { installHmacSha512 } from "@payky/core/modules/shared/hmac-sha512"
import { installSecp256k1PublicKey } from "@payky/core/modules/shared/secp256k1-public-key"
import {
  Buffer,
  createECDH,
  createHmac,
  pbkdf2Sync,
} from "react-native-quick-crypto"

// Payky's key derivations on Quick Crypto rather than in pure JS on Hermes:
// each BIP-39 seed (the Cashu wallet's, the Spark wallet's) blocked the JS
// thread for ~1.6 s, the HMAC-SHA512 behind the account ids, which the
// device migration check derives for every account at each start, cost a few
// milliseconds per call, and the secp256k1 public keys behind the account's
// Nostr identity held the first settings screen up for hundreds.
installBip39Pbkdf2(
  (password, salt, iterations, keyLength) =>
    new Uint8Array(pbkdf2Sync(password, salt, iterations, keyLength, "sha512"))
)
installHmacSha512(
  (key, data) => new Uint8Array(createHmac("sha512", key).update(data).digest())
)
installSecp256k1PublicKey((privateKey) => {
  const ecdh = createECDH("secp256k1")
  ecdh.setPrivateKey(Buffer.from(privateKey))
  // Uncompressed, the only format Quick Crypto returns; core compresses it.
  const point = ecdh.getPublicKey()
  // A string only when an encoding is asked for, which none is.
  if (typeof point === "string") throw new Error("Expected key bytes.")
  return new Uint8Array(point)
})
