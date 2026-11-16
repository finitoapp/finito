import type { KyselyNotNull } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import { buildDiacriticInsensitiveSearchCondition } from "../../utils/sql-text-search.ts"
import type { TableId } from "./table-types.ts"

export const tablesQuery = createQuery((db) =>
  db
    .selectFrom("table")
    .selectAll()
    .where("name", "is not", null)
    .where("code", "is not", null)
    .where("sortOrder", "is not", null)
    .where("isDeleted", "is", null)
    .$narrowType<{
      name: KyselyNotNull
      code: KyselyNotNull
      sortOrder: KyselyNotNull
    }>()
    .orderBy("sortOrder", "asc")
)

/**
 * The highest `sortOrder` in use, for appending a table after the last one —
 * see `getNextSortOrder`. Same predicates as `tablesQuery` so it names the
 * same row that query's last entry did, but one row instead of every table
 * with every column. Unindexed: a venue has dozens of tables, and an index on
 * them would cost every write to earn a scan nobody notices.
 */
export const lastTableSortOrderQuery = createQuery((db) =>
  db
    .selectFrom("table")
    .select("sortOrder")
    .where("name", "is not", null)
    .where("code", "is not", null)
    .where("sortOrder", "is not", null)
    .where("isDeleted", "is", null)
    .$narrowType<{
      sortOrder: KyselyNotNull
    }>()
    .orderBy("sortOrder", "desc")
    .limit(1)
)

/**
 * Whether at least one (non-deleted) table exists, independent of any
 * search filter — cheaper than loading full rows just to check.
 */
export const tablesExistQuery = createQuery((db) =>
  db
    .selectFrom("table")
    .select("id")
    .where("name", "is not", null)
    .where("code", "is not", null)
    .where("sortOrder", "is not", null)
    .where("isDeleted", "is", null)
    .limit(1)
)

/**
 * A page of tables, filtered in SQL (not over an already-loaded result set)
 * by free text — case- and diacritic-insensitive across `name`. Pass
 * `limit: pageSize + 1` and slice off the extra row to detect whether more
 * items remain without a separate count query.
 */
export const tablesPageQuery = ({
  search,
  limit,
}: {
  readonly search: string
  readonly limit: number
}) =>
  createQuery((db) => {
    let query = db
      .selectFrom("table")
      .selectAll()
      .where("name", "is not", null)
      .where("code", "is not", null)
      .where("sortOrder", "is not", null)
      .where("isDeleted", "is", null)
      .$narrowType<{
        name: KyselyNotNull
        code: KyselyNotNull
        sortOrder: KyselyNotNull
      }>()

    const term = search.trim()
    if (term !== "") {
      query = query.where((eb) =>
        buildDiacriticInsensitiveSearchCondition(eb, ["name"], term)
      )
    }

    return query.orderBy("sortOrder", "asc").limit(limit)
  })

export const tableByIdQuery = (idValue: TableId) =>
  createQuery((db) =>
    db
      .selectFrom("table")
      .selectAll()
      .where("id", "=", idValue)
      .where("name", "is not", null)
      .where("code", "is not", null)
      .where("sortOrder", "is not", null)
      .$narrowType<{
        name: KyselyNotNull
        code: KyselyNotNull
        sortOrder: KyselyNotNull
      }>()
  )
