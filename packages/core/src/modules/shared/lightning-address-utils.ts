import { decodeBech32Bytes } from "./lightning-invoice-utils.ts"

/** A LUD-16 Lightning address, lowercased: `name@domain.tld`. */
export const LIGHTNING_ADDRESS = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/

/**
 * The Lightning address a merchant typed, trimmed and lowercased, or `null`
 * when it is not one. A `lightning:` scheme is dropped.
 */
export const parseLightningAddress = (raw: string): string | null => {
  const lower = raw.trim().toLowerCase()
  const address = lower.startsWith("lightning:")
    ? lower.slice("lightning:".length)
    : lower
  return LIGHTNING_ADDRESS.test(address) ? address : null
}

const LUD16_PATH = /^\/\.well-known\/lnurlp\/([^/]+)$/

/**
 * The Lightning address an `lnurl1…` stands for, when it encodes exactly the
 * LUD-16 URL `https://<domain>/.well-known/lnurlp/<name>` — as wallets such as
 * Primal show their Lightning addresses. Any other LNURL gives `null`
 * (withdraw/0005).
 */
export const lnurlToLightningAddress = (lnurl: string): string | null => {
  const bytes = decodeBech32Bytes(lnurl)
  if (bytes === null) return null
  let url: URL
  try {
    url = new URL(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
  const name = LUD16_PATH.exec(url.pathname)?.[1]
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.search !== "" ||
    url.username !== "" ||
    name === undefined
  ) {
    return null
  }
  let decodedName: string
  try {
    decodedName = decodeURIComponent(name)
  } catch {
    return null // a malformed `%` escape
  }
  const address = `${decodedName}@${url.hostname}`.toLowerCase()
  return LIGHTNING_ADDRESS.test(address) ? address : null
}
