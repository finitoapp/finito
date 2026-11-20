import {
  type Id,
  IdBytes,
  idBytesToId,
  idToIdBytes,
  kyselySql,
  type OwnerId,
  ownerIdToOwnerIdBytes,
} from "@evolu/common"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

import { type AppSchema, createQuery } from "../../evolu/schema.ts"

export const writeClocksQuery = ({
  ownerId,
  table,
  column,
  ids,
  pick,
}: {
  readonly ownerId: OwnerId
  readonly table: keyof typeof AppSchema
  readonly column?: string
  readonly ids: ReadonlyArray<Id>
  readonly pick: "first" | "last"
}) =>
  createQuery((db) =>
    db
      .selectFrom(
        kyselySql<{
          idHex: string
          clockHex: string
        }>`(select hex("id") as "idHex", hex(${pick === "first" ? kyselySql`min` : kyselySql`max`}("timestamp")) as "clockHex" from "evolu_history" where "ownerId" = ${ownerIdToOwnerIdBytes(ownerId)} and "table" = ${table} and ${column === undefined ? kyselySql`1` : kyselySql`"column" = ${column}`} and "id" in (${kyselySql.join(ids.map(idToIdBytes))}) group by "id")`.as(
          "write"
        )
      )
      .select(["write.idHex", "write.clockHex"])
  )

/** The newest change this database holds, whatever it changed. */
export const evoluHistoryMaxRowidQuery = createQuery((db) =>
  db
    .selectFrom(
      kyselySql<{
        maxRowid: number | null
      }>`(select max("rowid") as "maxRowid" from "evolu_history")`.as("history")
    )
    .select("history.maxRowid")
)

export const changedHistoryRowsQuery = ({
  ownerId,
  afterRowid,
  throughRowid,
  tables,
}: {
  readonly ownerId: OwnerId
  readonly afterRowid: number
  readonly throughRowid: number
  readonly tables: ReadonlyArray<keyof typeof AppSchema>
}) =>
  createQuery((db) =>
    db
      .selectFrom(
        kyselySql<{
          table: string
          column: string
          idHex: string
        }>`(select distinct "table", "column", hex("id") as "idHex" from "evolu_history" where "rowid" > ${afterRowid} and "rowid" <= ${throughRowid} and "ownerId" = ${ownerIdToOwnerIdBytes(ownerId)} and "table" in (${kyselySql.join([...tables])}))`.as(
          "changed"
        )
      )
      .select(["changed.table", "changed.column", "changed.idHex"])
  )

export const mapWriteClocks = <TId extends Id>(
  ids: ReadonlyArray<TId>,
  rows: ReadonlyArray<{ readonly idHex: string; readonly clockHex: string }>
): ReadonlyMap<TId, string> => {
  const idByHex = new Map(
    ids.map((id) => [bytesToHex(idToIdBytes(id)).toUpperCase(), id])
  )
  return new Map(
    rows.flatMap((row) => {
      const id = idByHex.get(row.idHex)
      return id === undefined ? [] : [[id, row.clockHex] as const]
    })
  )
}

export const idFromHex = (hex: string): Id | null => {
  const bytes = IdBytes.fromUnknown(hexToBytes(hex.toLowerCase()))
  return bytes.ok ? idBytesToId(bytes.value) : null
}
