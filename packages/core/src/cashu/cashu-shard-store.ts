import {
  type AppOwner,
  isNonEmptyArray,
  type MutationOptions,
  type NonEmptyReadonlyArray,
  type OwnerId,
  type OwnerTransport,
  type ShardOwner,
  sqliteFalse,
  sqliteTrue,
} from "@evolu/common"
import type { Evolu } from "../evolu/schema.ts"
import { cashuAccountQuery } from "../modules/account/account-queries.ts"
import {
  type CashuOperationCopy,
  type CashuProofCopy,
  cashuOperationCopiesByIdQuery,
  cashuOperationCopiesQuery,
  cashuProofCopiesQuery,
  cashuShardHoldsRowsQuery,
  cashuShardPointerQuery,
  cashuShardUsageQuery,
  decodeCashuOperationCopies,
  decodeCashuProofCopies,
  linkySettingQuery,
} from "../modules/cashu/cashu-queries.ts"
import {
  type CashuAmount,
  type CashuBolt11,
  type CashuOperationId,
  type CashuOperationKind,
  type CashuOperationStatus,
  type CashuProofId,
  type CashuProofState,
  type CashuQuoteId,
  type CashuTokenText,
  cashuShardScope,
  type KeysetId,
  LinkyString100Schema,
  LinkyString1000Schema,
  type MintUrl,
  NonNegativeIntSchema,
  PositiveIntSchema,
} from "../modules/cashu/cashu-types.ts"
import {
  cashuOperationIdFor,
  cashuProofIdFor,
  linkySettingIdFor,
  mergeProofCopies,
  mergeShardRows,
  operationKeyOf,
  shardPointerIdFor,
} from "../modules/cashu/cashu-utils.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../modules/shared/evolu-utils.ts"
import type { MasterKey } from "../modules/shared/key-derivation.ts"
import {
  deriveCashuShardOwner,
  deriveLinkyAppOwner,
  linkyOwnerTransports,
} from "./linky-owners.ts"

/**
 * The one writer of Linky's tables, and the place Linky's shard rules live
 * (cashu.md §2, `linksync/src/core/shardStore.ts` and `model/scopes.ts` in
 * Linky):
 *
 * - The cashu scope's active shard is `max(pointer, pending local rotation)`;
 *   the pointer is the live `shardPointer/cashu` row under Linky's app owner,
 *   whoever wrote it, and a missing one means shard 0.
 * - Every shard `0..active` stays synced (`useOwner`) — the cashu scope is
 *   never forgotten — and a pointer moved by Linky subscribes the new shard.
 * - Writes go to the active shard; a row living in an older shard is copied
 *   whole into the active one and tombstoned where it was.
 * - After 256 KiB of value bytes or 170 mutations in the active shard's local
 *   history, at most once per minute, a write rotates to the next shard.
 * - Writes wait until the store is hydrated: Linky's app owner and every
 *   visible shard finished a sync round, so a fresh device never writes into
 *   shard 0 before the pointer arrives.
 *
 * Payky's own owner never holds a Linky row: every write here names its
 * owner, and the tests check the owner of every write.
 */

/** Linky's `SHARD_MAX_BYTES` and the cashu scope's `rotation(170)`. */
export const cashuShardRotation = {
  maxBytes: 256 * 1024,
  maxMutations: 170,
  cooldownMs: 60_000,
} as const

/** Which owners finished a sync round with a relay, from Evolu's `syncState`. */
export interface LinkyOwnerSync {
  readonly isOwnerSynced: (ownerId: OwnerId) => boolean
  readonly subscribe: (listener: () => void) => () => void
}

export interface NewCashuProof {
  readonly mint: MintUrl
  readonly unit: "sat"
  readonly keysetId: KeysetId
  readonly amount: CashuAmount
  readonly secret: string
  /** The NUT-00 signature point. */
  readonly C: string
  readonly dleq: string | null
  readonly state: CashuProofState
  readonly operationId: CashuOperationId | null
}

export interface CashuProofPatch {
  readonly state?: CashuProofState
  readonly operationId?: CashuOperationId | null
}

export interface NewCashuOperation {
  readonly kind: CashuOperationKind
  readonly status: CashuOperationStatus
  readonly mint: MintUrl
  readonly unit: "sat"
  readonly keysetId: KeysetId | null
  readonly amount: CashuAmount
  readonly feeReserve: number | null
  readonly inputsTotal: number | null
  readonly quoteId: CashuQuoteId | null
  readonly invoice: CashuBolt11 | null
  readonly sourceMint: MintUrl | null
  readonly counter: number | null
  readonly locked: boolean | null
  readonly expiresAtSec: number | null
  readonly createdAtSec: number
  readonly tokenText: CashuTokenText | null
  readonly error: string | null
}

export interface CashuOperationPatch {
  readonly status?: CashuOperationStatus
  readonly keysetId?: KeysetId
  readonly counter?: number
  readonly error?: string | null
}

export interface CashuShardStore extends Disposable {
  readonly linkyAppOwner: AppOwner
  readonly activeIndex: () => Promise<number>
  readonly shardOwner: (index: number) => ShardOwner
  /** The owners of shards `0..active`, the ones every query names. */
  readonly shardOwnerIds: () => Promise<NonEmptyReadonlyArray<OwnerId>>
  readonly isHydrated: () => boolean
  /** Resolves once hydrated, or rejects with the signal's reason. */
  readonly whenHydrated: (signal?: AbortSignal) => Promise<void>
  readonly subscribeHydration: (listener: () => void) => () => void
  /** Proofs merged as Linky merges them; spent ones included. */
  readonly loadProofs: () => Promise<ReadonlyArray<CashuProofCopy>>
  /** Operations merged as Linky merges them, live only. */
  readonly loadOperations: () => Promise<ReadonlyArray<CashuOperationCopy>>
  readonly loadOperation: (
    id: CashuOperationId
  ) => Promise<CashuOperationCopy | null>
  /** Upserts by id: a proof that exists anywhere visible is updated in place. */
  readonly insertProofs: (proofs: ReadonlyArray<NewCashuProof>) => Promise<void>
  /** Unknown id: no-op, as Linky's port. */
  readonly updateProof: (
    id: CashuProofId,
    patch: CashuProofPatch
  ) => Promise<void>
  /** Upserts by `operationKeyOf`: an existing operation gets every field replaced. */
  readonly insertOperation: (
    operation: NewCashuOperation
  ) => Promise<CashuOperationId>
  /** Unknown id: no-op, as Linky's port. */
  readonly updateOperation: (
    id: CashuOperationId,
    patch: CashuOperationPatch
  ) => Promise<void>
  readonly readSetting: (key: string) => Promise<string | null>
  /** Skips the write when the stored value is the same. */
  readonly writeSetting: (key: string, value: string) => Promise<void>
  /** Writes only when the setting has no row yet; queued like every write. */
  readonly writeSettingIfAbsent: (key: string, value: string) => Promise<void>
  /**
   * Once hydrated, moves the pointer up while the next shard holds rows,
   * tombstones included; never down. Waits for each probed shard to sync.
   */
  readonly repairPointers: (signal?: AbortSignal) => Promise<void>
  /** Re-registers every owner over a new relay list. */
  readonly switchRelays: (relays: NonEmptyReadonlyArray<string>) => void
  /** Fires after a change to the wallet's tables or to the pointer. */
  readonly subscribe: (listener: () => void) => () => void
}

export type RegisterLinkyOwner = (
  owner: AppOwner | ShardOwner,
  transports: NonEmptyReadonlyArray<OwnerTransport>
) => () => void

export interface CashuShardStoreDep {
  readonly cashuShardStore: CashuShardStore
}

type ShardRow = {
  readonly id: string
  readonly ownerId: OwnerId
  readonly isDeleted: 0 | 1 | null
} & Readonly<Record<string, unknown>>

const systemColumns = new Set([
  "ownerId",
  "createdAt",
  "updatedAt",
  "isDeleted",
])

/** The row without Evolu's system columns: what a copy into another shard writes. */
const columnsOf = (row: ShardRow): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).filter(([column]) => !systemColumns.has(column))
  )

const withoutNulls = (
  values: Readonly<Record<string, unknown>>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== null && value !== undefined
    )
  )

/** Linky's `toErrorColumn`: trimmed, cut at 1000 characters, null when empty. */
const toErrorColumn = (error: string | null): string | null => {
  const text = (error ?? "").trim().slice(0, 1000)
  return text === "" ? null : text
}

const proofColumns = (proof: NewCashuProof, id: CashuProofId) =>
  withoutNulls({
    id,
    mint: proof.mint,
    unit: proof.unit,
    keysetId: proof.keysetId,
    amount: proof.amount,
    secret: proof.secret,
    c: proof.C,
    dleq: proof.dleq,
    state: proof.state,
    operationId: proof.operationId,
  })

const operationColumns = (operation: NewCashuOperation, id: CashuOperationId) =>
  withoutNulls({
    id,
    kind: operation.kind,
    status: operation.status,
    mint: operation.mint,
    unit: operation.unit,
    keysetId: operation.keysetId,
    amount: operation.amount,
    feeReserve: operation.feeReserve,
    inputsTotal: operation.inputsTotal,
    quoteId: operation.quoteId,
    invoice: operation.invoice,
    sourceMint: operation.sourceMint,
    counter: operation.counter,
    locked:
      operation.locked === null
        ? null
        : operation.locked
          ? sqliteTrue
          : sqliteFalse,
    expiresAtSec: operation.expiresAtSec,
    createdAtSec: operation.createdAtSec,
    tokenText: operation.tokenText,
    error: toErrorColumn(operation.error),
  })

type LinkyTable = "cashuProof" | "cashuOperation" | "shardPointer" | "setting"

interface Mutation {
  readonly kind: "upsert" | "update"
  readonly table: LinkyTable
  readonly ownerId: OwnerId
  readonly values: Readonly<Record<string, unknown>>
}

export const createCashuShardStore = ({
  evolu,
  linkyAppOwner,
  ownerSync,
  relays: initialRelays,
  now = Date.now,
  registerOwner = (owner, transports) => evolu.useOwner(owner, transports),
}: {
  readonly evolu: Evolu
  readonly linkyAppOwner: AppOwner
  readonly ownerSync: LinkyOwnerSync
  readonly relays: NonEmptyReadonlyArray<string>
  readonly now?: () => number
  /** `evolu.useOwner`; tests record the registrations instead of syncing. */
  readonly registerOwner?: RegisterLinkyOwner
}): CashuShardStore => {
  let relays = initialRelays
  let pendingIndex: number | null = null
  let rotatedLocallyAtMs: number | null = null
  let rotationInFlight = false
  let disposed = false
  let hydrated = false
  const hydrationListeners = new Set<() => void>()
  const usedOwners = new Map<OwnerId, () => void>()
  const shardOwners = new Map<number, ShardOwner>()
  const cleanups: Array<() => void> = []

  const shardOwner = (index: number): ShardOwner => {
    const cached = shardOwners.get(index)
    if (cached !== undefined) return cached
    const derived = deriveCashuShardOwner(linkyAppOwner, index)
    shardOwners.set(index, derived)
    return derived
  }

  // Without a relay Evolu can dial, the owner stays local, as with no relay.
  const register = (owner: AppOwner | ShardOwner): (() => void) => {
    const transports = linkyOwnerTransports(owner.id, relays)
    return isNonEmptyArray(transports)
      ? registerOwner(owner, transports)
      : () => {}
  }

  const observedIndex = async (): Promise<number> => {
    const [pointer] = await evolu.loadQuery(
      cashuShardPointerQuery(linkyAppOwner.id)
    )
    return pointer !== undefined &&
      pointer.isDeleted !== sqliteTrue &&
      typeof pointer.index === "number"
      ? pointer.index
      : 0
  }

  const activeIndex = async (): Promise<number> => {
    const observed = await observedIndex()
    if (pendingIndex !== null && observed >= pendingIndex) pendingIndex = null
    return Math.max(observed, pendingIndex ?? 0)
  }

  const shardIndexes = async (): Promise<ReadonlyArray<number>> => {
    const active = await activeIndex()
    return Array.from({ length: active + 1 }, (_, index) => index)
  }

  const shardOwnerIds = async (): Promise<NonEmptyReadonlyArray<OwnerId>> => {
    const [first, ...rest] = (await shardIndexes()).map(
      (index) => shardOwner(index).id
    )
    return [first ?? shardOwner(0).id, ...rest]
  }

  /** Uses Linky's app owner and every shard `0..active`; unuses nothing else. */
  const reconcileSync = async (): Promise<void> => {
    if (disposed) return
    const wanted = [linkyAppOwner, ...(await shardIndexes()).map(shardOwner)]
    if (disposed) return
    for (const owner of wanted)
      if (!usedOwners.has(owner.id)) usedOwners.set(owner.id, register(owner))
  }

  const checkHydration = async (): Promise<boolean> => {
    if (hydrated) return true
    if (!ownerSync.isOwnerSynced(linkyAppOwner.id)) return false
    await reconcileSync()
    const owners = await shardOwnerIds()
    if (!owners.every(ownerSync.isOwnerSynced)) return false
    // A fresh read after the sync round, so reads reflect what it brought.
    await evolu.loadQuery(cashuShardPointerQuery(linkyAppOwner.id))
    if (hydrated) return true
    hydrated = true
    for (const listener of hydrationListeners) listener()
    hydrationListeners.clear()
    return true
  }

  let hydrationQueue = Promise.resolve()
  const enqueueHydrationCheck = () => {
    hydrationQueue = hydrationQueue.then(async () => {
      // A check queued before the store was disposed has nothing to do.
      if (!disposed) await checkHydration().catch(() => false)
    })
  }

  const subscribeHydration = (listener: () => void): (() => void) => {
    if (hydrated) return () => {}
    hydrationListeners.add(listener)
    return () => {
      hydrationListeners.delete(listener)
    }
  }

  const whenHydrated = (signal?: AbortSignal): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (hydrated) {
        resolve()
        return
      }
      const onAbort = () => {
        stop()
        reject(signal?.reason)
      }
      const stop = subscribeHydration(() => {
        signal?.removeEventListener("abort", onAbort)
        resolve()
      })
      if (signal?.aborted) {
        onAbort()
        return
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      enqueueHydrationCheck()
    })

  // Every write and every pointer move runs one after another: reads that
  // decide a write (does the row exist, which shard is active) must not
  // interleave with another write.
  // ponytail: one queue for the whole wallet; per-mint queues if it ever
  // becomes the bottleneck.
  let writeQueue: Promise<unknown> = Promise.resolve()
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const result = writeQueue.then(work, work)
    writeQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  /** Every owner this store writes under: Linky's app owner or a derived shard. */
  const ownerOf = (id: OwnerId): AppOwner | ShardOwner => {
    if (id === linkyAppOwner.id) return linkyAppOwner
    for (const owner of shardOwners.values()) if (owner.id === id) return owner
    throw new Error(`Not a Linky owner this store derived: ${id}`)
  }

  const mutate = (mutations: ReadonlyArray<Mutation>): Promise<void> => {
    if (mutations.length === 0) return Promise.resolve()
    return runMutationWithCompletion((options: MutationOptions) => {
      for (const mutation of mutations) {
        const mutationOptions = { ...options, owner: ownerOf(mutation.ownerId) }
        // The values were built from the table's own columns above; Evolu
        // validates them against the schema again.
        const values = mutation.values as never
        if (mutation.kind === "upsert")
          evolu.upsert(mutation.table, values, mutationOptions)
        else evolu.update(mutation.table, values, mutationOptions)
      }
    })
  }

  const writePointer = async (index: number): Promise<void> => {
    const nowMs = now()
    await mutate([
      {
        kind: "upsert",
        table: "shardPointer",
        ownerId: linkyAppOwner.id,
        values: {
          id: shardPointerIdFor(cashuShardScope),
          scope: LinkyString100Schema.parse(cashuShardScope),
          index: NonNegativeIntSchema.parse(index),
          rotatedAtMs: PositiveIntSchema.parse(nowMs),
        },
      },
    ])
    pendingIndex = index
    rotatedLocallyAtMs = nowMs
    await reconcileSync()
  }

  const maybeRotate = async (): Promise<void> => {
    const active = await activeIndex()
    const [usage] = await evolu.loadQuery(
      cashuShardUsageQuery(shardOwner(active).id)
    )
    const mutations = Number(usage?.mutations ?? 0)
    const bytes = Number(usage?.bytes ?? 0)
    if (
      bytes < cashuShardRotation.maxBytes &&
      mutations < cashuShardRotation.maxMutations
    )
      return
    const [pointer] = await evolu.loadQuery(
      cashuShardPointerQuery(linkyAppOwner.id)
    )
    const nowMs = now()
    const rotatedAt = [pointer?.rotatedAtMs, rotatedLocallyAtMs].filter(
      (at): at is NonNullable<typeof at> => typeof at === "number"
    )
    if (rotatedAt.some((at) => nowMs - at < cashuShardRotation.cooldownMs))
      return
    if (rotationInFlight) return
    rotationInFlight = true
    try {
      await writePointer(active + 1)
    } finally {
      rotationInFlight = false
    }
  }

  const proofCopies = async (): Promise<{
    readonly copies: ReadonlyArray<CashuProofCopy>
    readonly index: Map<OwnerId, number>
  }> => {
    const owners = await shardOwnerIds()
    const index = new Map(owners.map((owner, shard) => [owner, shard]))
    const rows = await evolu.loadQuery(cashuProofCopiesQuery(owners))
    return { copies: decodeCashuProofCopies(rows), index }
  }

  const operationCopies = async (
    id?: CashuOperationId
  ): Promise<{
    readonly copies: ReadonlyArray<CashuOperationCopy>
    readonly index: Map<OwnerId, number>
  }> => {
    const owners = await shardOwnerIds()
    const index = new Map(owners.map((owner, shard) => [owner, shard]))
    const rows = await evolu.loadQuery(
      id === undefined
        ? cashuOperationCopiesQuery(owners)
        : cashuOperationCopiesByIdQuery(owners, id)
    )
    return { copies: decodeCashuOperationCopies(rows), index }
  }

  /** The newest copy of a row, live or not; `undefined` when none is visible. */
  const newestCopy = <Row extends ShardRow>(
    copies: ReadonlyArray<Row>,
    index: ReadonlyMap<OwnerId, number>,
    id: string
  ): Row | undefined =>
    copies
      .filter((copy) => copy.id === id && index.has(copy.ownerId))
      .toSorted(
        (a, b) => (index.get(b.ownerId) ?? 0) - (index.get(a.ownerId) ?? 0)
      )[0]

  /** Linky's `update`: in place in the active shard, else copy forward and tombstone. */
  const updateMutations = async (
    table: "cashuProof" | "cashuOperation",
    current: ShardRow,
    patch: Readonly<Record<string, unknown>>
  ): Promise<ReadonlyArray<Mutation>> => {
    const active = shardOwner(await activeIndex()).id
    if (current.ownerId === active)
      return [
        {
          kind: "update",
          table,
          ownerId: active,
          values: { ...patch, id: current.id },
        },
      ]
    return [
      {
        kind: "upsert",
        table,
        ownerId: active,
        values: { ...columnsOf(current), ...patch, id: current.id },
      },
      {
        kind: "update",
        table,
        ownerId: current.ownerId,
        values: { id: current.id, isDeleted: sqliteTrue },
      },
    ]
  }

  // Decision 8: an account Linky never saw writes into shard 0 with no
  // pointer, as Linky does; the first rotation creates the pointer row.
  const beforeWrite = (): Promise<void> => whenHydrated()

  const insertProofs = (proofs: ReadonlyArray<NewCashuProof>) =>
    serialized(async () => {
      if (proofs.length === 0) return
      await beforeWrite()
      const { copies, index } = await proofCopies()
      const live = new Map(
        mergeShardRows(copies, index).map((row) => [row.id, row])
      )
      const active = shardOwner(await activeIndex()).id
      const mutations: Mutation[] = []
      for (const proof of proofs) {
        const id = cashuProofIdFor(proof.secret)
        const columns = proofColumns(proof, id)
        const existing = live.get(id)
        mutations.push(
          ...(existing === undefined
            ? [
                {
                  kind: "upsert" as const,
                  table: "cashuProof" as const,
                  ownerId: active,
                  values: { ...columns, isDeleted: sqliteFalse },
                },
              ]
            : await updateMutations("cashuProof", existing, columns))
        )
      }
      await mutate(mutations)
      await maybeRotate()
    })

  const updateProof = (id: CashuProofId, patch: CashuProofPatch) =>
    serialized(async () => {
      await beforeWrite()
      const { copies, index } = await proofCopies()
      const current = newestCopy(copies, index, id)
      if (current === undefined || current.isDeleted === sqliteTrue) return
      await mutate(
        await updateMutations(
          "cashuProof",
          current,
          removeUndefinedValues({
            state: patch.state,
            operationId: patch.operationId,
          })
        )
      )
      await maybeRotate()
    })

  const insertOperation = (operation: NewCashuOperation) =>
    serialized(async () => {
      await beforeWrite()
      const id = cashuOperationIdFor(operationKeyOf(operation))
      const { copies, index } = await operationCopies(id)
      const current = newestCopy(copies, index, id)
      const columns = operationColumns(operation, id)
      await mutate(
        current === undefined || current.isDeleted === sqliteTrue
          ? [
              {
                kind: "upsert",
                table: "cashuOperation",
                ownerId: shardOwner(await activeIndex()).id,
                values: { ...columns, isDeleted: sqliteFalse },
              },
            ]
          : await updateMutations("cashuOperation", current, columns)
      )
      await maybeRotate()
      return id
    })

  const updateOperation = (id: CashuOperationId, patch: CashuOperationPatch) =>
    serialized(async () => {
      await beforeWrite()
      const { copies, index } = await operationCopies(id)
      const current = newestCopy(copies, index, id)
      if (current === undefined || current.isDeleted === sqliteTrue) return
      await mutate(
        await updateMutations(
          "cashuOperation",
          current,
          removeUndefinedValues({
            status: patch.status,
            keysetId: patch.keysetId,
            counter: patch.counter,
            error:
              patch.error === undefined
                ? undefined
                : toErrorColumn(patch.error),
          })
        )
      )
      await maybeRotate()
    })

  const readSetting = async (key: string): Promise<string | null> => {
    const [row] = await evolu.loadQuery(
      linkySettingQuery(linkyAppOwner.id, key)
    )
    return row === undefined || row.isDeleted === sqliteTrue
      ? null
      : (row.value ?? null)
  }

  const writeSetting = (key: string, value: string, onlyIfAbsent = false) =>
    serialized(async () => {
      await beforeWrite()
      const current = await readSetting(key)
      if (current === value || (onlyIfAbsent && current !== null)) return
      await mutate([
        {
          kind: "upsert",
          table: "setting",
          ownerId: linkyAppOwner.id,
          values: {
            id: linkySettingIdFor(key),
            key: LinkyString100Schema.parse(key),
            value: LinkyString1000Schema.parse(value),
            isDeleted: sqliteFalse,
          },
        },
      ])
    })

  const whenOwnerSynced = (ownerId: OwnerId, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const check = () => {
        if (!ownerSync.isOwnerSynced(ownerId)) return
        stop()
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }
      const onAbort = () => {
        stop()
        reject(signal?.reason)
      }
      const stop = ownerSync.subscribe(check)
      signal?.addEventListener("abort", onAbort, { once: true })
      check()
    })

  const probeHoldsRows = async (
    index: number,
    signal?: AbortSignal
  ): Promise<boolean> => {
    const owner = shardOwner(index)
    const unuse = usedOwners.has(owner.id) ? null : register(owner)
    try {
      await whenOwnerSynced(owner.id, signal)
      const [result] = await evolu.loadQuery(cashuShardHoldsRowsQuery(owner.id))
      return Number(result?.holdsRows ?? 0) === 1
    } finally {
      unuse?.()
    }
  }

  const repairPointers = async (signal?: AbortSignal): Promise<void> => {
    await whenHydrated(signal)
    let top = await activeIndex()
    while (await probeHoldsRows(top + 1, signal)) top += 1
    await serialized(async () => {
      if (top > (await activeIndex())) await writePointer(top)
    })
  }

  const switchRelays = (next: NonEmptyReadonlyArray<string>): void => {
    if (next.join(",") === relays.join(",")) return
    relays = next
    for (const [ownerId, unuse] of usedOwners) {
      unuse()
      usedOwners.delete(ownerId)
    }
    void reconcileSync()
  }

  const subscribe = (listener: () => void): (() => void) => {
    let stopped = false
    const stops: Array<() => void> = [
      evolu.subscribeQuery(cashuShardPointerQuery(linkyAppOwner.id))(listener),
    ]
    void shardOwnerIds().then((owners) => {
      if (stopped) return
      stops.push(
        evolu.subscribeQuery(cashuProofCopiesQuery(owners))(listener),
        evolu.subscribeQuery(cashuOperationCopiesQuery(owners))(listener)
      )
    })
    return () => {
      stopped = true
      for (const stop of stops) stop()
    }
  }

  // A pointer moved on another device arrives as a pointer change and
  // subscribes the new shard here (Linky's `followPointers`).
  const pointerQuery = cashuShardPointerQuery(linkyAppOwner.id)
  void evolu.loadQuery(pointerQuery).then(
    () => {
      if (disposed) return
      cleanups.push(
        evolu.subscribeQuery(pointerQuery)(() => {
          void reconcileSync().catch(() => {})
          enqueueHydrationCheck()
        })
      )
    },
    () => {
      // The database went away with the store; nothing to follow.
    }
  )
  cleanups.push(ownerSync.subscribe(enqueueHydrationCheck))
  void reconcileSync().catch(() => {})
  enqueueHydrationCheck()

  return {
    linkyAppOwner,
    activeIndex,
    shardOwner,
    shardOwnerIds,
    isHydrated: () => hydrated,
    whenHydrated,
    subscribeHydration,
    loadProofs: async () => {
      const { copies, index } = await proofCopies()
      return mergeProofCopies(copies, index)
    },
    loadOperations: async () => {
      const { copies, index } = await operationCopies()
      return mergeShardRows(copies, index)
    },
    loadOperation: async (id) => {
      const { copies, index } = await operationCopies(id)
      return mergeShardRows(copies, index)[0] ?? null
    },
    insertProofs,
    updateProof,
    insertOperation,
    updateOperation,
    readSetting,
    writeSetting: (key, value) => writeSetting(key, value),
    writeSettingIfAbsent: (key, value) => writeSetting(key, value, true),
    repairPointers,
    switchRelays,
    subscribe,
    [Symbol.dispose]: () => {
      disposed = true
      for (const cleanup of cleanups) cleanup()
      for (const unuse of usedOwners.values()) unuse()
      usedOwners.clear()
      hydrationListeners.clear()
    },
  }
}

/**
 * The store of the active account's app Evolu. Linky's owners sync only
 * while the Cashu account is enabled: an account that never turned Cashu on
 * talks to none of Linky's relays (landing/0009). A demo account registers
 * no Linky owner and syncs nothing (demo-data/0001): its Cashu rows stay in
 * the local database, hydrated from the start.
 */
export const startCashuShardStore = ({
  evolu,
  account,
  ownerSync,
  fetchRelays,
  fallbackRelays = ["wss://evolu.eu.freedomrelay.dev", "wss://evolu.linky.fit"],
  registerOwner = (owner, transports) => evolu.useOwner(owner, transports),
  signal,
}: {
  readonly evolu: Evolu
  readonly account: { readonly masterKey: MasterKey; readonly demo: unknown }
  readonly ownerSync: LinkyOwnerSync
  /** Linky's recommended relays, or null when they could not be fetched. */
  readonly fallbackRelays?: NonEmptyReadonlyArray<string>
  readonly fetchRelays: () => Promise<NonEmptyReadonlyArray<string> | null>
  readonly registerOwner?: RegisterLinkyOwner
  readonly signal: AbortSignal
}): CashuShardStore => {
  const demo = account.demo !== null

  // Registrations the store asks for, made only while Cashu is enabled.
  let active = false
  const registrations = new Set<{
    readonly owner: AppOwner | ShardOwner
    readonly transports: NonEmptyReadonlyArray<OwnerTransport>
    unuse: (() => void) | null
  }>()
  const gatedRegister: RegisterLinkyOwner = (owner, transports) => {
    const entry = {
      owner,
      transports,
      unuse: active ? registerOwner(owner, transports) : null,
    }
    registrations.add(entry)
    return () => {
      entry.unuse?.()
      registrations.delete(entry)
    }
  }

  const store = createCashuShardStore({
    evolu,
    linkyAppOwner: deriveLinkyAppOwner(account.masterKey),
    ownerSync: demo
      ? { isOwnerSynced: () => true, subscribe: () => () => {} }
      : ownerSync,
    relays: fallbackRelays,
    registerOwner: demo ? () => () => {} : gatedRegister,
  })
  signal.addEventListener("abort", () => store[Symbol.dispose](), {
    once: true,
  })
  if (demo) return store

  let started = false
  const setActive = (next: boolean) => {
    if (next === active || signal.aborted) return
    active = next
    for (const entry of registrations) {
      if (next) entry.unuse = registerOwner(entry.owner, entry.transports)
      else {
        entry.unuse?.()
        entry.unuse = null
      }
    }
    if (!next || started) return
    started = true
    void fetchRelays().then((relays) => {
      if (relays !== null && !signal.aborted) store.switchRelays(relays)
    })
    store.repairPointers(signal).catch(() => {
      // Aborted with the store; the next start repairs again.
    })
  }
  const followAccount = (
    rows: ReadonlyArray<{ readonly isDeleted: 0 | 1 | null }>
  ) => setActive(rows.some((row) => row.isDeleted !== sqliteTrue))
  void evolu.loadQuery(cashuAccountQuery).then(followAccount, () => {})
  const unsubscribe = evolu.subscribeQuery(cashuAccountQuery)(() => {
    followAccount(evolu.getQueryRows(cashuAccountQuery))
  })
  signal.addEventListener("abort", unsubscribe, { once: true })
  return store
}
