import { err, ok, type Task } from "@evolu/common"
import { z } from "zod"
import { type FetchDep, fetchAndValidateJson } from "../../deps.ts"
import { defineError } from "../../error.ts"
import { isHexPubkey } from "./npub.ts"

/** A NIP-05 identifier, `name@domain`, split at its `@` and lower-cased. */
export interface Nip05Address {
  readonly name: string
  readonly domain: string
}

/** The URL a NIP-05 lookup fetches. */
export const nip05Url = ({ name, domain }: Nip05Address): string =>
  `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`

/** NIP-05: the names a domain vouches for, whatever else the document holds. */
const Nip05DocumentSchema = z.object({
  names: z.record(z.string(), z.unknown()),
})

/** The domain knows no such name. */
const createNip05NotFoundError = defineError("Nip05NotFound")<{
  readonly address: string
}>()
export type Nip05NotFoundError = ReturnType<typeof createNip05NotFoundError>

/** The domain did not answer, or answered with something that is not a NIP-05 document. */
const createNip05UnreachableError = defineError("Nip05Unreachable")<{
  readonly address: string
}>()
export type Nip05UnreachableError = ReturnType<
  typeof createNip05UnreachableError
>

export type Nip05Error = Nip05NotFoundError | Nip05UnreachableError

/**
 * The hex pubkey a domain's `nostr.json` lists for a name (NIP-05). A
 * missing name answers 404 or a document without it, or with something
 * other than a key; anything else is the domain not answering.
 */
export const resolveNip05 =
  (input: Nip05Address): Task<string, Nip05Error, FetchDep> =>
  async (run) => {
    const address = `${input.name}@${input.domain}`
    const fetched = await run(
      fetchAndValidateJson({
        url: nip05Url(input),
        init: { headers: { Accept: "application/json" } },
        schema: Nip05DocumentSchema,
        onHttpError: ({ status }) =>
          status === 404
            ? createNip05NotFoundError({ address })
            : createNip05UnreachableError({ address }),
        onResponseError: () => createNip05UnreachableError({ address }),
      })
    )
    if (!fetched.ok)
      return fetched.error.type === "FetchError"
        ? err(createNip05UnreachableError({ address }))
        : err(fetched.error)
    const value = fetched.value.names[input.name]
    return typeof value === "string" && isHexPubkey(value)
      ? ok(value.toLowerCase())
      : err(createNip05NotFoundError({ address }))
  }
