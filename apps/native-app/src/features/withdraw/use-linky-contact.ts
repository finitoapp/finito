import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type LinkyContactError,
  type LinkyContactInput,
  parseLinkyContactInput,
  type ResolvedLinkyContact,
  resolveLinkyContact,
} from "@payky/core/integrations/linky/linky-contact"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useAsyncValue } from "../../hooks/use-async-value.ts"
import { useDebouncedValue } from "../../hooks/use-debounced-value.ts"

/** Where the lookup of what is typed stands (Fazole's `ContactState`). */
export type LinkyContactState =
  /** Nothing typed, or nothing a lookup could take. */
  | { readonly kind: "idle" }
  | { readonly kind: "resolving" }
  | { readonly kind: "resolved"; readonly contact: ResolvedLinkyContact }
  | {
      readonly kind: "failed"
      readonly key: TranslationKey
      readonly address: string
    }

const failureKeys = {
  LinkyContactInvalid: "withdraw.destination.invalid",
  Nip05NotFound: "withdraw.contact.notFound",
  Nip05Unreachable: "withdraw.contact.unreachable",
} satisfies Record<LinkyContactError["type"], TranslationKey>

/** Typing pauses this long before a name is looked up. */
const LOOKUP_DEBOUNCE_MS = 400

const lookupKey = (input: LinkyContactInput | null): string | null =>
  input === null
    ? null
    : input.kind === "pubkey"
      ? `pubkey:${input.pubkey}`
      : `nip05:${input.address}`

/**
 * Looks the typed Linky contact up once typing pauses (withdraw/0015): a key
 * resolves at once, a name through Linky's NIP-05 document. `resolving`
 * until the answer for this very text is in, so a stale answer never
 * stands for a newer name.
 */
export function useLinkyContact(text: string): LinkyContactState {
  const appRun = useAppRun()
  const input = parseLinkyContactInput(text)
  const key = lookupKey(input)
  const settledKey = useDebouncedValue(key, LOOKUP_DEBOUNCE_MS)
  const lookup = useAsyncValue(settledKey, async () => {
    await using run = appRun()
    return await run(resolveLinkyContact(text))
  })
  if (input === null) return { kind: "idle" }
  if (settledKey !== key || lookup.loading) return { kind: "resolving" }
  if (lookup.data === null) {
    // The run itself failed (no account, no network stack): as unreachable.
    return lookup.failed
      ? {
          kind: "failed",
          key: "withdraw.contact.unreachable",
          address: text.trim(),
        }
      : { kind: "resolving" }
  }
  if (lookup.data.ok) return { kind: "resolved", contact: lookup.data.value }
  const { error } = lookup.data
  return {
    kind: "failed",
    key: failureKeys[error.type],
    address: error.type === "LinkyContactInvalid" ? text.trim() : error.address,
  }
}
