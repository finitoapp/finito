import { testCreateRun } from "@evolu/common"
import { nprofileEncode, npubEncode } from "nostr-tools/nip19"
import { describe, expect, test } from "vitest"
import { nip05Url } from "../nostr/nip05.ts"
import { parseLinkyContactInput, resolveLinkyContact } from "./linky-contact.ts"

const pubkey = "a".repeat(64)
const npub = npubEncode(pubkey)

const fetchDep = (answer: (url: string) => Response | Promise<Response>) => ({
  fetch: async (input: RequestInfo | URL) => answer(String(input)),
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("parseLinkyContactInput", () => {
  test("a bare name is a NIP-05 address on linky.fit", () => {
    expect(parseLinkyContactInput(" Hynek ")).toEqual({
      kind: "nip05",
      name: "hynek",
      domain: "linky.fit",
      address: "hynek@linky.fit",
    })
    expect(parseLinkyContactInput("hynek@Linky.fit")?.kind).toBe("nip05")
  })

  test("a name on another domain is not a contact, it is a Lightning address", () => {
    expect(parseLinkyContactInput("alice@walletofsatoshi.com")).toBeNull()
  })

  test("an npub, nprofile, hex key, nostr: URI or profile link names the key", () => {
    for (const text of [
      npub,
      `nostr:${npub}`,
      pubkey,
      nprofileEncode({ pubkey }),
      `https://linky.fit/p/${npub}`,
      `linky.fit/p/${npub}`,
    ]) {
      expect(parseLinkyContactInput(text)).toEqual({
        kind: "pubkey",
        pubkey,
        npub,
      })
    }
  })

  test("anything else is nothing", () => {
    for (const text of [
      "",
      "lnbc10n1pjfakeinvoice",
      "two words",
      "https://linky.fit/p/not-a-key",
      "npub1x",
    ]) {
      expect(parseLinkyContactInput(text)).toBeNull()
    }
  })
})

describe("resolveLinkyContact", () => {
  test("asks Linky's NIP-05 document for a name", async () => {
    const asked: string[] = []
    await using run = testCreateRun(
      fetchDep((url) => {
        asked.push(url)
        return json({ names: { hynek: pubkey } })
      })
    )
    await expect(run(resolveLinkyContact("hynek"))).resolves.toEqual({
      ok: true,
      value: { pubkey, npub, address: "hynek@linky.fit" },
    })
    expect(asked).toEqual([nip05Url({ name: "hynek", domain: "linky.fit" })])
  })

  test("a key given outright needs no lookup", async () => {
    await using run = testCreateRun(
      fetchDep(() => {
        throw new Error("no lookup expected")
      })
    )
    await expect(run(resolveLinkyContact(npub))).resolves.toEqual({
      ok: true,
      value: { pubkey, npub, address: null },
    })
  })

  test("a lookup failure is NIP-05's, for the address on linky.fit", async () => {
    await using run = testCreateRun(fetchDep(() => json({ names: {} })))
    await expect(run(resolveLinkyContact("nobody"))).resolves.toEqual({
      ok: false,
      error: { type: "Nip05NotFound", address: "nobody@linky.fit" },
    })
  })

  test("text that is not a contact is invalid", async () => {
    await using run = testCreateRun(fetchDep(() => json({ names: {} })))
    await expect(
      run(resolveLinkyContact("alice@walletofsatoshi.com"))
    ).resolves.toEqual({ ok: false, error: { type: "LinkyContactInvalid" } })
  })
})
