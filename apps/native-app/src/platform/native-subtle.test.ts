import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
  sign,
  verify,
} from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { FinitoCrypto, HashName } from "./finito-crypto.ts"
import { createSubtle } from "./native-subtle.ts"

vi.mock("expo", () => ({ requireNativeModule: () => ({}) }))
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }))
const { createEetCryptoBackend } = await import("./eet-crypto.ts")

// Node's crypto standing in for `modules/finito-crypto`, which runs only on
// Android; Node's own Web Crypto is the reference the polyfill must match.
const nodeHash = (hash: HashName) => hash.replace("-", "").toLowerCase()
const native: FinitoCrypto = {
  digest: (hash, data) => createHash(nodeHash(hash)).update(data).digest(),
  hmac: (hash, key, data) =>
    createHmac(nodeHash(hash), key).update(data).digest(),
  pbkdf2: (hash, password, salt, iterations, length) =>
    pbkdf2Sync(password, salt, iterations, length, nodeHash(hash)),
  pbkdf2Async: async (hash, password, salt, iterations, length) =>
    pbkdf2Sync(password, salt, iterations, length, nodeHash(hash)),
  rsaSign: (pkcs8, data) =>
    sign(
      "sha256",
      data,
      createPrivateKey({
        key: Buffer.from(pkcs8),
        format: "der",
        type: "pkcs8",
      })
    ),
  rsaVerify: (spki, data, signature) =>
    verify(
      "sha256",
      data,
      createPublicKey({ key: Buffer.from(spki), format: "der", type: "spki" }),
      signature
    ),
  rsaCheckKey: (format, der) => {
    const key = Buffer.from(der)
    if (format === "pkcs8")
      createPrivateKey({ key, format: "der", type: format })
    else createPublicKey({ key, format: "der", type: format })
  },
  rsaGenerate: (modulusLength, publicExponent) => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength,
      publicExponent: Number.parseInt(
        Buffer.from(publicExponent).toString("hex"),
        16
      ),
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "der" },
    })
    return { pkcs8: privateKey, spki: publicKey }
  },
}

const subtle = createSubtle(native)
const reference = globalThis.crypto.subtle
const data = new Uint8Array(randomBytes(100))
const bytes = (buffer: ArrayBuffer) => new Uint8Array(buffer)
const rsa = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }

describe("createSubtle", () => {
  it("digests as Web Crypto does", async () => {
    for (const hash of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
      expect(bytes(await subtle.digest(hash, data))).toEqual(
        bytes(await reference.digest(hash, data))
      )
    }
  })

  it("signs and verifies HMAC as Web Crypto does", async () => {
    for (const hash of ["SHA-256", "SHA-512"]) {
      const raw = new Uint8Array(randomBytes(32))
      const algorithm = { name: "HMAC", hash: { name: hash } }
      const key = await subtle.importKey("raw", raw, algorithm, false, ["sign"])
      const referenceKey = await reference.importKey(
        "raw",
        raw,
        algorithm,
        false,
        ["sign"]
      )
      const signature = await subtle.sign("HMAC", key, data)
      expect(bytes(signature)).toEqual(
        bytes(await reference.sign("HMAC", referenceKey, data))
      )
      expect(await subtle.verify("HMAC", key, signature, data)).toBe(true)
      expect(await subtle.verify("HMAC", key, signature, data.slice(1))).toBe(
        false
      )
    }
  })

  it("derives PBKDF2 bits as Web Crypto does, as the PIN hash asks", async () => {
    const pin = new TextEncoder().encode("1234")
    const algorithm = {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(randomBytes(16)),
      iterations: 30_000,
    }
    const key = await subtle.importKey("raw", pin, "PBKDF2", false, [
      "deriveBits",
    ])
    const referenceKey = await reference.importKey(
      "raw",
      pin,
      "PBKDF2",
      false,
      ["deriveBits"]
    )
    expect(bytes(await subtle.deriveBits(algorithm, key, 256))).toEqual(
      bytes(await reference.deriveBits(algorithm, referenceKey, 256))
    )
  })

  it("signs RSA PKCS#1 v1.5 as Web Crypto does, and keys round-trip", async () => {
    const generated = await reference.generateKey(
      { ...rsa, modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) },
      true,
      ["sign", "verify"]
    )
    const pkcs8 = await reference.exportKey("pkcs8", generated.privateKey)
    const privateKey = await subtle.importKey("pkcs8", pkcs8, rsa, false, [
      "sign",
    ])
    const signature = await subtle.sign(rsa, privateKey, data)
    // PKCS#1 v1.5 is deterministic.
    expect(bytes(signature)).toEqual(
      bytes(await reference.sign(rsa, generated.privateKey, data))
    )

    const own = await subtle.generateKey(
      { ...rsa, modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) },
      true,
      ["sign", "verify"]
    )
    const spki = await subtle.exportKey("spki", own.publicKey)
    const referencePublic = await reference.importKey(
      "spki",
      spki,
      rsa,
      false,
      ["verify"]
    )
    const ownSignature = await subtle.sign(rsa, own.privateKey, data)
    expect(
      await reference.verify(rsa, referencePublic, ownSignature, data)
    ).toBe(true)
    expect(await subtle.verify(rsa, own.publicKey, ownSignature, data)).toBe(
      true
    )
    expect(
      await subtle.verify(rsa, own.publicKey, ownSignature, data.slice(1))
    ).toBe(false)
  })

  it("rejects what it does not offer as Web Crypto does an unknown algorithm", async () => {
    const notSupported = expect.objectContaining({ name: "NotSupportedError" })
    await expect(subtle.encrypt()).rejects.toEqual(notSupported)
    await expect(subtle.digest("MD5", data)).rejects.toEqual(notSupported)
    await expect(
      subtle.importKey("raw", data, { name: "AES-GCM" }, false, ["encrypt"])
    ).rejects.toEqual(notSupported)
    await expect(
      subtle.importKey("pkcs8", data, { ...rsa, hash: "SHA-512" }, false, [
        "sign",
      ])
    ).rejects.toEqual(notSupported)
  })
})

describe("createEetCryptoBackend", () => {
  const backend = createEetCryptoBackend(native, () => "uuid")
  const pem = (label: string, der: Uint8Array) =>
    `-----BEGIN ${label}-----\n${Buffer.from(der).toString("base64")}\n-----END ${label}-----`

  it("hashes in chunks and signs RSA-SHA256 as Quick Crypto did", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "der" },
    })
    const key = backend.createPrivateKey(pem("PRIVATE KEY", privateKey))
    const signature = backend.sign("RSA-SHA256", data, key)
    expect(Buffer.from(signature)).toEqual(
      sign(
        "sha256",
        data,
        createPrivateKey({ key: privateKey, format: "der", type: "pkcs8" })
      )
    )
    const verifyKey = backend.createPublicKey(pem("PUBLIC KEY", publicKey))
    expect(backend.verify("RSA-SHA256", data, verifyKey, signature)).toBe(true)
    expect(() => backend.createPrivateKey(pem("PRIVATE KEY", data))).toThrow()

    const hashed = backend
      .createHash("sha1")
      .update(data.slice(0, 40))
      .update(data.slice(40))
      .digest()
    expect(Buffer.from(hashed)).toEqual(
      createHash("sha1").update(data).digest()
    )
    const key20 = new Uint8Array(randomBytes(20))
    expect(
      Buffer.from(backend.createHmac("sha1", key20).update(data).digest())
    ).toEqual(createHmac("sha1", key20).update(data).digest())
    expect(backend.randomUUID()).toBe("uuid")
  })
})

it("names the module and its functions the same in JS and Kotlin", () => {
  const read = (file: string) =>
    readFileSync(new URL(file, import.meta.url), "utf8")
  const js = read("./finito-crypto.ts")
  const kotlin = read(
    "../../modules/finito-crypto/android/src/main/java/fit/finito/crypto/FinitoCryptoModule.kt"
  )
  expect(js).toContain(
    'requireNativeModule<FinitoCryptoNativeModule>("FinitoCrypto")'
  )
  expect(kotlin).toContain('Name("FinitoCrypto")')
  for (const name of [
    "digest",
    "hmac",
    "pbkdf2",
    "pbkdf2Async",
    "rsaSign",
    "rsaVerify",
    "rsaCheckKey",
    "rsaGenerate",
  ]) {
    expect(js).toContain(`${name}(`)
    expect(kotlin).toContain(`Function("${name}")`)
  }
})
