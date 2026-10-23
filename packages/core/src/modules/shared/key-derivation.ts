import {
  createRandomBytes,
  Mnemonic,
  mnemonicToOwnerSecret,
  type OwnerId,
  type OwnerIdBytes,
  type OwnerSecret,
  ownerIdBytesToOwnerId,
} from "@evolu/common"
import { schnorr } from "@noble/curves/secp256k1.js"
import { hmac } from "@noble/hashes/hmac.js"
import { sha512 } from "@noble/hashes/sha2.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import {
  entropyToMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
} from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"
import { Slip39 } from "slip39-ts"
import { z } from "zod"

import { derivePrivateKey, parseDerivationPath } from "./bip32.ts"
import { mnemonicToBip39Seed } from "./bip39-seed.ts"
import { hmacSha512 } from "./hmac-sha512.ts"
import { deriveLabeledKey } from "./labeled-key.ts"

const Hex16Schema = z.string().regex(/^[0-9a-f]{32}$/u)

export const MasterKeySchema = Hex16Schema.brand<"MasterKey">()
export type MasterKey = z.output<typeof MasterKeySchema>
export const MasterKey = MasterKeySchema.decode

export const SparkSecretSchema = Hex16Schema.brand<"SparkSecret">()
export type SparkSecret = z.output<typeof SparkSecretSchema>
export const SparkSecret = SparkSecretSchema.decode

export const SparkMnemonicSchema = z
  .string()
  .refine(
    (value) =>
      validateMnemonic(value, wordlist) &&
      value.trim().split(/\s+/u).length === 12,
    {
      message: "Invalid 12-word BIP-39 mnemonic.",
    }
  )
  .brand<"SparkMnemonic">()
export type SparkMnemonic = z.output<typeof SparkMnemonicSchema>
export const SparkMnemonic = SparkMnemonicSchema.decode

/** A 32-byte secp256k1 private key, the Nostr signing key. */
export const NostrSecretKeySchema = z
  .instanceof(Uint8Array)
  .refine((bytes) => bytes.length === 32, {
    message: "A Nostr secret key is exactly 32 bytes.",
  })
  .brand<"NostrSecretKey">()
export type NostrSecretKey = z.output<typeof NostrSecretKeySchema>
export const NostrSecretKey = NostrSecretKeySchema.decode

export const DerivationPathSchema = z.string().brand<"DerivationPath">()
export type DerivationPath = z.output<typeof DerivationPathSchema>
export const DerivationPath = DerivationPathSchema.decode

export const RecoveryMnemonicSchema = z
  .string()
  .refine(
    (value) =>
      Slip39.validateMnemonic(value) &&
      value.trim().split(/\s+/u).length === 20,
    {
      message: "Invalid 20-word SLIP-39 recovery mnemonic.",
    }
  )
  .brand<"RecoveryMnemonic">()
export type RecoveryMnemonic = z.output<typeof RecoveryMnemonicSchema>
export const RecoveryMnemonic = RecoveryMnemonicSchema.decode

/**
 * BIP-85 paths with the BIP-39 application:
 * `m/83696968'/39'/{language}'/{words}'/{index}'`, language `0'` = English.
 * The word count matches how much of the derived entropy each consumer uses:
 * 24 words = 32 bytes, 12 words = 16 bytes.
 */
/**
 * The Cashu wallet seed Linky derives (`CASHU_SEED_PATH` in Linky's
 * `derivationPaths.ts`): one wallet shared by both apps.
 */
export const cashuWalletSeedDerivationPath = DerivationPath(
  "m/83696968'/39'/0'/24'/0'"
)
/**
 * Linky's app (meta) owner (`META_OWNER_PATH`), a second Evolu identity next
 * to Payky's own; its shard owners hold the shared Cashu wallet.
 */
export const linkyAppOwnerDerivationPath = DerivationPath(
  "m/83696968'/39'/0'/24'/1'/0'"
)
export const evoluOwnerDerivationPath = DerivationPath(
  "m/83696968'/39'/0'/24'/1'"
)
export const defaultSparkWalletDerivationPath = DerivationPath(
  "m/83696968'/39'/0'/12'/0'"
)
/**
 * NIP-06: plain BIP-32, not BIP-85 — the node's private key is the key.
 * Linky derives the same path, so both apps publish one profile. Pinned by
 * `NOSTR_VECTOR` in `key-derivation-cross-app.test.ts`.
 */
export const nostrKeyDerivationPath = DerivationPath("m/44'/1237'/0'/0/0")

const bipEntropyHmacKey = new TextEncoder().encode("bip-entropy-from-k")

const derivePathPrivateKey = (
  masterKey: MasterKey,
  path: DerivationPath
): Uint8Array<ArrayBuffer> => {
  const indexes = parseDerivationPath(path)
  if (indexes === null) {
    throw new Error("A private BIP32 derivation path is required.")
  }
  return derivePrivateKey(hexToBytes(masterKey), indexes)
}

const deriveEntropy = (
  masterKey: MasterKey,
  path: DerivationPath
): Uint8Array =>
  hmacSha512(bipEntropyHmacKey, derivePathPrivateKey(masterKey, path)).slice(
    0,
    32
  )

export const deriveNostrSecretKey = (masterKey: MasterKey): NostrSecretKey =>
  NostrSecretKey(derivePathPrivateKey(masterKey, nostrKeyDerivationPath))

/** The 64-byte BIP-39 seed every NUT-13 derivation of the Cashu wallet hangs off. */
export const CashuWalletSeedSchema = z
  .instanceof(Uint8Array)
  .refine((bytes) => bytes.length === 64, {
    message: "A Cashu wallet seed is exactly 64 bytes.",
  })
  .brand<"CashuWalletSeed">()
export type CashuWalletSeed = z.output<typeof CashuWalletSeedSchema>
export const CashuWalletSeed = CashuWalletSeedSchema.decode

/**
 * As Linky: 32 bytes of entropy → 24-word BIP-39 → `mnemonicToSeed` with an
 * empty passphrase.
 */
export const deriveCashuWalletSeed = (masterKey: MasterKey): CashuWalletSeed =>
  CashuWalletSeed(
    mnemonicToBip39Seed(
      entropyToMnemonic(
        deriveEntropy(masterKey, cashuWalletSeedDerivationPath),
        wordlist
      )
    )
  )

/**
 * As Linky: the first 16 bytes → 12-word BIP-39 → Evolu's
 * `mnemonicToOwnerSecret`. Not Payky's own owner secret.
 */
export const deriveLinkyAppOwnerSecret = (masterKey: MasterKey): OwnerSecret =>
  mnemonicToOwnerSecret(
    Mnemonic.orThrow(
      entropyToMnemonic(
        deriveEntropy(masterKey, linkyAppOwnerDerivationPath).slice(0, 16),
        wordlist
      )
    )
  )

export const createMasterKey = (): MasterKey =>
  MasterKey(bytesToHex(createRandomBytes().create(16)))

/**
 * SLIP-39's identifier is a 15-bit value spread over 2 bytes: the high bit of
 * the first byte must be zero (`slip39-ts`'s internal, unexported
 * `generateIdentifier` masks it the same way via its private
 * `ID_BITS_LENGTH = 15` constant). This mask must stay in sync with that
 * constant if the library ever changes it.
 */
const SLIP39_IDENTIFIER_HIGH_BYTE_MASK = 0x7f

const slip39IdentifierHmacKey = new TextEncoder().encode(
  "payky-slip39-identifier"
)

/**
 * SLIP-39's identifier is embedded metadata, not secret key material, but
 * leaving it to the library's default (random) generator would make
 * `masterKeyToMnemonic` produce different words on every call for the same
 * master key. Deriving it deterministically (straight from the master key —
 * as metadata it doesn't warrant a BIP-85 derivation path) keeps the
 * displayed recovery phrase stable across renders.
 */
const deriveRecoveryMnemonicIdentifier = (masterKey: MasterKey): number[] => {
  const [firstByte, secondByte] = hmac(
    sha512,
    slip39IdentifierHmacKey,
    hexToBytes(masterKey)
  )
  return [(firstByte ?? 0) & SLIP39_IDENTIFIER_HIGH_BYTE_MASK, secondByte ?? 0]
}

export const masterKeyToMnemonic = async (
  masterKey: MasterKey
): Promise<RecoveryMnemonic> => {
  const slip = await Slip39.fromArray(Array.from(hexToBytes(masterKey)), {
    identifier: deriveRecoveryMnemonicIdentifier(masterKey),
  })
  const [mnemonic] = slip.fromPath("r/0").mnemonics

  if (mnemonic === undefined) {
    throw new Error("SLIP-39 encoding did not produce a recovery mnemonic.")
  }

  return RecoveryMnemonic(mnemonic)
}

export const mnemonicToMasterKey = async (
  mnemonic: RecoveryMnemonic
): Promise<MasterKey> => {
  const secret = await Slip39.recoverSecret([mnemonic])
  return MasterKey(bytesToHex(new Uint8Array(secret)))
}

export const deriveEvoluOwnerSecret = (masterKey: MasterKey): OwnerSecret =>
  deriveEntropy(masterKey, evoluOwnerDerivationPath) as OwnerSecret

const slip21Encoder = new TextEncoder()

/**
 * The id of `createAppOwner(deriveEvoluOwnerSecret(masterKey))`, and only
 * that: Evolu's SLIP-21 node ["Evolu", "OwnerIdBytes"], its first 16 bytes.
 * `createAppOwner` also derives the encryption and write keys and the
 * mnemonic, which an id lookup run over every account at each start (the
 * device account migration's check) does not need. The test compares it
 * with `createAppOwner`.
 */
export const deriveEvoluOwnerId = (masterKey: MasterKey): OwnerId => {
  let node = hmacSha512(
    slip21Encoder.encode("Symmetric key seed"),
    deriveEvoluOwnerSecret(masterKey)
  )
  for (const label of ["Evolu", "OwnerIdBytes"]) {
    const labelBytes = slip21Encoder.encode(label)
    const message = new Uint8Array(labelBytes.length + 1)
    message.set(labelBytes, 1)
    node = hmacSha512(node.slice(0, 32), message)
  }
  return ownerIdBytesToOwnerId(node.slice(32, 48) as OwnerIdBytes)
}

export const deriveDefaultSparkWalletSecret = (
  masterKey: MasterKey
): SparkSecret =>
  SparkSecret(
    bytesToHex(
      deriveEntropy(masterKey, defaultSparkWalletDerivationPath).slice(0, 16)
    )
  )

/**
 * The Spark secret is used as BIP-39 entropy. The Spark SDK consumes the
 * resulting mnemonic (not the raw secret), so a wallet displayed as these 12
 * words can be restored in any BIP-39-compatible Spark client.
 */
export const sparkSecretToMnemonic = (secret: SparkSecret): SparkMnemonic =>
  SparkMnemonic(entropyToMnemonic(hexToBytes(secret), wordlist))

/** The inverse of `sparkSecretToMnemonic`, for a wallet the user brings. */
export const sparkMnemonicToSecret = (mnemonic: SparkMnemonic): SparkSecret =>
  SparkSecret(bytesToHex(mnemonicToEntropy(mnemonic, wordlist)))

export interface TableSelfPayKeys {
  readonly signingKey: Uint8Array
  readonly publicKey: Uint8Array
  readonly viewKey: Uint8Array
}

export const deriveTableSelfPayRoot = (masterKey: MasterKey): Uint8Array =>
  deriveLabeledKey(hexToBytes(masterKey), "payky/table-self-pay/v1")

export const deriveTableSelfPayKeys = (
  root: Uint8Array,
  tableId: string,
  epoch: number
): TableSelfPayKeys => {
  const tableSecret = deriveLabeledKey(root, `table:${tableId}:${epoch}`)
  const signingKey = deriveLabeledKey(tableSecret, "sign")

  return {
    signingKey,
    publicKey: schnorr.getPublicKey(signingKey),
    viewKey: deriveLabeledKey(tableSecret, "view"),
  }
}

export const deriveSelfPayRateKey = (root: Uint8Array): Uint8Array =>
  deriveLabeledKey(root, "rate")

export const deriveSelfPaySelectionKey = (root: Uint8Array): Uint8Array =>
  deriveLabeledKey(root, "selection")
