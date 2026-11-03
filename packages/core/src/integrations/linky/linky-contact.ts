import { err, ok, type Task } from "@evolu/common"
import type { FetchDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  type Nip05Address,
  type Nip05Error,
  resolveNip05,
} from "../nostr/nip05.ts"
import { hexToNpub, parseNostrPubkey } from "../nostr/npub.ts"

/**
 * A Linky user as the merchant names one when sending ecash (withdraw/0015,
 * Fazole's `contact.ts`): a key outright, or a NIP-05 name looked up on its
 * domain; `hynek` alone is `hynek@linky.fit`. Other `name@domain` texts are
 * Lightning addresses and never reach this lookup. Reading keys and NIP-05
 * itself are Nostr's (`../nostr/npub.ts`, `../nostr/nip05.ts`); what is
 * Linky's here is which texts count as a contact.
 */

/** Where a name without a domain lives, and the only domain a contact can name. */
export const LINKY_CONTACT_DOMAIN = "linky.fit"

const NAME = /^[a-z0-9._-]+$/iu
const LINKY_PROFILE_LINK =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*linky\.fit\/p\/([^/?#\s]+)/iu

export type LinkyContactInput =
  | { readonly kind: "pubkey"; readonly pubkey: string; readonly npub: string }
  | ({
      readonly kind: "nip05"
      /** `name@domain`, lower-cased. */
      readonly address: string
    } & Nip05Address)

/** A Nostr key (`parseNostrPubkey`) or a Linky profile link; `null` otherwise. */
const parseLinkyPubkey = (text: string): string | null => {
  const linked = LINKY_PROFILE_LINK.exec(text)?.[1]
  if (linked === undefined) return parseNostrPubkey(text)
  try {
    return parseNostrPubkey(decodeURIComponent(linked))
  } catch {
    return null
  }
}

/**
 * Reads what the merchant typed as a Linky contact: a key names one outright;
 * `jmeno` names a NIP-05 address on linky.fit, and only there, because
 * `jmeno@domena.cz` is a Lightning address to the withdrawal form. `null` for
 * anything else.
 */
export const parseLinkyContactInput = (
  text: string
): LinkyContactInput | null => {
  const trimmed = text.trim()
  if (trimmed === "") return null
  const pubkey = parseLinkyPubkey(trimmed)
  if (pubkey !== null)
    return { kind: "pubkey", pubkey, npub: hexToNpub(pubkey) }
  if (LINKY_PROFILE_LINK.test(trimmed)) return null
  const at = trimmed.indexOf("@")
  const name = (at < 0 ? trimmed : trimmed.slice(0, at)).toLowerCase()
  const domain = (
    at < 0 ? LINKY_CONTACT_DOMAIN : trimmed.slice(at + 1)
  ).toLowerCase()
  // A half-typed key or a Lightning invoice is not a name to look up.
  if (
    domain !== LINKY_CONTACT_DOMAIN ||
    !NAME.test(name) ||
    /^(npub1|nprofile1|lnbc|lntb|lnbcrt|lnurl)/u.test(name)
  )
    return null
  return { kind: "nip05", name, domain, address: `${name}@${domain}` }
}

export interface ResolvedLinkyContact {
  readonly pubkey: string
  readonly npub: string
  /** The NIP-05 address it was looked up by; `null` for a key given outright. */
  readonly address: string | null
}

const createLinkyContactInvalidError = defineError("LinkyContactInvalid")()
export type LinkyContactInvalidError = ReturnType<
  typeof createLinkyContactInvalidError
>

export type LinkyContactError = LinkyContactInvalidError | Nip05Error

/**
 * Finds the key a typed contact names: a key outright, or a name by Linky's
 * NIP-05 document.
 */
export const resolveLinkyContact =
  (text: string): Task<ResolvedLinkyContact, LinkyContactError, FetchDep> =>
  async (run) => {
    const input = parseLinkyContactInput(text)
    if (input === null) return err(createLinkyContactInvalidError())
    if (input.kind === "pubkey")
      return ok({ pubkey: input.pubkey, npub: input.npub, address: null })
    const resolved = await run(resolveNip05(input))
    if (!resolved.ok) return resolved
    return ok({
      pubkey: resolved.value,
      npub: hexToNpub(resolved.value),
      address: input.address,
    })
  }
