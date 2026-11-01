import { err, ok, type Task } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import type { AbstractSimplePool } from "nostr-tools/abstract-pool"
import { npubEncode } from "nostr-tools/nip19"
import { SimplePool } from "nostr-tools/pool"
import { finalizeEvent } from "nostr-tools/pure"
import { normalizeURL } from "nostr-tools/utils"
import { z } from "zod"

import type { DateDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  deriveNostrSecretKey,
  type MasterKey,
} from "../../modules/shared/key-derivation.ts"
import type { NonEmptyString255 } from "../../modules/shared/schema.ts"
import { secp256k1PublicKey } from "../../modules/shared/secp256k1-public-key.ts"
import { shortenMiddle } from "../../utils/shorten-middle.ts"
import { jsonCodec } from "../../zod-utils.ts"

const PROFILE_KIND = 0
export const RELAY_MAX_WAIT_MS = 6_000

export interface NostrDep {
  readonly nostr: {
    readonly relays: ReadonlyArray<string>
    readonly pool: Pick<
      AbstractSimplePool,
      | "get"
      | "publish"
      | "listConnectionStatus"
      | "subscribeMany"
      | "subscribeManyEose"
    >
  }
}

// ponytail: one pool for the app's lifetime, so relay sockets stay open
// between reads and publishes; close it on account switch if that matters.
let sharedPool: SimplePool | undefined

export const createNostrDep = (relays: ReadonlyArray<string>): NostrDep => {
  // Pings close a socket that died silently (a phone asleep, a dropped NAT
  // mapping), so the next publish reconnects instead of timing out and the
  // live chat subscription reports its close instead of going quiet.
  sharedPool ??= new SimplePool({ enablePing: true })
  return {
    nostr: {
      relays,
      pool: sharedPool,
    },
  }
}

export interface NostrIdentity {
  /** Hex public key, what relays are queried by. */
  readonly pubkey: string
  readonly npub: string
}

/**
 * Nostr's x-only public key is the compressed key without its parity byte,
 * which `secp256k1PublicKey` computes on the platform's native crypto where
 * it has one (nostr-tools' `getPublicKey` always runs noble's).
 */
export const getNostrIdentity = (masterKey: MasterKey): NostrIdentity => {
  const pubkey = bytesToHex(
    secp256k1PublicKey(deriveNostrSecretKey(masterKey)).subarray(1)
  )
  return { pubkey, npub: npubEncode(pubkey) }
}

/** `npub1abcd…wxyz` for labels; the full npub stays in the copy action. */
export const shortenNpub = (npub: string): string => shortenMiddle(npub, 12, 6)

/** What Payky shows and edits of a kind-0 profile. */
export interface NostrProfile {
  readonly name: string | null
  readonly picture: string | null
  /**
   * The published metadata as-is, so an edit republishes every field set
   * elsewhere (lud16, nip05, about, ...) unchanged.
   */
  readonly metadata: Readonly<Record<string, unknown>>
}

export const emptyNostrProfile: NostrProfile = {
  name: null,
  picture: null,
  metadata: {},
}

const ProfileMetadataSchema = z.looseObject({
  name: z.string().optional(),
  display_name: z.string().optional(),
  picture: z.string().optional(),
})
const ProfileMetadataJson = jsonCodec(ProfileMetadataSchema)

const isDisplayablePicture = (value: string): boolean => {
  if (value.startsWith("data:image/")) return true
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

const toNostrProfile = (
  metadata: z.output<typeof ProfileMetadataSchema>
): NostrProfile => {
  const name = (metadata.display_name ?? metadata.name ?? "").trim()
  const picture = (metadata.picture ?? "").trim()
  return {
    name: name === "" ? null : name,
    picture: isDisplayablePicture(picture) ? picture : null,
    metadata,
  }
}

/** `display_name` before `name`, as Linky reads it; `null` for non-metadata. */
export const profileFromMetadata = (value: unknown): NostrProfile | null => {
  const parsed = ProfileMetadataSchema.safeParse(value)
  return parsed.success ? toNostrProfile(parsed.data) : null
}

/** A kind-0 event's content as a profile; `null` when it is not metadata. */
export const parseProfileMetadata = (content: string): NostrProfile | null => {
  const parsed = z.safeDecode(ProfileMetadataJson, content)
  return parsed.success ? toNostrProfile(parsed.data) : null
}

/**
 * The metadata to publish after an edit. Everything else stays; the name is
 * written as both `name` and `display_name`, as Linky does — or both cleared.
 */
export const mergeProfileMetadata = ({
  current,
  name,
  picture,
}: {
  readonly current: Readonly<Record<string, unknown>>
  readonly name: string
  readonly picture: string | null
}): Record<string, unknown> => {
  const {
    name: _name,
    display_name: _displayName,
    picture: _picture,
    ...rest
  } = current
  const trimmed = name.trim()
  return {
    ...rest,
    ...(trimmed === "" ? {} : { name: trimmed, display_name: trimmed }),
    ...(picture === null ? {} : { picture }),
  }
}

export const createNostrRelaysUnreachableError = defineError(
  "NostrRelaysUnreachableError"
)()
export type NostrRelaysUnreachableError = ReturnType<
  typeof createNostrRelaysUnreachableError
>

export const createNostrPublishRejectedError = defineError(
  "NostrPublishRejectedError"
)<{ readonly reasons: ReadonlyArray<string> }>()
export type NostrPublishRejectedError = ReturnType<
  typeof createNostrPublishRejectedError
>

/**
 * The newest kind-0 event the relays hold, or the empty profile. Fails when
 * no relay connected: "no profile" and "no answer" look alike to the pool,
 * and treating the latter as empty would let a save wipe the real profile.
 */
export const fetchNostrProfile =
  ({
    pubkey,
    extraRelays = [],
  }: {
    readonly pubkey: string
    /**
     * Read on top of the app's relays, such as the profile indexers that
     * hold the support team's names; never written to.
     */
    readonly extraRelays?: ReadonlyArray<string>
  }): Task<NostrProfile, NostrRelaysUnreachableError, NostrDep> =>
  async (run) => {
    const { pool, relays } = run.deps.nostr
    const readRelays = [...new Set([...relays, ...extraRelays])]
    // The pool keeps the newest event of all of them.
    const event = await pool.get(
      readRelays,
      { kinds: [PROFILE_KIND], authors: [pubkey] },
      { maxWait: RELAY_MAX_WAIT_MS }
    )
    if (event !== null) {
      return ok(parseProfileMetadata(event.content) ?? emptyNostrProfile)
    }

    return isAnyRelayConnected(pool, readRelays)
      ? ok(emptyNostrProfile)
      : err(createNostrRelaysUnreachableError())
  }

/** Signs `metadata` with the account's key; ok once any relay accepted it. */
export const publishNostrProfile =
  ({
    metadata,
  }: {
    readonly metadata: Readonly<Record<string, unknown>>
  }): Task<
    void,
    NostrPublishRejectedError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const { pool, relays } = run.deps.nostr
    const event = finalizeEvent(
      {
        kind: PROFILE_KIND,
        created_at: Math.floor(run.deps.date.now().getTime() / 1000),
        tags: [],
        content: JSON.stringify(metadata),
      },
      deriveNostrSecretKey(run.deps.masterKey)
    )

    const results = await Promise.allSettled(
      pool.publish([...relays], event, { maxWait: RELAY_MAX_WAIT_MS })
    )
    if (isPublishAccepted(results)) return ok()

    return err(
      createNostrPublishRejectedError({ reasons: publishReasons(results) })
    )
  }

/** Reads before publishing a new name, preserving every other profile field. */
export const publishNostrProfileName =
  ({
    name,
  }: {
    readonly name: NonEmptyString255
  }): Task<
    NostrProfile,
    NostrRelaysUnreachableError | NostrPublishRejectedError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const { pubkey } = getNostrIdentity(run.deps.masterKey)
    const profile = await run(fetchNostrProfile({ pubkey }))
    if (!profile.ok) return profile

    const metadata = { ...profile.value.metadata, name, display_name: name }
    const published = await run(publishNostrProfile({ metadata }))
    if (!published.ok) return published
    return ok({ ...profile.value, name, metadata })
  }

/**
 * A relay that cannot be reached resolves with a "connection failure" string
 * instead of rejecting, so successes are counted explicitly.
 */
export const isPublishAccepted = (
  results: ReadonlyArray<PromiseSettledResult<string>>
): boolean =>
  results.some(
    (result) =>
      result.status === "fulfilled" &&
      !result.value.startsWith("connection failure")
  )

export const publishReasons = (
  results: ReadonlyArray<PromiseSettledResult<string>>
): ReadonlyArray<string> =>
  results.map((result) =>
    result.status === "fulfilled" ? result.value : String(result.reason)
  )

/**
 * Whether any of `relays` is connected — what tells "nothing stored" from
 * "nobody answered" after an empty read of them. Only those: the shared pool
 * also holds sockets to relays this read never asked.
 */
export const isAnyRelayConnected = (
  pool: Pick<AbstractSimplePool, "listConnectionStatus">,
  relays: ReadonlyArray<string>
): boolean => {
  const status = pool.listConnectionStatus()
  return relays.some((relay) => status.get(normalizeURL(relay)) === true)
}
