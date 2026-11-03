import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { nip05Url, resolveNip05 } from "./nip05.ts"

const pubkey = "a".repeat(64)
const address = { name: "alice", domain: "example.com" }

const fetchDep = (answer: (url: string) => Response | Promise<Response>) => ({
  fetch: async (input: RequestInfo | URL) => answer(String(input)),
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("resolveNip05", () => {
  test("asks the domain's nostr.json for the name", async () => {
    const asked: string[] = []
    await using run = testCreateRun(
      fetchDep((url) => {
        asked.push(url)
        return json({ names: { alice: pubkey.toUpperCase() } })
      })
    )
    await expect(run(resolveNip05(address))).resolves.toEqual({
      ok: true,
      value: pubkey,
    })
    expect(asked).toEqual([
      "https://example.com/.well-known/nostr.json?name=alice",
    ])
    expect(nip05Url(address)).toBe(asked[0])
  })

  test("a name the document does not list, lists as no key, or a 404, is not found", async () => {
    const notFound = {
      ok: false,
      error: { type: "Nip05NotFound", address: "alice@example.com" },
    }
    await using unlisted = testCreateRun(fetchDep(() => json({ names: {} })))
    await expect(unlisted(resolveNip05(address))).resolves.toEqual(notFound)
    await using notKey = testCreateRun(
      fetchDep(() => json({ names: { alice: "npub1x" } }))
    )
    await expect(notKey(resolveNip05(address))).resolves.toEqual(notFound)
    await using missing = testCreateRun(fetchDep(() => json({}, 404)))
    await expect(missing(resolveNip05(address))).resolves.toEqual(notFound)
  })

  test("a domain that does not answer, or not with a NIP-05 document, is unreachable", async () => {
    const unreachable = {
      ok: false,
      error: { type: "Nip05Unreachable", address: "alice@example.com" },
    }
    await using offline = testCreateRun(
      fetchDep(() => {
        throw new TypeError("Network request failed")
      })
    )
    await expect(offline(resolveNip05(address))).resolves.toEqual(unreachable)
    await using failing = testCreateRun(fetchDep(() => json({}, 500)))
    await expect(failing(resolveNip05(address))).resolves.toEqual(unreachable)
    await using garbled = testCreateRun(fetchDep(() => json({ nope: true })))
    await expect(garbled(resolveNip05(address))).resolves.toEqual(unreachable)
  })
})
