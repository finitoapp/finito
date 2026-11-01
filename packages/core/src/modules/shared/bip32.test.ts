import { HDKey } from "@scure/bip32"
import { describe, expect, test } from "vitest"

import { derivePrivateKey, parseDerivationPath } from "./bip32.ts"
import {
  cashuWalletSeedDerivationPath,
  defaultSparkWalletDerivationPath,
  evoluOwnerDerivationPath,
  linkyAppOwnerDerivationPath,
  nostrKeyDerivationPath,
} from "./key-derivation.ts"

const paths = [
  cashuWalletSeedDerivationPath,
  linkyAppOwnerDerivationPath,
  evoluOwnerDerivationPath,
  defaultSparkWalletDerivationPath,
  nostrKeyDerivationPath,
  "m/0'",
  "m/0",
  "m/2147483647'/1'/0'",
  "m/2147483647/1/0'/7",
]

describe("derivePrivateKey", () => {
  test("derives HDKey's private key for Payky's paths, over random seeds", () => {
    for (let round = 0; round < 50; round++) {
      const seed = crypto.getRandomValues(new Uint8Array(round % 2 ? 16 : 64))
      for (const path of paths) {
        const indexes = parseDerivationPath(path)
        expect(indexes).not.toBeNull()
        if (indexes === null) continue
        expect(derivePrivateKey(seed, indexes)).toEqual(
          HDKey.fromMasterSeed(seed).derive(path).privateKey
        )
      }
    }
  })

  test("matches BIP32 test vector 1 at m/0' and m/0'/1", () => {
    const seed = Uint8Array.from(
      "000102030405060708090a0b0c0d0e0f".match(/../gu) ?? [],
      (byte) => Number.parseInt(byte, 16)
    )
    const derive = (path: string) => {
      const indexes = parseDerivationPath(path)
      expect(indexes).not.toBeNull()
      return Buffer.from(derivePrivateKey(seed, indexes ?? [])).toString("hex")
    }
    expect(derive("m/0'")).toBe(
      "edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea"
    )
    expect(derive("m/0'/1")).toBe(
      "3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368"
    )
  })
})

describe("parseDerivationPath", () => {
  test("offsets hardened levels by 2^31 and keeps the others", () => {
    expect(parseDerivationPath("m/44'/1237'/0'/0/0")).toEqual([
      0x8000002c, 0x800004d5, 0x80000000, 0, 0,
    ])
    expect(parseDerivationPath("m")).toEqual([])
  })

  test("refuses what is not a BIP32 path", () => {
    expect(parseDerivationPath("44'/0'")).toBeNull()
    expect(parseDerivationPath("m/2147483648'")).toBeNull()
    expect(parseDerivationPath("m/2147483648")).toBeNull()
    expect(parseDerivationPath("m/0h")).toBeNull()
    expect(parseDerivationPath("m/")).toBeNull()
  })
})
