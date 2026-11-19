import { err, ok, type Task } from "@evolu/common"
import {
  DirectMessageRelaysList,
  EventDeletion,
  GiftWrap,
  PrivateDirectMessage,
  Reaction,
  Seal,
} from "nostr-tools/kinds"
import { decrypt, getConversationKey } from "nostr-tools/nip44"
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59"
import {
  type Event,
  type EventTemplate,
  finalizeEvent,
  getEventHash,
  getPublicKey,
  type VerifiedEvent,
  verifyEvent,
} from "nostr-tools/pure"
import { normalizeURL } from "nostr-tools/utils"
import { z } from "zod"

import type { DateDep, MasterKeyDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  deriveNostrSecretKey,
  type NostrSecretKey,
} from "../../modules/shared/key-derivation.ts"
import { jsonCodec } from "../../zod-utils.ts"
import {
  createNostrPublishRejectedError,
  createNostrRelaysUnreachableError,
  isAnyRelayConnected,
  isPublishAccepted,
  type NostrDep,
  type NostrPublishRejectedError,
  type NostrRelaysUnreachableError,
  publishReasons,
  RELAY_MAX_WAIT_MS,
} from "./nostr-client.ts"

/**
 * The support chat is one NIP-17 group per account: the account's own Nostr
 * key plus every support npub Payky's API serves (support/0001). NIP-17 names a
 * room by the set of its members, so each account gets its own room on the
 * support side, a reply from one member reaches all, and that set is also
 * what tells the chat apart from the account's other DMs.
 */

/**
 * The support team, as Payky's API serves it: who the group is with and
 * where it meets. Pubkeys are hex.
 */
export interface SupportTeam {
  /** Who every message goes to. */
  readonly pubkeys: ReadonlyArray<string>
  /**
   * Every earlier line-up. A changed team is a new NIP-17 room, and these
   * keep the old rooms' messages in the chat.
   */
  readonly formerTeams: ReadonlyArray<ReadonlyArray<string>>
  /** Where every copy goes and the chat reads; each member lists one. */
  readonly relays: ReadonlyArray<string>
  /** Read only: the team's profiles and the account's DM relay list. */
  readonly indexerRelays: ReadonlyArray<string>
}

/**
 * What is known of the account's kind 10050 list:
 * - `found`: it lists relays, so support can reply.
 * - `missing`: the relays that answered, an indexer among them, hold none, so
 *   one may be published without overwriting Linky's.
 * - `unverified`: no indexer answered, or the list names no relay, so
 *   support may have nowhere to reply and publishing could replace a list.
 */
export type DmInboxState = DmInbox["state"]

/** Where Amethyst delivers the account's DM inbox: its kind 10050 relays. */
export type DmInbox =
  | {
      readonly state: "found"
      readonly relays: ReadonlyArray<string>
      /** The newest list as the account signed it. */
      readonly list: Event
      /**
       * The team's relays and indexers that answered without `list`. Clients
       * look a list up there, so `ensureDmRelayList` copies it to them
       * (support/0004).
       */
      readonly lacking: ReadonlyArray<string>
    }
  | {
      readonly state: "missing" | "unverified"
      readonly relays: ReadonlyArray<string>
    }

export interface SupportMessage {
  /** The rumor id, the same in every member's copy. */
  readonly id: string
  /** Hex pubkey of the author. */
  readonly author: string
  readonly fromSupport: boolean
  readonly text: string
  /** Unix seconds, from the rumor; the wraps' own times are randomized. */
  readonly sentAt: number
  /**
   * What NIP-17 carries in the room: a message; a NIP-25 reaction, whose
   * `text` is the emoji; or a NIP-09 deletion, by which its author takes
   * back a message or a reaction of theirs.
   */
  readonly type: SupportMessageType
  /**
   * The ids a reaction reacts to (exactly one) or a deletion deletes; empty
   * for a message.
   */
  readonly refersTo: ReadonlyArray<string>
}

export type SupportMessageType = "message" | "reaction" | "deletion"

/** What the support team sees under each message (support/0001). */
export interface SupportClientInfo {
  readonly version: string
  readonly platform: string
}

const trailerPattern = /\n\n— Payky \S+ · \S+$/u

export const appendClientTrailer = (
  text: string,
  { version, platform }: SupportClientInfo
): string => `${text}\n\n— Payky ${version} · ${platform}`

/** The account's own message as typed, without the trailer it was sent with. */
export const stripClientTrailer = (text: string): string =>
  text.replace(trailerPattern, "")

const EventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number().int(),
  kind: z.number().int(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
})
const SealSchema = EventSchema.extend({ sig: z.string() })
const EventJson = jsonCodec(EventSchema)
const SealJson = jsonCodec(SealSchema)

/** A NIP-17 rumor: an unsigned kind 14 event. */
type NostrRumor = z.output<typeof EventSchema>

const decryptJson = <T>(
  codec: z.ZodType<T, string>,
  payload: string,
  secretKey: NostrSecretKey,
  pubkey: string
) =>
  z.safeDecode(codec, decrypt(payload, getConversationKey(secretKey, pubkey)))

const pTagValues = (tags: ReadonlyArray<ReadonlyArray<string>>) =>
  tags.flatMap(([name, value]) =>
    name === "p" && value !== undefined ? [value] : []
  )

/** What NIP-17 puts in a chat that the support chat reads, by kind. */
const chatKindTypes: Readonly<Record<number, SupportMessageType>> = {
  [PrivateDirectMessage]: "message",
  [Reaction]: "reaction",
  [EventDeletion]: "deletion",
}

/**
 * The rumor inside a gift wrap addressed to `secretKey` — a message or a
 * reaction — or `null`.
 * nostr-tools' `unwrapEvent` checks nothing, so this verifies the seal's
 * signature, that the seal and the rumor share their author and that the
 * rumor's id is its hash: without that anyone could post a message "from
 * support" asking for the recovery phrase.
 */
export const unwrapVerifiedRumor = ({
  wrap,
  secretKey,
}: {
  readonly wrap: Event
  readonly secretKey: NostrSecretKey
}): NostrRumor | null => {
  if (wrap.kind !== GiftWrap) return null
  try {
    const seal = decryptJson(SealJson, wrap.content, secretKey, wrap.pubkey)
    if (!seal.success || seal.data.kind !== Seal || !verifyEvent(seal.data)) {
      return null
    }
    const parsed = decryptJson(
      EventJson,
      seal.data.content,
      secretKey,
      seal.data.pubkey
    )
    if (!parsed.success) return null
    const rumor = parsed.data
    return chatKindTypes[rumor.kind] !== undefined &&
      rumor.pubkey === seal.data.pubkey &&
      getEventHash(rumor) === rumor.id
      ? rumor
      : null
  } catch {
    // Not encrypted to this key.
    return null
  }
}

/** A NIP-17 room: the rumor's author and every `p` tag. */
export const rumorRoom = (rumor: NostrRumor): ReadonlySet<string> =>
  new Set([rumor.pubkey, ...pTagValues(rumor.tags)])

/**
 * A gift wrap addressed to the account, as a support chat message, a
 * reaction or a deletion — or `null`. A message or a reaction belongs to the
 * chat when its room is exactly the account plus the team, current or
 * former: the account's other DMs, from Linky for one, share the key, and a
 * 1:1 with a single member of a larger team is not the support room. A
 * deletion counts by its author alone, the account or anyone who has been
 * on the team: it removes only its author's own events, so whom it tags
 * does not matter, and clients tag it differently.
 */
export const decodeSupportWrap = ({
  wrap,
  secretKey,
  team,
}: {
  readonly wrap: Event
  readonly secretKey: NostrSecretKey
  readonly team: SupportTeam
}): SupportMessage | null => {
  const rumor = unwrapVerifiedRumor({ wrap, secretKey })
  const type = rumor === null ? undefined : chatKindTypes[rumor.kind]
  if (rumor === null || type === undefined) return null

  const me = getPublicKey(secretKey)
  const lineUps = [team.pubkeys, ...team.formerTeams]
  const room = rumorRoom(rumor)
  const belongs =
    type === "deletion"
      ? [me, ...lineUps.flat()].includes(rumor.pubkey)
      : lineUps.some((lineUp) => {
          const supportRoom = new Set([me, ...lineUp])
          return (
            room.size === supportRoom.size &&
            [...supportRoom].every((pubkey) => room.has(pubkey))
          )
        })
  if (!belongs) return null

  const eTags = rumor.tags.flatMap(([name, value]) =>
    name === "e" && value !== undefined ? [value] : []
  )
  // NIP-25: the last `e` tag names the message reacted to.
  const refersTo = {
    message: [],
    reaction: eTags.slice(-1),
    deletion: eTags,
  }[type]
  if (type !== "message" && refersTo.length === 0) return null
  // The room holds only the account and support, so anyone else wrote it
  // from support.
  const fromSupport = rumor.pubkey !== me

  return {
    id: rumor.id,
    author: rumor.pubkey,
    fromSupport,
    text: fromSupport ? rumor.content : stripClientTrailer(rumor.content),
    sentAt: rumor.created_at,
    type,
    refersTo,
  }
}

/**
 * Every event `relays` hold for `filter`. Relays that keep gift wraps private
 * ask for NIP-42 AUTH, answered with the account's key.
 */
export const queryWithAuth = (
  pool: NostrDep["nostr"]["pool"],
  relays: ReadonlyArray<string>,
  filter: Parameters<NostrDep["nostr"]["pool"]["subscribeManyEose"]>[1],
  secretKey: NostrSecretKey
): Promise<ReadonlyArray<Event>> =>
  new Promise((resolve) => {
    const events: Event[] = []
    pool.subscribeManyEose([...relays], filter, {
      maxWait: RELAY_MAX_WAIT_MS,
      onevent: (event) => events.push(event),
      onclose: () => resolve(events),
      onauth: authSigner(secretKey),
    })
  })

export const authSigner =
  (secretKey: NostrSecretKey) =>
  async (template: EventTemplate): Promise<VerifiedEvent> =>
    finalizeEvent(template, secretKey)

const unique = (relays: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set(relays),
]

/** Where the chat reads: the team's relays and the account's DM inbox. */
const readRelays = (team: SupportTeam, inbox: DmInbox) =>
  unique([...team.relays, ...inbox.relays])

/**
 * The account's kind 10050 relays, looked up wherever it may live. The list
 * is Linky's as much as Payky's, so it is never changed: `missing` is what
 * allows `publishDmRelayList` for an account that has none, and a found
 * list's `lacking` says where `ensureDmRelayList` copies it as it is. Each
 * relay is asked on its own, because nostr-tools reports one that
 * timed out like one that answered: a relay answered when its query ended
 * before the timeout and its socket is open. Relays that did not answer are
 * left out rather than blocking the list for good — a dead default relay
 * would — and Linky publishes its list to every relay it uses, so a live one
 * holds it. The list counts as missing only when an indexer, where Amethyst
 * looks it up, answered too.
 */
export const loadDmInbox =
  ({
    team,
  }: {
    readonly team: SupportTeam
  }): Task<DmInbox, never, NostrDep & MasterKeyDep & DateDep> =>
  async (run) => {
    const { nostr, date } = run.deps
    const secretKey = deriveNostrSecretKey(run.deps.masterKey)
    const asked = unique([
      ...nostr.relays,
      ...team.indexerRelays,
      ...team.relays,
    ])
    const filter = {
      kinds: [DirectMessageRelaysList],
      authors: [getPublicKey(secretKey)],
    }
    const startedAt = date.now().getTime()
    const answers = await Promise.all(
      asked.map(async (relay) => {
        const lists = await queryWithAuth(
          nostr.pool,
          [relay],
          filter,
          secretKey
        )
        return { relay, lists, endedAt: date.now().getTime() }
      })
    )
    const status = nostr.pool.listConnectionStatus()
    const answered = answers.filter(
      ({ relay, endedAt }) =>
        endedAt - startedAt < RELAY_MAX_WAIT_MS &&
        status.get(normalizeURL(relay)) === true
    )
    const newest = answers
      .flatMap(({ lists }) => lists)
      .reduce<Event | undefined>(
        (current, list) =>
          current === undefined || current.created_at < list.created_at
            ? list
            : current,
        undefined
      )
    if (newest !== undefined) {
      const relays = newest.tags.flatMap(([name, url]) =>
        name === "relay" && url?.startsWith("wss://") === true ? [url] : []
      )
      if (relays.length === 0) {
        run.deps.console.warn(
          "[support] The DM relay list names no relay, so support cannot reply."
        )
        return ok({ relays, state: "unverified" })
      }
      const lookedUpOn = dmRelayListRelays(team)
      const lacking = answered
        .filter(
          ({ relay, lists }) =>
            lookedUpOn.includes(relay) &&
            !lists.some((list) => list.id === newest.id)
        )
        .map(({ relay }) => relay)
      return ok({ relays, state: "found", list: newest, lacking })
    }

    const answeredRelays = answered.map(({ relay }) => relay)
    const silent = asked.filter((relay) => !answeredRelays.includes(relay))
    const indexerAnswered = team.indexerRelays.some((relay) =>
      answeredRelays.includes(relay)
    )
    if (!indexerAnswered) {
      run.deps.console.warn(
        "[support] No DM relay list found, but no indexer answered, so none will be published.",
        { silent }
      )
    } else if (silent.length > 0) {
      run.deps.console.info(
        "[support] No DM relay list found; relays that did not answer are left out.",
        { silent }
      )
    }
    return ok({
      relays: [],
      state: indexerAnswered ? "missing" : "unverified",
    })
  }

/**
 * Where the account's 10050 list goes: the team's relays, which Amethyst
 * reads as the relays it has seen the account on, and the indexers, where it
 * looks a list up for an account with no NIP-65 relays.
 */
const dmRelayListRelays = (team: SupportTeam) =>
  unique([...team.relays, ...team.indexerRelays])

/** `event` to `relays`, ok once any of them accepted it. */
const publishAccountEvent =
  ({
    event,
    relays,
  }: {
    readonly event: Event
    readonly relays: ReadonlyArray<string>
  }): Task<void, NostrPublishRejectedError, NostrDep & MasterKeyDep> =>
  async (run) => {
    const secretKey = deriveNostrSecretKey(run.deps.masterKey)
    const results = await Promise.allSettled(
      run.deps.nostr.pool.publish([...relays], event, {
        maxWait: RELAY_MAX_WAIT_MS,
        onauth: authSigner(secretKey),
      })
    )
    if (isPublishAccepted(results)) return ok()

    const reasons = publishReasons(results)
    run.deps.console.warn(
      "[support] No relay accepted the DM relay list; support cannot reply yet.",
      { reasons }
    )
    return err(createNostrPublishRejectedError({ reasons }))
  }

/**
 * Publishes a kind 10050 list naming the team's relays to them and to the
 * indexers (`dmRelayListRelays`), and returns the inbox it makes. It replaces
 * whatever list the account has, so it is for one found `missing`, or one
 * the user chose to replace after a warning (support/0001).
 */
export const publishDmRelayList =
  ({
    team,
  }: {
    readonly team: SupportTeam
  }): Task<
    DmInbox,
    NostrPublishRejectedError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const list = finalizeEvent(
      {
        kind: DirectMessageRelaysList,
        created_at: Math.floor(run.deps.date.now().getTime() / 1000),
        tags: team.relays.map((relay) => ["relay", relay]),
        content: "",
      },
      deriveNostrSecretKey(run.deps.masterKey)
    )
    const published = await run(
      publishAccountEvent({ event: list, relays: dmRelayListRelays(team) })
    )
    if (!published.ok) return published
    return ok({ state: "found", relays: team.relays, list, lacking: [] })
  }

/**
 * Makes the account's DM relay list findable where clients look for it,
 * alongside a message to support (support/0004): an account found to have
 * none gets one, and a found list is copied, as signed and unchanged, to the
 * team's relays and indexers that answered without it — the same replaceable
 * event, so Linky's list stays Linky's and a list already everywhere is not
 * sent again. An unverified inbox is left to the chat's warning. Returns the
 * inbox as it now stands.
 */
export const ensureDmRelayList =
  ({
    team,
    inbox,
  }: {
    readonly team: SupportTeam
    readonly inbox: DmInbox
  }): Task<
    DmInbox,
    NostrPublishRejectedError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    if (inbox.state !== "found") {
      return inbox.state === "missing"
        ? await run(publishDmRelayList({ team }))
        : ok(inbox)
    }
    if (inbox.lacking.length === 0) return ok(inbox)
    const copied = await run(
      publishAccountEvent({ event: inbox.list, relays: inbox.lacking })
    )
    if (!copied.ok) return copied
    return ok({ ...inbox, lacking: [] })
  }

/** How far back NIP-59 may date a gift wrap, so how far back to listen. */
const WRAP_BACKDATE_SECONDS = 2 * 24 * 60 * 60

/** How much of the conversation is loaded when the chat opens. */
const HISTORY_SECONDS = 90 * 24 * 60 * 60

/**
 * The last ninety days of the conversation, oldest first, from the team's
 * relays and the account's DM inbox. Every DM to the account comes back
 * here, Linky's included, and only decrypting a wrap tells whose it is, so
 * the window keeps the cost of opening the chat bounded; the extra two days
 * cover a wrap's backdated `created_at`.
 */
export const fetchSupportMessages =
  ({
    team,
    inbox,
  }: {
    readonly team: SupportTeam
    readonly inbox: DmInbox
  }): Task<
    ReadonlyArray<SupportMessage>,
    NostrRelaysUnreachableError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const { nostr } = run.deps
    const secretKey = deriveNostrSecretKey(run.deps.masterKey)
    const now = Math.floor(run.deps.date.now().getTime() / 1000)
    const relays = readRelays(team, inbox)
    const wraps = await queryWithAuth(
      nostr.pool,
      relays,
      {
        kinds: [GiftWrap],
        "#p": [getPublicKey(secretKey)],
        since: now - HISTORY_SECONDS - WRAP_BACKDATE_SECONDS,
      },
      secretKey
    )
    if (wraps.length === 0 && !isAnyRelayConnected(nostr.pool, relays)) {
      return err(createNostrRelaysUnreachableError())
    }

    return ok(
      mergeSupportMessages(
        [],
        wraps.flatMap((wrap) => {
          const message = decodeSupportWrap({
            wrap,
            secretKey,
            team,
          })
          return message === null ? [] : [message]
        })
      )
    )
  }

/**
 * `current` with `incoming` added, oldest first, each message once: the
 * history, the live subscription and a send all deliver the same rumor ids.
 * Nothing is ever removed, so a read that missed a message cannot drop it.
 */
export const mergeSupportMessages = (
  current: ReadonlyArray<SupportMessage> | undefined,
  incoming: ReadonlyArray<SupportMessage>
): ReadonlyArray<SupportMessage> =>
  // A stable sort on purpose: times are whole seconds, so messages sent
  // within one keep the order they arrived in rather than an id's random one.
  [
    ...new Map(
      [...(current ?? []), ...incoming].map((message) => [message.id, message])
    ).values(),
  ].sort((a, b) => a.sentAt - b.sentAt)

/**
 * Listens for new messages while the chat is open: relays push each matching
 * wrap the moment they store it. `since` reaches two days back because a
 * fresh wrap carries a randomized past `created_at`; whatever that replays is
 * deduplicated by `mergeSupportMessages`. `onClose` fires once every relay
 * has dropped the subscription (the shared pool does not resubscribe: its
 * reconnect moves `since` past the newest wrap and would skip backdated
 * ones). Returns the function that ends it, which does not call `onClose`.
 */
export const subscribeSupportMessages = (
  { nostr, masterKey, date }: NostrDep & MasterKeyDep & DateDep,
  {
    team,
    inbox,
    onMessage,
    onClose,
  }: {
    readonly team: SupportTeam
    readonly inbox: DmInbox
    readonly onMessage: (message: SupportMessage) => void
    readonly onClose: () => void
  }
): (() => void) => {
  const secretKey = deriveNostrSecretKey(masterKey)
  let closedByCaller = false
  const subscription = nostr.pool.subscribeMany(
    [...readRelays(team, inbox)],
    {
      kinds: [GiftWrap],
      "#p": [getPublicKey(secretKey)],
      since: Math.floor(date.now().getTime() / 1000) - WRAP_BACKDATE_SECONDS,
    },
    {
      onevent: (wrap) => {
        const message = decodeSupportWrap({
          wrap,
          secretKey,
          team,
        })
        if (message !== null) onMessage(message)
      },
      onclose: () => {
        if (!closedByCaller) onClose()
      },
      onauth: authSigner(secretKey),
    }
  )
  return () => {
    closedByCaller = true
    subscription.close()
  }
}

const createSupportNotReachedError = defineError("SupportNotReachedError")<{
  readonly reasons: ReadonlyArray<string>
}>()
export type SupportNotReachedError = ReturnType<
  typeof createSupportNotReachedError
>

/**
 * Sends `text` to every support member at once, as one rumor carrying all of
 * their `p` tags (nostr-tools' `nip17.wrapManyEvents` would tag each copy
 * with one recipient only, splitting the group into 1:1 chats). Every copy
 * goes to the team's relays, which each member lists as a DM relay, so the
 * members' own lists are never looked up. Amethyst delivers the replies to
 * the account's DM inbox, which `ensureDmRelayList` makes findable; the account's
 * own copy goes where the chat reads.
 * Ok once a relay accepted a copy for support: the account's own copy alone
 * reaches nobody, so it is published only then. A message in the history is
 * therefore one a relay accepted for support, which is what its tick says.
 */
export const sendSupportMessage =
  ({
    text,
    subject,
    client,
    team,
    inbox,
  }: {
    readonly text: string
    /** The group's name in Amethyst. */
    readonly subject: string
    readonly client: SupportClientInfo
    readonly team: SupportTeam
    readonly inbox: DmInbox
  }): Task<
    SupportMessage,
    SupportNotReachedError,
    NostrDep & MasterKeyDep & DateDep
  > =>
  async (run) => {
    const { nostr } = run.deps
    const secretKey = deriveNostrSecretKey(run.deps.masterKey)
    const me = getPublicKey(secretKey)
    const now = Math.floor(run.deps.date.now().getTime() / 1000)
    const publish = (relays: ReadonlyArray<string>, event: Event) =>
      Promise.allSettled(
        nostr.pool.publish([...relays], event, {
          maxWait: RELAY_MAX_WAIT_MS,
          onauth: authSigner(secretKey),
        })
      )

    const rumor = createRumor(
      {
        kind: PrivateDirectMessage,
        created_at: now,
        content: appendClientTrailer(text, client),
        tags: [
          ...team.pubkeys.map((pubkey) => ["p", pubkey]),
          ["subject", subject],
        ],
      },
      secretKey
    )
    const wrapFor = (pubkey: string) =>
      createWrap(createSeal(rumor, secretKey, pubkey), pubkey)

    const results = (
      await Promise.all(
        team.pubkeys.map((pubkey) => publish(team.relays, wrapFor(pubkey)))
      )
    ).flat()
    if (!isPublishAccepted(results)) {
      return err(
        createSupportNotReachedError({ reasons: publishReasons(results) })
      )
    }
    // Not awaited: support has the message, and the send resolves before the
    // own copy comes back over the live subscription, so the two meet in
    // `mergeSupportMessages` by id instead of showing twice. It goes where
    // the chat and Linky read.
    // ponytail: a lost own copy still counts as sent but is missing from the
    // history after a reload; retry it if that shows up.
    void publish(readRelays(team, inbox), wrapFor(me))

    return ok({
      id: rumor.id,
      author: me,
      fromSupport: false,
      text,
      sentAt: now,
      type: "message",
      refersTo: [],
    })
  }
