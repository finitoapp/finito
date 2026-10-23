import { err, ok, type Result } from "@evolu/common"
import { z } from "zod"

import { defineError } from "../../error.ts"
import { HexSchema, WssUrlSchema } from "./schema.ts"

/**
 * `payky:<type>?v=<version>[&<param>=<value>]...` — every QR code Payky shows
 * for Payky to read. Opaque like `bitcoin:`, so the same string can later be
 * an OS deep link. Each type versions on its own; params are form-encoded,
 * binary values lowercase hex, unknown params ignored.
 */

/** `pair` v1: the source's ephemeral pubkey, session secret and relays. */
const PairUriV1Schema = z.object({
  pk: HexSchema(32),
  s: HexSchema(16),
  r: z.array(WssUrlSchema).min(1).max(2),
})

/** Every registered type with the schema of each version it reads. */
const paykyUriTypes = {
  pair: { 1: PairUriV1Schema },
} as const

export type PaykyUriType = keyof typeof paykyUriTypes

export type PairUri = z.output<typeof PairUriV1Schema>

export type PaykyUri = { readonly type: "pair"; readonly v: 1 } & PairUri

/** Params that may repeat; every other one is read once. */
const repeatedParams: ReadonlySet<string> = new Set(["r"])

const createNotPaykyUriError = defineError("NotPaykyUri")()
const createUnknownPaykyUriTypeError = defineError("UnknownPaykyUriType")<{
  readonly paykyType: string
}>()
const createUnsupportedPaykyUriVersionError = defineError(
  "UnsupportedPaykyUriVersion"
)<{ readonly paykyType: PaykyUriType }>()
const createInvalidPaykyUriError = defineError("InvalidPaykyUri")()
const createWrongPaykyUriTypeError = defineError("WrongPaykyUriType")<{
  readonly paykyType: PaykyUriType
}>()

export type PaykyUriError =
  | ReturnType<typeof createNotPaykyUriError>
  | ReturnType<typeof createUnknownPaykyUriTypeError>
  | ReturnType<typeof createUnsupportedPaykyUriVersionError>
  | ReturnType<typeof createInvalidPaykyUriError>
export type WrongPaykyUriTypeError = ReturnType<
  typeof createWrongPaykyUriTypeError
>

const uriPattern = /^payky:([^?#]*)(?:\?([^#]*))?$/iu
const typePattern = /^[a-z][a-z0-9-]*$/u
const versionPattern = /^[1-9]\d*$/u

const isRegisteredType = (type: string): type is PaykyUriType =>
  Object.hasOwn(paykyUriTypes, type)

export const parsePaykyUri = (
  text: string
): Result<PaykyUri, PaykyUriError> => {
  const match = uriPattern.exec(text.trim())
  if (match === null) return err(createNotPaykyUriError())

  const type = match[1] ?? ""
  if (!typePattern.test(type)) return err(createInvalidPaykyUriError())
  if (!isRegisteredType(type)) {
    return err(createUnknownPaykyUriTypeError({ paykyType: type }))
  }

  const params = new URLSearchParams(match[2] ?? "")
  const version = params.get("v") ?? ""
  if (!versionPattern.test(version)) return err(createInvalidPaykyUriError())
  // `v` is a positive integer, so a version missing here is a newer one.
  const schema = (
    paykyUriTypes[type] as Readonly<
      Record<string, typeof PairUriV1Schema | undefined>
    >
  )[version]
  if (schema === undefined) {
    return err(createUnsupportedPaykyUriVersionError({ paykyType: type }))
  }

  const parsed = schema.safeParse(
    Object.fromEntries(
      [...new Set(params.keys())].map((key) => [
        key,
        repeatedParams.has(key) ? params.getAll(key) : params.get(key),
      ])
    )
  )
  return parsed.success
    ? ok({ type, v: 1, ...parsed.data })
    : err(createInvalidPaykyUriError())
}

/** A `payky:pair` code, or why the text is not one. */
export const parsePairUri = (
  text: string
): Result<PairUri, PaykyUriError | WrongPaykyUriTypeError> => {
  const parsed = parsePaykyUri(text)
  if (!parsed.ok) return parsed
  const { type, v: _v, ...pair } = parsed.value
  return type === "pair"
    ? ok(pair)
    : err(createWrongPaykyUriTypeError({ paykyType: type }))
}

export const encodePairUri = (pair: {
  readonly pk: string
  readonly s: string
  readonly r: ReadonlyArray<string>
}): string => {
  const params = new URLSearchParams({ v: "1", pk: pair.pk, s: pair.s })
  for (const relay of pair.r) params.append("r", relay)
  return `payky:pair?${params.toString()}`
}
