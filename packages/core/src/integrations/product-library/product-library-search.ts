import type { DeviceLanguage } from "../../evolu/device-client.ts"
import { foldDiacritics } from "../../utils/sql-text-search.ts"
import type {
  LibraryProduct,
  ProductLibrary,
} from "./product-library-client.ts"

/**
 * How well a product matches, best first. A product ranks by the best of its
 * matches; products of one rank keep the library's order.
 */
const matchRanks = {
  exactName: 0,
  namePrefix: 1,
  nameWordPrefix: 2,
  synonym: 3,
  substring: 4,
  typo: 5,
} as const

type MatchRank = (typeof matchRanks)[keyof typeof matchRanks]

/** The words of a folded text, split on anything but letters and digits. */
const wordsOf = (folded: string): ReadonlyArray<string> =>
  folded.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== "")

/**
 * The typos a query may carry and still match: none below four characters,
 * where one edit already turns most words into others; one from four, two
 * from seven.
 */
const allowedTypos = (queryLength: number): number => {
  if (queryLength >= 7) return 2
  if (queryLength >= 4) return 1
  return 0
}

/**
 * The Damerau–Levenshtein distance of `a` and `b` (in its optimal string
 * alignment form: insertions, deletions, substitutions and swaps of two
 * neighbours), or `max + 1` as soon as it is known to exceed `max`.
 */
const editDistance = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
  max: number
): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1

  let beforePrevious: ReadonlyArray<number> = []
  let previous: ReadonlyArray<number> = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  )
  for (let i = 1; i <= a.length; i++) {
    const current: number[] = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let distance = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distance = Math.min(distance, (beforePrevious[j - 2] ?? 0) + 1)
      }
      current.push(distance)
      rowMin = Math.min(rowMin, distance)
    }
    if (rowMin > max) return max + 1
    beforePrevious = previous
    previous = current
  }
  return previous[b.length] ?? max + 1
}

/**
 * Whether `query` is within `max` edits of `target`, or of the start of
 * `target` as long as the query: a name is suggested while it is still being
 * typed, so "esspres" finds Espresso before the last letter is there.
 */
const isTypoOf = (
  query: ReadonlyArray<string>,
  target: string,
  max: number
): boolean => {
  const letters = Array.from(target)
  return (
    editDistance(query, letters, max) <= max ||
    (letters.length > query.length &&
      editDistance(query, letters.slice(0, query.length), max) <= max)
  )
}

const rankProduct = (
  product: LibraryProduct,
  language: DeviceLanguage,
  query: string
): MatchRank | undefined => {
  const name = foldDiacritics(product.names[language])
  if (name === query) return matchRanks.exactName
  if (name.startsWith(query)) return matchRanks.namePrefix

  const nameWords = wordsOf(name)
  if (nameWords.some((word) => word.startsWith(query))) {
    return matchRanks.nameWordPrefix
  }

  const synonyms = (product.synonyms[language] ?? []).map(foldDiacritics)
  if (synonyms.some((synonym) => synonym.startsWith(query))) {
    return matchRanks.synonym
  }

  const texts = [name, ...synonyms]
  if (texts.some((text) => text.includes(query))) return matchRanks.substring

  const max = allowedTypos(query.length)
  if (max === 0) return undefined
  const queryLetters = Array.from(query)
  const targets = [
    ...texts,
    ...nameWords,
    ...synonyms.flatMap((synonym) => wordsOf(synonym)),
  ]
  return targets.some((target) => isTypoOf(queryLetters, target, max))
    ? matchRanks.typo
    : undefined
}

/**
 * The library products matching what the merchant is typing as an item's
 * name, best first: case and diacritics never matter, and
 * neither does a typo or two in a longer word. A retired product never
 * matches, and a blank query matches nothing.
 */
export const searchLibraryProducts = (
  library: ProductLibrary,
  {
    query,
    language,
    limit,
  }: {
    readonly query: string
    readonly language: DeviceLanguage
    readonly limit: number
  }
): ReadonlyArray<LibraryProduct> => {
  const folded = foldDiacritics(query.trim()).replace(/\s+/g, " ")
  if (folded === "") return []

  return library.products
    .flatMap((product, index) => {
      if (product.retired) return []
      const rank = rankProduct(product, language, folded)
      return rank === undefined ? [] : [{ product, rank, index }]
    })
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ product }) => product)
}
