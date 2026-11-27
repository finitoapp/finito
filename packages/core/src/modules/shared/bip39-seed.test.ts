import { pbkdf2Sync } from "node:crypto"
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"
import { afterAll, describe, expect, test } from "vitest"

import {
  createBip39Seed,
  installBip39Pbkdf2,
  mnemonicToBip39Seed,
} from "./bip39-seed.ts"

// Node's PBKDF2 stands in for the native app's, which has the same signature.
const nativePbkdf2 = (
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLength: number
) => new Uint8Array(pbkdf2Sync(password, salt, iterations, keyLength, "sha512"))

const randomMnemonic = (bytes: number) =>
  entropyToMnemonic(crypto.getRandomValues(new Uint8Array(bytes)), wordlist)

describe("createBip39Seed", () => {
  test("computes @scure/bip39's seed on a native PBKDF2", () => {
    const seed = createBip39Seed(nativePbkdf2)
    for (const bytes of [16, 32, 16, 32, 16, 32]) {
      const mnemonic = randomMnemonic(bytes)
      expect(seed(mnemonic)).toEqual(mnemonicToSeedSync(mnemonic))
    }
  })
})

describe("installBip39Pbkdf2", () => {
  afterAll(() => {
    installBip39Pbkdf2(nativePbkdf2)
  })

  test("routes mnemonicToBip39Seed through the installed PBKDF2", () => {
    const mnemonic = randomMnemonic(32)
    const expected = mnemonicToSeedSync(mnemonic)
    expect(mnemonicToBip39Seed(mnemonic)).toEqual(expected)

    let calls = 0
    installBip39Pbkdf2((...args) => {
      calls += 1
      return nativePbkdf2(...args)
    })

    expect(mnemonicToBip39Seed(mnemonic)).toEqual(expected)
    expect(calls).toBe(1)
  })
})
