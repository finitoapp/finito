import { base64urlnopad } from "@scure/base"

import { type WssUrl, WssUrlSchema } from "../shared/schema.ts"

const ADDRESS_PATH = "/t"
const ADDRESS_VERSION = "1"
const KEY_LENGTH = 32
const RELAY_SCHEME = "wss://"

export interface TableSelfPayAddressKeys {
  readonly publicKey: Uint8Array
  readonly viewKey: Uint8Array
}

export interface TableSelfPayAddress extends TableSelfPayAddressKeys {
  readonly relays: ReadonlyArray<WssUrl>
}

const encodeRelays = (relays: ReadonlyArray<string>): string =>
  relays
    .map((url) =>
      encodeURIComponent(
        url.startsWith(RELAY_SCHEME) ? url.slice(RELAY_SCHEME.length) : url
      )
    )
    .join(",")

const decodeRelays = (text: string): ReadonlyArray<WssUrl> | null => {
  const relays: WssUrl[] = []
  for (const encoded of text.split(",")) {
    const decoded = tryDecodeUriComponent(encoded)
    if (decoded === null) return null
    const url = WssUrlSchema.safeParse(`${RELAY_SCHEME}${decoded}`)
    if (!url.success) return null
    relays.push(url.data)
  }
  return relays
}

const tryDecodeUriComponent = (text: string): string | null => {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

export const createTableSelfPayAddress = (
  origin: string,
  { publicKey, viewKey, relays }: TableSelfPayAddress
): string => {
  const payload = new Uint8Array([...publicKey, ...viewKey])
  const keys = `${ADDRESS_VERSION}.${base64urlnopad.encode(payload)}`
  const fragment =
    relays.length === 0 ? keys : `${keys}.${encodeRelays(relays)}`
  return `${new URL(ADDRESS_PATH, origin).href}#${fragment}`
}

const decodeBase64Url = (text: string): Uint8Array | null => {
  try {
    return base64urlnopad.decode(text)
  } catch {
    return null
  }
}

export const parseTableSelfPayAddress = (
  address: string
): TableSelfPayAddress | null => {
  if (!URL.canParse(address)) return null

  const { pathname, hash } = new URL(address)
  const [version, encodedKeys, ...relayParts] = hash.slice(1).split(".")
  if (
    pathname !== ADDRESS_PATH ||
    version !== ADDRESS_VERSION ||
    encodedKeys === undefined
  ) {
    return null
  }

  const payload = decodeBase64Url(encodedKeys)
  if (payload?.length !== KEY_LENGTH * 2) return null

  const keys = {
    publicKey: payload.slice(0, KEY_LENGTH),
    viewKey: payload.slice(KEY_LENGTH),
  }
  if (relayParts.length === 0) return { ...keys, relays: [] }

  const relays = decodeRelays(relayParts.join("."))
  return relays === null ? null : { ...keys, relays }
}
