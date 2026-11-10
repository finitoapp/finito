import { type SqliteBoolean, sqliteTrue } from "@evolu/common"

import { WssUrl, WssUrlSchema } from "../shared/schema.ts"

export interface SelfPayRelaySetting {
  readonly url: WssUrl
  readonly isActive: boolean
  readonly isDefault: boolean
}

export const listSelfPayRelays = (
  defaults: ReadonlyArray<WssUrl>,
  rows: ReadonlyArray<{
    readonly url: WssUrl
    readonly isActive: SqliteBoolean
  }>
): ReadonlyArray<SelfPayRelaySetting> => {
  const isActiveByUrl = new Map(
    rows.map((row) => [row.url, row.isActive === sqliteTrue])
  )
  return [
    ...defaults.map((url) => ({
      url,
      isActive: isActiveByUrl.get(url) ?? true,
      isDefault: true,
    })),
    ...rows
      .filter((row) => !defaults.includes(row.url))
      .map((row) => ({
        url: row.url,
        isActive: row.isActive === sqliteTrue,
        isDefault: false,
      })),
  ]
}

export const activeSelfPayRelays = (
  relays: ReadonlyArray<SelfPayRelaySetting>
): ReadonlyArray<WssUrl> => {
  const active = relays.filter((relay) => relay.isActive)
  const publishing =
    active.length > 0 ? active : relays.filter((relay) => relay.isDefault)
  return publishing.map((relay) => relay.url)
}

export const hasSameRelays = (
  left: ReadonlyArray<WssUrl>,
  right: ReadonlyArray<WssUrl>
): boolean =>
  left.length === right.length && left.every((url) => right.includes(url))

export const selfPayAddressRelays = (
  active: ReadonlyArray<WssUrl>,
  defaults: ReadonlyArray<WssUrl>
): ReadonlyArray<WssUrl> => (hasSameRelays(active, defaults) ? [] : active)

export const selfPayRelaysToRead = (
  addressRelays: ReadonlyArray<WssUrl>,
  defaults: ReadonlyArray<WssUrl>
): ReadonlyArray<WssUrl> =>
  addressRelays.length > 0 ? addressRelays : defaults

export const parseSelfPayRelay = (input: string): WssUrl | null => {
  const url = WssUrlSchema.safeParse(input.trim())
  if (!url.success) return null
  const { host, pathname, search } = new URL(url.data)
  return WssUrl(`wss://${host}${pathname === "/" ? "" : pathname}${search}`)
}
