import type { DeviceLanguage } from "../../evolu/device-client.ts"
import { foldDiacritics } from "../../utils/sql-text-search.ts"
import {
  type LibraryLanguage,
  type LibraryProduct,
  libraryLanguage,
  type ProductLibrary,
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

/**
 * A product's texts in one language, folded once per loaded library rather
 * than on every keystroke.
 */
interface IndexedProduct {
  readonly product: LibraryProduct
  /** Its position in the library, which breaks ties between equal ranks. */
  readonly index: number
  readonly name: string
  readonly nameWords: ReadonlyArray<string>
  readonly synonyms: ReadonlyArray<string>
  /** The name and the synonyms, for a substring. */
  readonly texts: ReadonlyArray<string>
  /** The texts and each of their words, for a typo. */
  readonly typoTargets: ReadonlyArray<string>
}

type LanguageIndex = ReadonlyArray<IndexedProduct>

/**
 * Per loaded library, its suggestable products folded per language. Weak, so
 * a library replaced by a newer download takes its index with it.
 */
const libraryIndexes = new WeakMap<
  ProductLibrary,
  Map<LibraryLanguage, LanguageIndex>
>()

const indexProduct = (
  product: LibraryProduct,
  index: number,
  language: LibraryLanguage
): IndexedProduct => {
  const name = foldDiacritics(product.names[language])
  const nameWords = wordsOf(name)
  const synonyms = (product.synonyms[language] ?? []).map(foldDiacritics)
  const texts = [name, ...synonyms]
  return {
    product,
    index,
    name,
    nameWords,
    synonyms,
    texts,
    typoTargets: [
      ...texts,
      ...nameWords,
      ...synonyms.flatMap((synonym) => wordsOf(synonym)),
    ],
  }
}

/** The library's suggestable products in `language`, folded once. */
const languageIndex = (
  library: ProductLibrary,
  language: LibraryLanguage
): LanguageIndex => {
  const languages =
    libraryIndexes.get(library) ?? new Map<LibraryLanguage, LanguageIndex>()
  libraryIndexes.set(library, languages)

  const known = languages.get(language)
  if (known !== undefined) return known
  const built = library.products.flatMap((product, index) =>
    product.retired ? [] : [indexProduct(product, index, language)]
  )
  languages.set(language, built)
  return built
}

const rankProduct = (
  { name, nameWords, synonyms, texts, typoTargets }: IndexedProduct,
  query: string
): MatchRank | undefined => {
  if (name === query) return matchRanks.exactName
  if (name.startsWith(query)) return matchRanks.namePrefix
  if (nameWords.some((word) => word.startsWith(query))) {
    return matchRanks.nameWordPrefix
  }
  if (synonyms.some((synonym) => synonym.startsWith(query))) {
    return matchRanks.synonym
  }
  if (texts.some((text) => text.includes(query))) return matchRanks.substring

  const max = allowedTypos(query.length)
  if (max === 0) return undefined
  const queryLetters = Array.from(query)
  return typoTargets.some((target) => isTypoOf(queryLetters, target, max))
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

  return languageIndex(library, libraryLanguage(language))
    .flatMap((indexed) => {
      const rank = rankProduct(indexed, folded)
      return rank === undefined
        ? []
        : [{ product: indexed.product, rank, index: indexed.index }]
    })
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ product }) => product)
}
