import { randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { expect, it } from "vitest"
import { decodeBase64Natively } from "./native-base64.ts"

// The copy of js-base64 the Spark SDK resolves, as the app's bundle does.
const fromCore = createRequire(
  new URL("../../../../packages/core/package.json", import.meta.url)
)
const fromSpark = createRequire(fromCore.resolve("@buildonspark/spark-sdk"))
const jsBase64: {
  toUint8Array: (text: string) => Uint8Array
  fromUint8Array: (bytes: Uint8Array, urlSafe?: boolean) => string
} = fromSpark("js-base64")

// Android's decoder takes only the standard alphabet, as this one does.
const nativeCalls: string[] = []
const toUint8Array = decodeBase64Natively(jsBase64.toUint8Array, (text) => {
  nativeCalls.push(text)
  if (!/^[A-Za-z0-9+/\s]*={0,2}$/u.test(text)) throw new Error("bad base-64")
  return new Uint8Array(Buffer.from(text, "base64"))
})

it("decodes standard base64 natively, as js-base64 does", () => {
  for (const size of [0, 1, 2, 3, 100, 50_000]) {
    const text = jsBase64.fromUint8Array(new Uint8Array(randomBytes(size)))
    expect(toUint8Array(text)).toEqual(jsBase64.toUint8Array(text))
  }
  expect(nativeCalls).toHaveLength(6)
})

it("leaves what native decoding rejects to js-base64", () => {
  const bytes = new Uint8Array(randomBytes(300))
  const urlSafe = jsBase64.fromUint8Array(bytes, true)
  expect(urlSafe).toMatch(/[-_]/u)
  expect(toUint8Array(urlSafe)).toEqual(bytes)
})
