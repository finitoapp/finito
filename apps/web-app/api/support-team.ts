import { npubToHex } from "@payky/core/integrations/nostr/npub"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import {
  loadServerEnv,
  throwInvalidServerEnv,
} from "../src/server/server-env.js"
import { jsonApi } from "./_http.js"

/**
 * The support chat's team (support/0001), served so it can change with a
 * deploy instead of an app release.
 */
export interface SupportTeamResponse {
  /** Who every message goes to. */
  readonly pubkeys: ReadonlyArray<string>
  /**
   * Every earlier line-up, so the app still recognises their rooms: NIP-17
   * names a room by its exact members, so a changed team is a new room.
   */
  readonly formerTeams: ReadonlyArray<ReadonlyArray<string>>
  /** Where every copy goes and the chat reads; each member lists one. */
  readonly relays: ReadonlyArray<string>
  /**
   * Profile indexers, only ever read: they hold the team's names and
   * pictures and the account's DM relay list when these live elsewhere.
   */
  readonly indexerRelays: ReadonlyArray<string>
}

interface SupportTeamError {
  readonly status: "ERROR"
  readonly reason: string
}

const isNpub = (value: string): boolean => npubToHex(value) !== null

const RelayListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url !== "")
  )
  .pipe(z.array(z.url({ protocol: /^wss?$/u })).min(1))

export const NpubListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((npub) => npub.trim())
      .filter((npub) => npub !== "")
  )
  .pipe(z.array(z.string().refine(isNpub, "Not an npub.")).min(1))

const supportTeamEnvShape = {
  PAYKY_SUPPORT_NPUBS: NpubListSchema.default([
    "npub1ysdhhw8wx4ew4490mrfpd2gyv3w08rqudqp5pjasgn2kxduahuhstrqnll",
    "npub1lhxycw3zsyyhz47khqcsw65f4m94p0fuvrs6lxvcqrwv5w0xxs8saaejq0",
  ]),
  // Teams separated by ";", members by ",", oldest first. When the team
  // changes, its line-up until then is appended here.
  PAYKY_SUPPORT_FORMER_TEAMS: z
    .string()
    .transform((value) =>
      value
        .split(";")
        .map((team) => team.trim())
        .filter((team) => team !== "")
    )
    .pipe(z.array(NpubListSchema))
    .default([
      ["npub1ysdhhw8wx4ew4490mrfpd2gyv3w08rqudqp5pjasgn2kxduahuhstrqnll"],
    ]),
  PAYKY_SUPPORT_RELAYS: RelayListSchema.default([
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.0xchat.com",
    "wss://nostr.linky.fit",
  ]),
  PAYKY_SUPPORT_INDEXER_RELAYS: RelayListSchema.default([
    "wss://purplepag.es",
    "wss://profiles.nostr1.com",
  ]),
}

/**
 * The team as configured for this deploy, read per request (`loadServerEnv`)
 * so a bad value answers as misconfigured instead of failing the cold start;
 * `api/contact.ts` writes to it too.
 */
export const loadSupportTeam = (): SupportTeamResponse | null => {
  const env = loadServerEnv(() =>
    createEnv({
      server: supportTeamEnvShape,
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
      onValidationError: throwInvalidServerEnv,
    })
  )
  return env === null
    ? null
    : {
        pubkeys: env.PAYKY_SUPPORT_NPUBS,
        formerTeams: env.PAYKY_SUPPORT_FORMER_TEAMS,
        relays: env.PAYKY_SUPPORT_RELAYS,
        indexerRelays: env.PAYKY_SUPPORT_INDEXER_RELAYS,
      }
}

// A deploy reaches every app within five minutes.
const { jsonResponse, preflightResponse } = jsonApi<
  SupportTeamResponse | SupportTeamError
>({
  cacheControl: "public, max-age=300",
  methods: "GET",
})

export const handleSupportTeamRequest = (
  request: Request,
  team: SupportTeamResponse | null = loadSupportTeam()
): Response => {
  if (request.method === "OPTIONS") return preflightResponse()

  if (request.method !== "GET") {
    return jsonResponse(
      { status: "ERROR", reason: "Method not allowed." },
      { status: 405 }
    )
  }

  if (team === null) {
    return jsonResponse(
      { status: "ERROR", reason: "The support team is misconfigured." },
      { status: 500 }
    )
  }

  return jsonResponse(team)
}

const handleRequest = (request: Request): Response =>
  handleSupportTeamRequest(request)

export const GET = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
