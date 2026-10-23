import { schnorr } from "@noble/curves/secp256k1.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { Slip39 } from "slip39-ts"
import { describe, expect, test } from "vitest"
import {
  cashuWalletSeedDerivationPath,
  defaultSparkWalletDerivationPath,
  deriveDefaultSparkWalletSecret,
  deriveEvoluOwnerSecret,
  deriveSelfPayRateKey,
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
  evoluOwnerDerivationPath,
  MasterKey,
  MasterKeySchema,
  masterKeyToMnemonic,
  mnemonicToMasterKey,
  RecoveryMnemonicSchema,
  SparkMnemonicSchema,
  sparkMnemonicToSecret,
  sparkSecretToMnemonic,
} from "./key-derivation.ts"

const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")

describe("key derivation", () => {
  test("uses the documented Payky derivation paths", () => {
    expect(cashuWalletSeedDerivationPath).toBe("m/83696968'/39'/0'/24'/0'")
    expect(evoluOwnerDerivationPath).toBe("m/83696968'/39'/0'/24'/1'")
    expect(defaultSparkWalletDerivationPath).toBe("m/83696968'/39'/0'/12'/0'")
  })

  test("derives the documented Evolu owner secret", () => {
    expect(Array.from(deriveEvoluOwnerSecret(masterKey))).toEqual([
      117, 47, 79, 0, 226, 80, 134, 27, 91, 215, 199, 144, 119, 235, 32, 202,
      232, 161, 139, 179, 200, 203, 127, 84, 190, 92, 106, 29, 232, 228, 139,
      12,
    ])
  })

  test("derives a deterministic, independent Spark secret", () => {
    const sparkSecret = deriveDefaultSparkWalletSecret(masterKey)

    expect(sparkSecret).toBe("a8117f2ba9ed92d57c35e5997ecf9ca8")
    expect(sparkSecret).not.toBe(
      deriveDefaultSparkWalletSecret(
        MasterKey("ffffffffffffffffffffffffffffffff")
      )
    )
  })

  test("encodes the Spark secret as a 12-word BIP-39 mnemonic", () => {
    const mnemonic = sparkSecretToMnemonic(
      deriveDefaultSparkWalletSecret(masterKey)
    )

    expect(mnemonic).toBe(
      "pool message slab fatigue summer height valid royal offer wait transfer expand"
    )
    expect(SparkMnemonicSchema.safeParse(mnemonic).success).toBe(true)
    expect(mnemonic.split(" ")).toHaveLength(12)
  })

  test("turns a Spark wallet mnemonic back into its secret", () => {
    const secret = deriveDefaultSparkWalletSecret(masterKey)

    expect(sparkMnemonicToSecret(sparkSecretToMnemonic(secret))).toBe(secret)
  })

  test("round-trips the master key through its SLIP-39 recovery mnemonic", async () => {
    const mnemonic = await masterKeyToMnemonic(masterKey)

    expect(RecoveryMnemonicSchema.safeParse(mnemonic).success).toBe(true)
    expect(mnemonic.trim().split(/\s+/u)).toHaveLength(20)
    expect(await mnemonicToMasterKey(mnemonic)).toBe(masterKey)
    expect(MasterKeySchema.safeParse("0123").success).toBe(false)
    expect(
      MasterKeySchema.safeParse(
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
      ).success
    ).toBe(false)
  })

  test("derives the same recovery mnemonic every time for the same master key", async () => {
    expect(await masterKeyToMnemonic(masterKey)).toBe(
      await masterKeyToMnemonic(masterKey)
    )
  })

  test("rejects a 33-word recovery mnemonic", async () => {
    const slip = await Slip39.fromArray(
      Array.from({ length: 32 }, (_, index) => index)
    )
    const [mnemonic] = slip.fromPath("r/0").mnemonics

    if (mnemonic === undefined) {
      throw new Error("SLIP-39 encoding did not produce a recovery mnemonic.")
    }

    expect(mnemonic.trim().split(/\s+/u)).toHaveLength(33)
    expect(RecoveryMnemonicSchema.safeParse(mnemonic).success).toBe(false)
  })

  test("rejects a mnemonic that isn't valid SLIP-39", () => {
    expect(
      RecoveryMnemonicSchema.safeParse("not a valid mnemonic").success
    ).toBe(false)
  })
})

describe("table self-pay key derivation", () => {
  const root = deriveTableSelfPayRoot(masterKey)

  test("derives the pinned table keys", () => {
    const keys = deriveTableSelfPayKeys(root, "table-3", 0)

    expect(bytesToHex(root)).toBe(
      "ca622683370f84b3dc48c86280194adfab1d5112b3a50417e9d77c3737de92fe"
    )
    expect(bytesToHex(keys.publicKey)).toBe(
      "d9dfce95e6d1d10a520ff2b5aba26d1ed9e2951c4ac4fadd28fda3f8652e29aa"
    )
    expect(bytesToHex(keys.viewKey)).toBe(
      "31a2f341aa02d3dfcc04125be27112d7c8350b84daa5ee900bfd8cfef46e6c63"
    )
    expect(bytesToHex(deriveSelfPayRateKey(root))).toBe(
      "225c9e8f2b8887d280b90394b19b0008e1fda3955649dfe7bdeba0cd38241676"
    )
  })

  test("gives every table and every epoch its own keys", () => {
    const derived = [
      deriveTableSelfPayKeys(root, "table-3", 0),
      deriveTableSelfPayKeys(root, "table-4", 0),
      deriveTableSelfPayKeys(root, "table-3", 1),
    ]

    expect(
      new Set(derived.map(({ publicKey }) => bytesToHex(publicKey))).size
    ).toBe(3)
    expect(
      new Set(derived.map(({ viewKey }) => bytesToHex(viewKey))).size
    ).toBe(3)
  })

  test("keeps the signing key out of reach of the view key", () => {
    const keys = deriveTableSelfPayKeys(root, "table-3", 0)

    expect(bytesToHex(keys.signingKey)).not.toBe(bytesToHex(keys.viewKey))
    expect(bytesToHex(schnorr.getPublicKey(keys.viewKey))).not.toBe(
      bytesToHex(keys.publicKey)
    )
  })

  test("derives nothing a device of another merchant shares", () => {
    const otherRoot = deriveTableSelfPayRoot(
      MasterKey("ffffffffffffffffffffffffffffffff")
    )

    expect(
      bytesToHex(deriveTableSelfPayKeys(otherRoot, "table-3", 0).publicKey)
    ).not.toBe(bytesToHex(deriveTableSelfPayKeys(root, "table-3", 0).publicKey))
  })
})
