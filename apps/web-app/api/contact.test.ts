import { PrivateDirectMessage } from "nostr-tools/kinds"
import { npubEncode } from "nostr-tools/nip19"
import { unwrapEvent } from "nostr-tools/nip59"
import { type Event, generateSecretKey, getPublicKey } from "nostr-tools/pure"
import { describe, expect, test, vi } from "vitest"

import { handleContactRequest, type Publish } from "./contact.ts"

const recipientKeys = [generateSecretKey(), generateSecretKey()]
const recipientPubkeys = recipientKeys.map((key) => getPublicKey(key))
const recipients = recipientPubkeys.map((pubkey) => npubEncode(pubkey))
const relays = ["wss://support-one.test", "wss://support-two.test"]

const contact = {
  email: "lumen@example.com",
  message: "We run a café and would like to try Payky.",
  businessName: "Café Lumen",
  language: "cs",
}

const contactRequest = (body: unknown, method = "POST") =>
  new Request("https://payky.me/api/contact", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : null,
  })

const accepting = (): Publish & { readonly sent: Array<[string[], Event]> } => {
  const sent: Array<[string[], Event]> = []
  const publish: Publish = (toRelays, event) => {
    sent.push([[...toRelays], event])
    return Promise.resolve(
      toRelays.map(() => ({ status: "fulfilled", value: "" }) as const)
    )
  }
  return Object.assign(publish, { sent })
}

describe("handleContactRequest", () => {
  test("sends the message as one rumor tagging every recipient, wrapped for each, to the relays", async () => {
    const publish = accepting()

    const response = await handleContactRequest(contactRequest(contact), {
      recipients,
      relays,
      publish,
      now: () => 1_700_000_000_000,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "OK" })
    expect(publish.sent.map(([toRelays]) => toRelays)).toEqual([relays, relays])

    const rumors = recipientKeys.map((key, index) => {
      const sentToRecipient = publish.sent[index]
      if (sentToRecipient === undefined) throw new Error("No wrap sent")
      return unwrapEvent(sentToRecipient[1], key)
    })
    expect(new Set(rumors.map((rumor) => rumor.id)).size).toBe(1)
    const rumor = rumors[0]
    if (rumor === undefined) throw new Error("No rumor")
    expect(rumor.kind).toBe(PrivateDirectMessage)
    expect(rumor.created_at).toBe(1_700_000_000)
    expect(rumor.tags).toEqual([
      ...recipientPubkeys.map((pubkey) => ["p", pubkey]),
      ["subject", "Payky web contact: Café Lumen"],
    ])
    expect(rumor.content).toContain("Email: lumen@example.com")
    expect(rumor.content).toContain("Business: Café Lumen")
    expect(rumor.content).toContain(contact.message)
    expect(recipientPubkeys).not.toContain(rumor.pubkey)
  })

  test("names the app the deployment serves in the subject", async () => {
    vi.stubEnv("PAYKY_BRAND", "finito")
    const publish = accepting()

    await handleContactRequest(contactRequest(contact), {
      recipients,
      relays,
      publish,
    })
    vi.unstubAllEnvs()

    const wrap = publish.sent[0]
    const recipientKey = recipientKeys[0]
    if (wrap === undefined || recipientKey === undefined) {
      throw new Error("No message sent")
    }
    expect(unwrapEvent(wrap[1], recipientKey).tags).toContainEqual([
      "subject",
      "Finito web contact: Café Lumen",
    ])
  })

  test("uses a fresh key for every message", async () => {
    const publish = accepting()

    await handleContactRequest(contactRequest(contact), {
      recipients,
      relays,
      publish,
    })
    await handleContactRequest(contactRequest(contact), {
      recipients,
      relays,
      publish,
    })

    // Each message wraps for both recipients; the first wrap of each
    // message is for the first recipient.
    const first = publish.sent[0]
    const second = publish.sent[2]
    if (first === undefined || second === undefined) {
      throw new Error("Expected two messages")
    }
    const recipientKey = recipientKeys[0]
    if (recipientKey === undefined) throw new Error("No recipient key")
    expect(unwrapEvent(first[1], recipientKey).pubkey).not.toBe(
      unwrapEvent(second[1], recipientKey).pubkey
    )
  })

  test("reports when no relay accepted a copy", async () => {
    const publish = vi.fn<Publish>((toRelays) =>
      Promise.resolve(
        toRelays.map(
          () =>
            ({ status: "rejected", reason: new Error("timed out") }) as const
        )
      )
    )

    const response = await handleContactRequest(contactRequest(contact), {
      recipients,
      relays,
      publish,
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      status: "ERROR",
      reason: "No relay accepted the message.",
    })
  })

  test("drops a message that fills the honeypot, answering as if sent", async () => {
    const publish = accepting()

    const response = await handleContactRequest(
      contactRequest({ ...contact, website: "https://spam.example" }),
      { recipients, relays, publish }
    )

    expect(response.status).toBe(200)
    expect(publish.sent).toEqual([])
  })

  test.each([
    ["no contact", { message: "Hi", language: "en" }],
    ["an invalid email", { ...contact, email: "nope" }],
    ["a phone too short", { phone: "12", language: "en" }],
    ["malformed JSON", "{"],
  ])("rejects a body with %s", async (_, body) => {
    const publish = accepting()
    const request = new Request("https://payky.me/api/contact", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })

    const response = await handleContactRequest(request, {
      recipients,
      relays,
      publish,
    })

    expect(response.status).toBe(400)
    expect(publish.sent).toEqual([])
  })

  test("answers a CORS preflight and refuses other methods", async () => {
    const publish = accepting()
    const options = { recipients, relays, publish }

    expect(
      (await handleContactRequest(contactRequest(null, "OPTIONS"), options))
        .status
    ).toBe(200)
    expect(
      (await handleContactRequest(contactRequest(null, "GET"), options)).status
    ).toBe(405)
    expect(publish.sent).toEqual([])
  })
})
