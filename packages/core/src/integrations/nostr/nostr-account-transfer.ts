import { hmac } from "@noble/hashes/hmac.js"
import { sha256 } from "@noble/hashes/sha2.js"
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
} from "@noble/hashes/utils.js"
import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44"
import {
  type Event,
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure"
import { z } from "zod"

import type { DateDep } from "../../deps.ts"
import { MasterKeySchema } from "../../modules/shared/key-derivation.ts"
import { encodePairUri, type PairUri } from "../../modules/shared/payky-uri.ts"
import {
  NonEmptyString255Schema,
  WssUrlSchema,
} from "../../modules/shared/schema.ts"
import { jsonCodec } from "../../zod-utils.ts"
import {
  isPublishAccepted,
  type NostrDep,
  RELAY_MAX_WAIT_MS,
} from "./nostr-client.ts"

/**
 * Moves an account to another device (account/0001): the source shows a
 * `payky:pair` QR with an ephemeral pubkey and a session secret `s`, the
 * target answers over a Nostr relay, the user types the target's code into
 * the source, and only then does the master key travel, NIP-44-encrypted
 * between two throwaway keys.
 *
 * Ephemeral keys and `s` live in the session's closure only — never in
 * storage, logs or errors — and are zeroed when it ends. JS cannot promise
 * that no copy survives (the hex strings and the conversation keys are
 * immutable), so the zeroing is best effort.
 */

/** An ephemeral kind no NIP lists, so relays forward it and store nothing. */
export const PAYKY_PAIR_KIND = 28_581

/** NIP-40, for relays that store ephemeral events anyway. */
const EXPIRATION_SECONDS = 180

export const QR_LIFETIME_MS = 120_000
export const CODE_ENTRY_MS = 120_000
export const CODE_ATTEMPTS = 3
export const ACK_WAIT_MS = 30_000
export const TARGET_PAYLOAD_WAIT_MS = 300_000

const AbortReasonSchema = z.enum([
  "cancelled",
  "conflict",
  "codeMismatch",
  "timeout",
])
export type TransferAbortReason = z.output<typeof AbortReasonSchema>

/** What arrives on the target; a duplicate transport counts once. */
export const TransferPayloadSchema = z.object({
  masterKey: MasterKeySchema,
  accountName: NonEmptyString255Schema,
  transports: z
    .array(WssUrlSchema)
    .max(8)
    .transform((urls) => [...new Set(urls)]),
})
export type TransferPayload = z.output<typeof TransferPayloadSchema>

/**
 * The payload that sends `account` away, the same for the QR transfer and the
 * app-to-app request (account/0001, account/0008): its master key and name,
 * and its transports less any that are not `wss`, each once, at most eight.
 */
export const createTransferPayload = (account: {
  readonly masterKey: TransferPayload["masterKey"]
  readonly name: string
  readonly transports: ReadonlyArray<{ readonly url: string }>
}): TransferPayload => ({
  masterKey: account.masterKey,
  accountName: NonEmptyString255Schema.decode(account.name),
  transports: [
    ...new Set(
      account.transports.flatMap(({ url }) => {
        const parsed = WssUrlSchema.safeParse(url)
        return parsed.success ? [parsed.data] : []
      })
    ),
  ].slice(0, 8),
})

const Hex32Schema = z.string().regex(/^[0-9a-f]{64}$/u)
const AbortMessageSchema = z.object({
  t: z.literal("abort"),
  reason: AbortReasonSchema,
})

/** Decoded per direction, so a message of the other one is dropped. */
const ToSourceJson = jsonCodec(
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("hello"), proof: Hex32Schema }),
    z.object({ t: z.literal("ack") }),
    AbortMessageSchema,
  ])
)
const ToTargetJson = jsonCodec(
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("ready") }),
    // Validated on its own: a payload that fails ends the session, unlike a
    // message that does not decode at all.
    z.object({ t: z.literal("payload"), data: z.unknown() }),
    AbortMessageSchema,
  ])
)

type Message =
  | { readonly t: "hello"; readonly proof: string }
  | { readonly t: "ready" }
  | { readonly t: "payload"; readonly data: TransferPayload }
  | { readonly t: "ack" }
  | { readonly t: "abort"; readonly reason: TransferAbortReason }

const keyedHash = (
  label: string,
  sessionSecret: Uint8Array,
  sourcePubkey: string,
  targetPubkey: string
) =>
  hmac(
    sha256,
    sessionSecret,
    concatBytes(
      utf8ToBytes(label),
      hexToBytes(sourcePubkey),
      hexToBytes(targetPubkey)
    )
  )

/** Proves a `hello` comes from someone who saw the QR; 64 hex. */
export const computeHelloProof = (
  sessionSecret: Uint8Array,
  sourcePubkey: string,
  targetPubkey: string
): string =>
  bytesToHex(
    keyedHash("payky:pair:hello:v1", sessionSecret, sourcePubkey, targetPubkey)
  )

/** The six digits both sides compute and neither sends. */
export const computeTransferCode = (
  sessionSecret: Uint8Array,
  sourcePubkey: string,
  targetPubkey: string
): string => {
  const hash = keyedHash(
    "payky:pair:code:v1",
    sessionSecret,
    sourcePubkey,
    targetPubkey
  )
  const value = new DataView(hash.buffer, hash.byteOffset).getUint32(0)
  return String(value % 1_000_000).padStart(6, "0")
}

/** `482913` as `482 913`. */
export const formatTransferCode = (code: string): string =>
  `${code.slice(0, 3)} ${code.slice(3)}`

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

/** The parts of a session the network touches. */
const createChannel = (
  { nostr, date }: NostrDep & DateDep,
  {
    relays,
    secretKey,
    onEvent,
    onClose,
  }: {
    readonly relays: ReadonlyArray<string>
    readonly secretKey: Uint8Array
    readonly onEvent: (event: Event) => void
    readonly onClose: () => void
  }
) => {
  const pubkey = getPublicKey(secretKey)
  const seen = new Set<string>()
  let closed = false
  // No `since`: the key is fresh, so nothing older is addressed to it, and a
  // `since` from a clock running behind would make relays drop events.
  const subscription = nostr.pool.subscribeMany(
    [...relays],
    { kinds: [PAYKY_PAIR_KIND], "#p": [pubkey] },
    {
      onevent: (event) => {
        if (closed || seen.has(event.id)) return
        seen.add(event.id)
        onEvent(event)
      },
      onclose: () => {
        if (!closed) onClose()
      },
    }
  )

  const send = async (to: string, message: Message): Promise<boolean> => {
    const now = Math.floor(date.now().getTime() / 1000)
    const event = finalizeEvent(
      {
        kind: PAYKY_PAIR_KIND,
        created_at: now,
        tags: [
          ["p", to],
          ["expiration", String(now + EXPIRATION_SECONDS)],
        ],
        content: encrypt(
          JSON.stringify(message),
          getConversationKey(secretKey, to)
        ),
      },
      secretKey
    )
    return isPublishAccepted(
      await Promise.allSettled(
        nostr.pool.publish([...relays], event, { maxWait: RELAY_MAX_WAIT_MS })
      )
    )
  }

  /** The plaintext, or `null` when it is not encrypted to this key. */
  const open = (event: Event): string | null => {
    try {
      return decrypt(event.content, getConversationKey(secretKey, event.pubkey))
    } catch {
      return null
    }
  }

  const close = () => {
    if (closed) return
    closed = true
    subscription.close()
    secretKey.fill(0)
  }

  return { pubkey, send, open, close }
}

export type TransferSourceState =
  | {
      readonly phase: "waiting"
      readonly uri: string
      readonly expiresAt: number
    }
  | { readonly phase: "expired" }
  | {
      readonly phase: "locked"
      /** `null` once the QR expired; the locked session goes on. */
      readonly uri: string | null
      readonly expiresAt: number
      readonly attemptsLeft: number
      readonly mismatch: boolean
    }
  | { readonly phase: "sending" }
  | { readonly phase: "done"; readonly acked: boolean }
  | {
      readonly phase: "failed"
      readonly reason: TransferAbortReason | "network"
    }

export interface TransferSource {
  readonly submitCode: (code: string) => void
  readonly cancel: () => void
}

/**
 * The device with the account: shows the QR, locks onto the first device
 * whose `hello` proves it saw it, and sends the payload once the user typed
 * that device's code. Every state change goes to `onState`.
 */
export const startTransferSource = (
  deps: NostrDep & DateDep,
  {
    payload,
    onState,
  }: {
    readonly payload: TransferPayload
    readonly onState: (state: TransferSourceState) => void
  }
): TransferSource => {
  const relays = deps.nostr.relays.slice(0, 2)
  const sessionSecret = randomBytes(16)
  const secretKey = generateSecretKey()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const helloPubkeys = new Set<string>()
  let state: TransferSourceState = {
    phase: "waiting",
    uri: encodePairUri({
      pk: getPublicKey(secretKey),
      s: bytesToHex(sessionSecret),
      r: relays,
    }),
    expiresAt: deps.date.now().getTime() + QR_LIFETIME_MS,
  }
  let lockedPubkey: string | null = null
  let codeConfirmed = false
  let payloadSent = false

  const finish = (next: TransferSourceState) => {
    for (const timer of timers) clearTimeout(timer)
    channel.close()
    sessionSecret.fill(0)
    emit(next)
  }
  const isOver = () =>
    state.phase === "done" ||
    state.phase === "failed" ||
    state.phase === "expired"
  const emit = (next: TransferSourceState) => {
    state = next
    onState(next)
  }
  const after = (ms: number, callback: () => void) => {
    timers.add(setTimeout(callback, ms))
  }
  const abortAll = (pubkeys: Iterable<string>, reason: TransferAbortReason) => {
    for (const pubkey of pubkeys)
      void channel.send(pubkey, { t: "abort", reason })
  }

  const onHello = (pubkey: string, proof: string) => {
    if (codeConfirmed || helloPubkeys.has(pubkey)) return
    if (
      !constantTimeEqual(
        proof,
        computeHelloProof(sessionSecret, channel.pubkey, pubkey)
      )
    ) {
      return
    }
    helloPubkeys.add(pubkey)

    if (lockedPubkey !== null) {
      abortAll(helloPubkeys, "conflict")
      finish({ phase: "failed", reason: "conflict" })
      return
    }

    lockedPubkey = pubkey
    const uri = state.phase === "waiting" ? state.uri : null
    emit({
      phase: "locked",
      uri,
      expiresAt: deps.date.now().getTime() + CODE_ENTRY_MS,
      attemptsLeft: CODE_ATTEMPTS,
      mismatch: false,
    })
    after(CODE_ENTRY_MS, () => {
      if (codeConfirmed || isOver()) return
      abortAll([pubkey], "timeout")
      finish({ phase: "failed", reason: "timeout" })
    })
    void (async () => {
      const accepted = await channel.send(pubkey, { t: "ready" })
      if (!accepted && !isOver()) finish({ phase: "failed", reason: "network" })
    })()
  }

  const channel = createChannel(deps, {
    relays,
    secretKey,
    onEvent: (event) => {
      if (isOver()) return
      const text = channel.open(event)
      if (text === null) return
      const decoded = z.safeDecode(ToSourceJson, text)
      if (!decoded.success) return
      const message = decoded.data

      if (message.t === "hello") {
        onHello(event.pubkey, message.proof)
        return
      }
      // Only the locked device may confirm or end the session.
      if (event.pubkey !== lockedPubkey) return
      if (message.t === "ack") {
        if (payloadSent) finish({ phase: "done", acked: true })
        return
      }
      // Once the code is confirmed the payload may be on its way, so the
      // session can no longer report that nothing was sent.
      if (!codeConfirmed) finish({ phase: "failed", reason: message.reason })
    },
    onClose: () => {
      if (isOver()) return
      if (payloadSent) finish({ phase: "done", acked: false })
      else finish({ phase: "failed", reason: "network" })
    },
  })

  onState(state)
  after(QR_LIFETIME_MS, () => {
    if (state.phase === "waiting") finish({ phase: "expired" })
    else if (state.phase === "locked") emit({ ...state, uri: null })
  })

  const submitCode = (code: string) => {
    if (state.phase !== "locked" || lockedPubkey === null) return
    const target = lockedPubkey
    const expected = computeTransferCode(sessionSecret, channel.pubkey, target)
    if (!constantTimeEqual(code.replace(/\s/gu, ""), expected)) {
      const attemptsLeft = state.attemptsLeft - 1
      if (attemptsLeft > 0) {
        emit({ ...state, attemptsLeft, mismatch: true })
        return
      }
      abortAll([target], "codeMismatch")
      finish({ phase: "failed", reason: "codeMismatch" })
      return
    }

    codeConfirmed = true
    emit({ phase: "sending" })
    void (async () => {
      const accepted = await channel.send(target, {
        t: "payload",
        data: payload,
      })
      if (isOver()) return
      if (!accepted) {
        finish({ phase: "failed", reason: "network" })
        return
      }
      payloadSent = true
      after(ACK_WAIT_MS, () => {
        if (!isOver()) finish({ phase: "done", acked: false })
      })
    })()
  }

  const cancel = () => {
    if (isOver()) return
    if (lockedPubkey !== null && !codeConfirmed) {
      abortAll([lockedPubkey], "cancelled")
    }
    finish(
      codeConfirmed
        ? { phase: "done", acked: false }
        : { phase: "failed", reason: "cancelled" }
    )
  }

  return { submitCode, cancel }
}

export type TransferTargetState =
  | { readonly phase: "connecting" }
  | { readonly phase: "code"; readonly code: string }
  | { readonly phase: "received"; readonly payload: TransferPayload }
  | {
      readonly phase: "failed"
      readonly reason: TransferAbortReason | "network" | "invalid"
    }

/**
 * The new device: answers a scanned QR with a `hello`, shows the code once
 * the source confirms it locked onto this device, and hands over the
 * payload. Anything not signed by the QR's key is dropped, and nothing at
 * all is read after a valid payload.
 */
export const startTransferTarget = (
  deps: NostrDep & DateDep,
  {
    pair,
    onState,
  }: {
    readonly pair: PairUri
    readonly onState: (state: TransferTargetState) => void
  }
): { readonly cancel: () => void } => {
  const sessionSecret = hexToBytes(pair.s)
  let state: TransferTargetState = { phase: "connecting" }
  let timer: ReturnType<typeof setTimeout> | undefined

  const isOver = () => state.phase === "received" || state.phase === "failed"
  const finish = (next: TransferTargetState) => {
    clearTimeout(timer)
    channel.close()
    sessionSecret.fill(0)
    state = next
    onState(next)
  }

  const channel = createChannel(deps, {
    relays: pair.r,
    secretKey: generateSecretKey(),
    onEvent: (event) => {
      if (isOver() || event.pubkey !== pair.pk) return
      const text = channel.open(event)
      if (text === null) return
      const decoded = z.safeDecode(ToTargetJson, text)
      if (!decoded.success) return
      const message = decoded.data

      if (message.t === "abort") {
        finish({ phase: "failed", reason: message.reason })
        return
      }
      if (message.t === "ready") {
        if (state.phase !== "connecting") return
        state = {
          phase: "code",
          code: computeTransferCode(sessionSecret, pair.pk, channel.pubkey),
        }
        onState(state)
        return
      }
      if (state.phase !== "code") return
      const payload = TransferPayloadSchema.safeParse(message.data)
      if (!payload.success) {
        finish({ phase: "failed", reason: "invalid" })
        return
      }
      // "Received", not "added": the user may still decline. Sent before
      // the channel closes and zeroes the key it signs with.
      void channel.send(pair.pk, { t: "ack" })
      finish({ phase: "received", payload: payload.data })
    },
    onClose: () => {
      if (!isOver()) finish({ phase: "failed", reason: "network" })
    },
  })

  onState(state)
  timer = setTimeout(() => {
    if (!isOver()) finish({ phase: "failed", reason: "timeout" })
  }, TARGET_PAYLOAD_WAIT_MS)
  void (async () => {
    const accepted = await channel.send(pair.pk, {
      t: "hello",
      proof: computeHelloProof(sessionSecret, pair.pk, channel.pubkey),
    })
    if (!accepted && !isOver()) finish({ phase: "failed", reason: "network" })
  })()

  return {
    cancel: () => {
      if (isOver()) return
      void channel.send(pair.pk, { t: "abort", reason: "cancelled" })
      finish({ phase: "failed", reason: "cancelled" })
    },
  }
}
