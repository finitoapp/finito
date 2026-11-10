import { type SqliteBoolean, sqliteTrue } from "@evolu/common"
import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"
import {
  NonNegativeIntegerSchema,
  TimestampMs,
  TimestampMsSchema,
  type WssUrl,
  WssUrlSchema,
} from "../shared/schema.ts"

export const SelfPayPublishResultSchema = z.object({
  at: TimestampMsSchema,
  version: NonNegativeIntegerSchema,
  contentHash: z.string(),
  relays: z
    .array(z.object({ url: WssUrlSchema, accepted: z.boolean() }))
    .readonly(),
})
export type SelfPayPublishResult = z.output<typeof SelfPayPublishResultSchema>
export const SelfPayPublishResultJson = jsonCodec(SelfPayPublishResultSchema)

export const parseSelfPayPublishResults = (
  rows: ReadonlyArray<{ readonly lastPublishJson: string }>
): ReadonlyArray<SelfPayPublishResult> =>
  rows.flatMap(({ lastPublishJson }) => {
    const parsed = z.safeDecode(SelfPayPublishResultJson, lastPublishJson)
    return parsed.success ? [parsed.data] : []
  })

export const findNewestViewPublish = (
  results: ReadonlyArray<SelfPayPublishResult>
): SelfPayPublishResult | null => {
  const newest = results.reduce<SelfPayPublishResult | null>(
    (found, result) =>
      found === null || result.version > found.version ? result : found,
    null
  )
  if (newest === null) return null

  const sameContent = results.filter(
    ({ contentHash }) => contentHash === newest.contentHash
  )
  const reachedBy = new Map<WssUrl, boolean>()
  for (const { relays } of sameContent) {
    for (const { url, accepted } of relays) {
      reachedBy.set(url, reachedBy.get(url) === true || accepted)
    }
  }
  return {
    ...newest,
    at: TimestampMs(Math.max(...sameContent.map(({ at }) => at))),
    relays: [...reachedBy].map(([url, accepted]) => ({ url, accepted })),
  }
}

export const findNewestPublishOfEachView = (
  rows: ReadonlyArray<{
    readonly tag: string
    readonly lastPublishJson: string
  }>
): ReadonlyArray<SelfPayPublishResult> =>
  [...Map.groupBy(rows, ({ tag }) => tag).values()].flatMap((viewRows) => {
    const newest = findNewestViewPublish(parseSelfPayPublishResults(viewRows))
    return newest === null ? [] : [newest]
  })

export const findRelaysThatRefusedLastPublish = (
  results: ReadonlyArray<SelfPayPublishResult>
): ReadonlySet<WssUrl> => {
  const latestByUrl = new Map<
    WssUrl,
    { readonly at: number; readonly accepted: boolean }
  >()
  for (const { at, relays } of results) {
    for (const { url, accepted } of relays) {
      const latest = latestByUrl.get(url)
      if (latest === undefined || at > latest.at) {
        latestByUrl.set(url, { at, accepted })
      }
    }
  }
  return new Set(
    [...latestByUrl].flatMap(([url, { accepted }]) => (accepted ? [] : [url]))
  )
}

interface SelfPayAccount {
  readonly isDeleted: SqliteBoolean | null
}

export const pickSelfPayAccounts = <
  Bank extends SelfPayAccount & { readonly id: string },
  Spark extends SelfPayAccount,
>({
  bankAccount,
  sparkAccount,
  activeBankPlugins,
}: {
  readonly bankAccount: Bank | undefined
  readonly sparkAccount: Spark | undefined
  readonly activeBankPlugins: ReadonlyArray<{ readonly accountId: string }>
}): { readonly bank: Bank | null; readonly spark: Spark | null } => ({
  bank:
    bankAccount !== undefined &&
    bankAccount.isDeleted !== sqliteTrue &&
    activeBankPlugins.some(({ accountId }) => accountId === bankAccount.id)
      ? bankAccount
      : null,
  spark:
    sparkAccount !== undefined && sparkAccount.isDeleted !== sqliteTrue
      ? sparkAccount
      : null,
})

export type GuestsCannotPayReason = "noPaymentMethod" | "noRelayAccepted"

export const deriveGuestsCannotPayReason = ({
  accounts,
  lastPublish,
}: {
  readonly accounts: {
    readonly bank: unknown
    readonly spark: unknown
  }
  readonly lastPublish: SelfPayPublishResult | null
}): GuestsCannotPayReason | null => {
  if (accounts.bank === null && accounts.spark === null) {
    return "noPaymentMethod"
  }
  if (
    lastPublish !== null &&
    !lastPublish.relays.some(({ accepted }) => accepted)
  ) {
    return "noRelayAccepted"
  }
  return null
}
