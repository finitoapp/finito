import { kyselySql } from "@evolu/common"
import type {
  Expression,
  ExpressionBuilder,
  RawBuilder,
  StringReference,
} from "kysely"

/**
 * Every diacritic-bearing Latin letter (both cases) this app searches
 * across — Czech/Slovak, Vietnamese and common Western European accents. The single
 * source of truth for `foldDiacritics` (JS side) and `foldDiacriticsSql`
 * (SQL side), so a search term and a stored column always fold to the same
 * value.
 *
 * Kept as an explicit list rather than derived at the call site from
 * `String.prototype.normalize`: SQLite has no `unaccent`, so the SQL side can
 * only fold letters it enumerates one `replace()` at a time. Letting the JS
 * side strip every Unicode diacritic instead would make it fold strictly more
 * than the column does, and a term containing an unlisted accent (`ő`, `ā`,
 * `ę`, ...) would then stop matching the row it came from. Add a letter here
 * and both sides learn it together.
 */
const ACCENTED_LETTERS = [
  "áÁàÀâÂäÄãÃåÅčČçÇďĎéÉèÈêÊëËěĚíÍìÌîÎïÏňŇñÑóÓòÒôÔöÖõÕřŘšŠťŤúÚùÙûÛüÜůŮýÝÿžŽ",
  // Vietnamese
  "ĂăĨĩŨũƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ",
].join("")

const DIACRITICS_FOLD_MAP: ReadonlyArray<readonly [string, string]> = [
  ...ACCENTED_LETTERS,
]
  .map(
    (letter) =>
      [letter, letter.normalize("NFD").charAt(0).toLowerCase()] as const
  )
  .concat(
    // The one letter with a stroke, which NFD does not take apart.
    [
      ["đ", "d"],
      ["Đ", "d"],
    ]
  )

/**
 * Lowercases and strips diacritics from user-facing text the same way
 * `foldDiacriticsSql` folds a SQL column, so a JS-normalized search term
 * matches consistently against it (for example "pivo" matches "Pivo" and
 * "PÍVO").
 */
export function foldDiacritics(text: string): string {
  let result = text.toLowerCase()
  for (const [accented, base] of DIACRITICS_FOLD_MAP) {
    result = result.split(accented).join(base)
  }
  return result
}

/**
 * Wraps a SQL expression in `lower()` plus one `replace()` per mapped
 * diacritic, so it can be compared with a `foldDiacritics`-normalized search
 * term using plain `LIKE`. The reusable entry point is
 * {@link buildDiacriticInsensitiveSearchCondition}, which is what callers
 * outside this file want.
 */
function foldDiacriticsSql(expr: Expression<unknown>): RawBuilder<string> {
  let folded = kyselySql<string>`lower(${expr})`
  for (const [accented, base] of DIACRITICS_FOLD_MAP) {
    folded = kyselySql<string>`replace(${folded}, ${accented}, ${base})`
  }
  return folded
}

const LIKE_ESCAPE_CHAR = "\\"

/**
 * Escapes `%`, `_`, and the escape character itself so raw user input can be
 * safely embedded as a `LIKE` substring pattern (pair with
 * `ESCAPE '${LIKE_ESCAPE_CHAR}'`).
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (char) => `${LIKE_ESCAPE_CHAR}${char}`)
}

/**
 * Builds an `OR`-ed `LIKE` condition across `columns` that matches `term`
 * ignoring case and diacritics (so "pivo" matches "Pivo" and "PÍVO"). `term`
 * should be the raw, un-normalized user input. Generic over any Kysely
 * schema/table — reusable for free-text search on any Evolu query, not just
 * catalog items.
 */
export function buildDiacriticInsensitiveSearchCondition<
  DB,
  TB extends keyof DB,
>(
  eb: ExpressionBuilder<DB, TB>,
  columns: ReadonlyArray<StringReference<DB, TB>>,
  term: string
) {
  const pattern = `%${escapeLikePattern(foldDiacritics(term))}%`
  return eb.or(
    columns.map(
      (column) =>
        kyselySql<boolean>`${foldDiacriticsSql(eb.ref(column))} like ${pattern} escape ${LIKE_ESCAPE_CHAR}`
    )
  )
}
