import {
  createIdFromString,
  kyselySql,
  type NonEmptyReadonlyArray,
  type OwnerId,
  ownerIdToOwnerIdBytes,
} from "@evolu/common"
import { z } from "zod"

import { createQuery } from "../../evolu/schema.ts"
import {
  cashuOperation as cashuOperationColumns,
  cashuProof as cashuProofColumns,
} from "./cashu.ts"
import {
  type CashuOperationId,
  type CashuProofId,
  type CashuQuoteId,
  cashuShardScope,
  type MintUrl,
} from "./cashu-types.ts"
import { linkySettingIdFor, shardPointerIdFor } from "./cashu-utils.ts"

/*
 * Every query over Linky's tables names the owners it reads (cashu.md §2):
 * Linky's app owner for `shardPointer`/`setting`, the cashu shard owners for
 * proofs and operations. Tombstones are read too, because Linky's merge rules
 * need them (`mergeProofCopies`, `mergeShardRows` in `cashu-utils.ts`); the
 * shard store applies those rules, not SQL.
 */

/** The pointer row of the cashu scope, live or tombstoned, under Linky's app owner. */
export const cashuShardPointerQuery = (linkyAppOwnerId: OwnerId) =>
  createQuery((db) =>
    db
      .selectFrom("shardPointer")
      .select(["id", "ownerId", "scope", "index", "rotatedAtMs", "isDeleted"])
      .where("ownerId", "=", linkyAppOwnerId)
      .where("id", "=", shardPointerIdFor(cashuShardScope))
  )

export const linkySettingQuery = (linkyAppOwnerId: OwnerId, key: string) =>
  createQuery((db) =>
    db
      .selectFrom("setting")
      .select(["id", "ownerId", "key", "value", "isDeleted"])
      .where("ownerId", "=", linkyAppOwnerId)
      .where("id", "=", linkySettingIdFor(key))
  )

const proofColumns = [
  "id",
  "ownerId",
  "createdAt",
  "isDeleted",
  "mint",
  "unit",
  "keysetId",
  "amount",
  "secret",
  "c",
  "dleq",
  "state",
  "operationId",
] as const

const operationColumns = [
  "id",
  "ownerId",
  "createdAt",
  "isDeleted",
  "kind",
  "status",
  "mint",
  "unit",
  "keysetId",
  "amount",
  "feeReserve",
  "inputsTotal",
  "quoteId",
  "invoice",
  "sourceMint",
  "counter",
  "locked",
  "expiresAtSec",
  "createdAtSec",
  "tokenText",
  "error",
] as const

/** Every copy of every proof under the shard owners, tombstones included. */
export const cashuProofCopiesQuery = (
  ownerIds: NonEmptyReadonlyArray<OwnerId>
) =>
  createQuery((db) =>
    db
      .selectFrom("cashuProof")
      .select(proofColumns)
      .where("ownerId", "in", ownerIds)
  )

export const cashuProofCopiesByIdQuery = (
  ownerIds: NonEmptyReadonlyArray<OwnerId>,
  id: CashuProofId
) =>
  createQuery((db) =>
    db
      .selectFrom("cashuProof")
      .select(proofColumns)
      .where("ownerId", "in", ownerIds)
      .where("id", "=", id)
  )

/** Every copy of every operation under the shard owners, tombstones included. */
export const cashuOperationCopiesQuery = (
  ownerIds: NonEmptyReadonlyArray<OwnerId>
) =>
  createQuery((db) =>
    db
      .selectFrom("cashuOperation")
      .select(operationColumns)
      .where("ownerId", "in", ownerIds)
  )

export const cashuOperationCopiesByIdQuery = (
  ownerIds: NonEmptyReadonlyArray<OwnerId>,
  id: CashuOperationId
) =>
  createQuery((db) =>
    db
      .selectFrom("cashuOperation")
      .select(operationColumns)
      .where("ownerId", "in", ownerIds)
      .where("id", "=", id)
  )

/** Copies of the operations behind one mint quote: a topup, a melt, an autoswap. */
export const cashuOperationCopiesByQuoteQuery = (
  ownerIds: NonEmptyReadonlyArray<OwnerId>,
  quoteId: CashuQuoteId
) =>
  createQuery((db) =>
    db
      .selectFrom("cashuOperation")
      .select(operationColumns)
      .where("ownerId", "in", ownerIds)
      .where("quoteId", "=", quoteId)
  )

/** Whether a shard owner holds any Cashu row, tombstones included (`repairPointers`). */
export const cashuShardHoldsRowsQuery = (ownerId: OwnerId) =>
  createQuery((db) =>
    db
      .selectFrom(
        kyselySql<{
          holdsRows: number
        }>`(select (exists (select 1 from "cashuProof" where "ownerId" = ${ownerId}) or exists (select 1 from "cashuOperation" where "ownerId" = ${ownerId})) as "holdsRows")`.as(
          "probe"
        )
      )
      .select("probe.holdsRows")
  )

/**
 * What the shard rotation measures (Linky's `ownerUsage`,
 * `evolu/evoluShardDb.ts`): distinct timestamps and value bytes in the
 * owner's local `evolu_history`, which keys rows by the owner id's bytes.
 * `evolu-history-shape.test.ts` fails when that table changes shape.
 */
export const cashuShardUsageQuery = (ownerId: OwnerId) =>
  createQuery((db) =>
    db
      .selectFrom(
        kyselySql<{
          mutations: number
          bytes: number
        }>`(select count(distinct "timestamp") as "mutations", coalesce(sum(length("value")), 0) as "bytes" from "evolu_history" where "ownerId" = ${ownerIdToOwnerIdBytes(ownerId)})`.as(
          "usage"
        )
      )
      .select(["usage.mutations", "usage.bytes"])
  )

export const cashuBookingCursorId = createIdFromString<"CashuBookingCursor">(
  "cashu-booking-cursor"
)

export const cashuBookingCursorQuery = createQuery((db) =>
  db
    .selectFrom("_cashuBookingCursor")
    .select(["historyRowid"])
    .where("id", "=", cashuBookingCursorId)
)

/**
 * The operations whose `status` changed on this device after `afterRowid`,
 * in arrival order, under the given shard owners: what the booking job reads
 * on every run after its bootstrap. A rowid range, so the cost follows the
 * new changes only.
 */
export const changedCashuOperationIdsQuery = (
  afterRowid: number,
  throughRowid: number,
  ownerIds: NonEmptyReadonlyArray<OwnerId>
) =>
  createQuery((db) =>
    db
      .selectFrom(
        kyselySql<{
          idHex: string
        }>`(select distinct hex("id") as "idHex" from "evolu_history" where "rowid" > ${afterRowid} and "rowid" <= ${throughRowid} and "table" = 'cashuOperation' and "column" = 'status' and "ownerId" in (${kyselySql.join(ownerIds.map((ownerId) => ownerIdToOwnerIdBytes(ownerId)))}))`.as(
          "changed"
        )
      )
      .select("changed.idHex")
  )

/*
 * Rows as Linky's decoders accept them (`toStoredProof`/`toStoredOperation`):
 * a copy that does not decode is skipped, as Linky skips it.
 */

const systemColumns = {
  ownerId: z.string(),
  createdAt: z.string(),
  isDeleted: z.union([z.literal(0), z.literal(1)]).nullable(),
}

const optional = <T extends z.ZodType>(schema: T) => schema.nullable()

const CashuProofCopySchema = z.object({
  ...systemColumns,
  id: cashuProofColumns.id,
  mint: cashuProofColumns.mint,
  unit: cashuProofColumns.unit,
  keysetId: cashuProofColumns.keysetId,
  amount: cashuProofColumns.amount,
  secret: cashuProofColumns.secret,
  c: z
    .string()
    .regex(/^(?:[0-9a-f]{2})+$/iu)
    .pipe(cashuProofColumns.c),
  dleq: optional(z.string()),
  state: cashuProofColumns.state,
  operationId: cashuProofColumns.operationId,
})
export type CashuProofCopy = z.output<typeof CashuProofCopySchema> & {
  readonly ownerId: OwnerId
}

const CashuOperationCopySchema = z.object({
  ...systemColumns,
  id: cashuOperationColumns.id,
  kind: cashuOperationColumns.kind,
  status: cashuOperationColumns.status,
  mint: cashuOperationColumns.mint,
  unit: cashuOperationColumns.unit,
  keysetId: cashuOperationColumns.keysetId,
  amount: cashuOperationColumns.amount,
  feeReserve: cashuOperationColumns.feeReserve,
  inputsTotal: cashuOperationColumns.inputsTotal,
  quoteId: cashuOperationColumns.quoteId,
  invoice: cashuOperationColumns.invoice,
  sourceMint: cashuOperationColumns.sourceMint,
  counter: cashuOperationColumns.counter,
  locked: cashuOperationColumns.locked,
  expiresAtSec: cashuOperationColumns.expiresAtSec,
  createdAtSec: cashuOperationColumns.createdAtSec,
  tokenText: cashuOperationColumns.tokenText,
  error: optional(z.string()),
})
export type CashuOperationCopy = z.output<typeof CashuOperationCopySchema> & {
  readonly ownerId: OwnerId
}

const decodeRows = <T>(
  schema: z.ZodType<T>,
  rows: ReadonlyArray<unknown>
): ReadonlyArray<T> =>
  rows.flatMap((row) => {
    const decoded = schema.safeParse(row)
    return decoded.success ? [decoded.data] : []
  })

export const decodeCashuProofCopies = (
  rows: ReadonlyArray<unknown>
): ReadonlyArray<CashuProofCopy> =>
  decodeRows(CashuProofCopySchema, rows) as ReadonlyArray<CashuProofCopy>

export const decodeCashuOperationCopies = (
  rows: ReadonlyArray<unknown>
): ReadonlyArray<CashuOperationCopy> =>
  decodeRows(
    CashuOperationCopySchema,
    rows
  ) as ReadonlyArray<CashuOperationCopy>

/** The available balance per mint over merged proofs, as Linky's balance reads it. */
export const sumAvailableByMint = (
  proofs: ReadonlyArray<CashuProofCopy>
): ReadonlyMap<MintUrl, number> => {
  const balances = new Map<MintUrl, number>()
  for (const proof of proofs) {
    if (proof.state !== "available" || proof.unit !== "sat") continue
    balances.set(proof.mint, (balances.get(proof.mint) ?? 0) + proof.amount)
  }
  return balances
}
