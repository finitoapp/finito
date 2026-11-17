import {
  type Brand,
  createId,
  createRandomBytes,
  type Id,
  type MutationOptions,
  type TypeName,
} from "@evolu/common"
import type { ConditionalExcept } from "type-fest"
import {
  NonNegativeInteger,
  type NonNegativeInteger as NonNegativeIntegerType,
} from "./schema.ts"

interface MutationCompletion {
  readonly options: MutationOptions
  readonly promise: Promise<void>
}

const createMutationCompletion = (): MutationCompletion => {
  const completed = Promise.withResolvers<void>()

  return {
    options: {
      onComplete: completed.resolve,
    },
    promise: completed.promise,
  }
}

/**
 * Runs `mutate` as one Evolu mutation batch and resolves once that batch has
 * actually been applied, so follow-up work can read the written rows back.
 *
 * `mutate` must perform at least one mutation: the `onComplete` it is handed
 * is only ever invoked by Evolu applying a mutation, so a callback that ends
 * up writing nothing leaves the returned promise pending forever. Callers
 * whose batch can legitimately be empty must skip it themselves — see
 * `appendBillLines` and `splitBill`.
 */
export const runMutationWithCompletion = async <TResult>(
  mutate: (options: MutationOptions) => TResult
): Promise<TResult> => {
  const completed = createMutationCompletion()
  const result = mutate(completed.options)

  await completed.promise

  return result
}

export const removeUndefinedValues = <const TData extends object>(
  data: { [key in keyof TData]: TData[key] | undefined }
): ConditionalExcept<TData, undefined> => {
  const values = { ...data } as Record<string, unknown>
  for (const key of Object.keys(values)) {
    if (values[key] === undefined) {
      delete values[key]
    }
  }
  return values as ConditionalExcept<TData, undefined>
}

/**
 * Derives the `sortOrder` for a row appended after the current last one, for
 * modules with no reorder UI yet (catalog items, catalog categories, tables,
 * tax rates).
 *
 * Takes the highest existing row, or `undefined` for an empty table — callers
 * ask for exactly that row (`last*SortOrderQuery`) rather than reading every
 * row to keep the last. `createTaxRate` is the exception: it needs the full
 * list anyway to unset the previous default, so it passes `existing.at(-1)`.
 */
export const getNextSortOrder = (
  last: { readonly sortOrder: NonNegativeIntegerType } | undefined
): NonNegativeIntegerType => NonNegativeInteger((last?.sortOrder ?? -1) + 1)

const randomBytes = createRandomBytes()

/**
 * Mints a branded Evolu row id for any table — pass the row's type name,
 * as in `createRowId<"Payment">()`.
 *
 * Named for the row, not the table, because this app has a `table` domain
 * module (restaurant tables) with its own `TableId`. A `createRowId` here
 * would read as "make a TableId", which is the one thing every caller of
 * this does *not* do.
 */
export const createRowId = <Entity extends TypeName>(): Id & Brand<Entity> =>
  createId<never>({ randomBytes }) as Id & Brand<Entity>

/**
 * A query factory that builds each limit's query once. Kysely compiles a
 * query on every call, and an Activity list's page query is large: the
 * payment history's took ~50 ms of Hermes on a PAX A920Pro, paid on every
 * mount of the list. The query is a string, so the cached one is the same
 * query Evolu already holds; the limits a list asks for grow by its page
 * size, so the cache stays small.
 */
export const cacheQueryByLimit = <TQuery>(
  create: (limit: number) => TQuery
): ((limit: number) => TQuery) => {
  const cache = new Map<number, TQuery>()
  return (limit) => {
    const cached = cache.get(limit)
    if (cached !== undefined) return cached
    const query = create(limit)
    cache.set(limit, query)
    return query
  }
}
