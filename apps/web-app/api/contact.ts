import { npubToHex } from "@payky/core/integrations/nostr/npub"
import {
  ContactMessageSchema,
  contactMessageSubject,
  formatContactMessage,
} from "@payky/core/modules/contact/contact-message"
import { jsonCodec } from "@payky/core/zod-utils"
import { createEnv } from "@t3-oss/env-core"
import { PrivateDirectMessage } from "nostr-tools/kinds"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import { SimplePool } from "nostr-tools/pool"
import { type Event, generateSecretKey } from "nostr-tools/pure"
import { z } from "zod"
import { loadServerBrandName } from "../src/server/server-brand.js"
import { jsonApi } from "./_http.js"
import { currentTeam, NpubListSchema } from "./support-team.js"

/**
 * The landing page's contact form (support/0003): the message goes to the
 * configured npubs as one NIP-17 chat message, the same way the app's
 * support chat delivers (support/0001), from a key made for that one
 * message. The server holds no key and keeps nothing; a relay that
 * accepted a copy for a recipient is the only trace.
 */

const RELAY_MAX_WAIT_MS = 6_000

const env = createEnv({
  server: {
    // Who the form writes to; a test npub while the form is tried out.
    PAYKY_CONTACT_NPUBS: NpubListSchema.default([
      "npub1rfqkezd7zzrxlk8hfg7vmnfed6yyt0muj2qwg36xmt2c9y9vatgsp6eupe",
    ]),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export type PublishResults = ReadonlyArray<PromiseSettledResult<string>>

/** Sends `event` to `relays`, settling per relay as nostr-tools' pool does. */
export type Publish = (
  relays: ReadonlyArray<string>,
  event: Event
) => Promise<PublishResults>

interface ContactResponse {
  readonly status: "OK"
}

interface ContactError {
  readonly status: "ERROR"
  readonly reason: string
}

const { jsonResponse, preflightResponse } = jsonApi<
  ContactResponse | ContactError
>({
  cacheControl: "no-store",
  methods: "POST",
})

const ContactMessageJson = jsonCodec(ContactMessageSchema)

const publishToRelays: Publish = async (relays, event) => {
  const pool = new SimplePool()
  try {
    return await Promise.allSettled(
      pool.publish([...relays], event, { maxWait: RELAY_MAX_WAIT_MS })
    )
  } finally {
    pool.destroy()
  }
}

export const handleContactRequest = async (
  request: Request,
  {
    recipients = env.PAYKY_CONTACT_NPUBS,
    relays = currentTeam.relays,
    publish = publishToRelays,
    now = () => Date.now(),
  }: {
    /** Npubs every message goes to. */
    readonly recipients?: ReadonlyArray<string>
    /** Where every copy goes; the support team's relays by default. */
    readonly relays?: ReadonlyArray<string>
    readonly publish?: Publish
    readonly now?: () => number
  } = {}
): Promise<Response> => {
  if (request.method === "OPTIONS") return preflightResponse()

  if (request.method !== "POST") {
    return jsonResponse(
      { status: "ERROR", reason: "Method not allowed." },
      { status: 405 }
    )
  }

  const body = z.safeDecode(ContactMessageJson, await request.text())
  if (!body.success) {
    return jsonResponse(
      { status: "ERROR", reason: "Expected a contact message." },
      { status: 400 }
    )
  }

  // A bot filled the field the form never shows: answer as if sent, so it
  // learns nothing, and send nothing.
  if (body.data.website !== undefined && body.data.website !== "") {
    return jsonResponse({ status: "OK" })
  }

  const pubkeys = recipients.map(npubToHex)
  if (!pubkeys.every((pubkey) => pubkey !== null)) {
    return jsonResponse(
      { status: "ERROR", reason: "The contact recipients are misconfigured." },
      { status: 500 }
    )
  }

  const appName = loadServerBrandName()
  if (appName === null) {
    return jsonResponse(
      { status: "ERROR", reason: "The app brand is misconfigured." },
      { status: 500 }
    )
  }

  // One key per message: there is nobody to reply to over Nostr, which is
  // why the form asks for an email or a phone.
  const secretKey = generateSecretKey()
  const rumor = createRumor(
    {
      kind: PrivateDirectMessage,
      created_at: Math.floor(now() / 1000),
      content: formatContactMessage(body.data),
      tags: [
        ...pubkeys.map((pubkey) => ["p", pubkey]),
        ["subject", contactMessageSubject(body.data, appName)],
      ],
    },
    secretKey
  )

  const results = (
    await Promise.all(
      pubkeys.map((pubkey) =>
        publish(
          relays,
          createWrap(createSeal(rumor, secretKey, pubkey), pubkey)
        )
      )
    )
  ).flat()

  if (!results.some((result) => result.status === "fulfilled")) {
    return jsonResponse(
      { status: "ERROR", reason: "No relay accepted the message." },
      { status: 502 }
    )
  }

  return jsonResponse({ status: "OK" })
}

const handleRequest = (request: Request): Promise<Response> =>
  handleContactRequest(request)

export const POST = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
