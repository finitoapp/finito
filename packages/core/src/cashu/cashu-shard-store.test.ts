import {
  type Owner,
  type OwnerId,
  sqliteTrue,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createQuery, type Evolu } from "../evolu/schema.ts"
import { saveCashuAccount } from "../modules/account/account-actions.ts"
import { cashuOperationChangesQuery } from "../modules/cashu/cashu-queries.ts"
import {
  CashuAmount,
  type CashuQuoteId,
  KeysetId,
  MintUrl,
} from "../modules/cashu/cashu-types.ts"
import {
  cashuOperationIdFor,
  cashuProofIdFor,
  shardPointerIdFor,
} from "../modules/cashu/cashu-utils.ts"
import { MasterKey } from "../modules/shared/key-derivation.ts"
import { createEvoluTest } from "../testing/evolu.ts"
import {
  type CashuShardStore,
  createCashuShardStore,
  type LinkyOwnerSync,
  type NewCashuOperation,
  type NewCashuProof,
  startCashuShardStore,
} from "./cashu-shard-store.ts"
import { deriveCashuShardOwner, deriveLinkyAppOwner } from "./linky-owners.ts"

const linkyAppOwner = deriveLinkyAppOwner(
  MasterKey("000102030405060708090a0b0c0d0e0f")
)
const shard = (index: number) => deriveCashuShardOwner(linkyAppOwner, index)
const mint = MintUrl("https://cashu.cz")
const keysetId = KeysetId("00ad268c4d1f5826")

const allProofRowsQuery = createQuery((db) =>
  db
    .selectFrom("cashuProof")
    .select(["id", "ownerId", "state", "isDeleted", "amount"])
)
const allOperationRowsQuery = createQuery((db) =>
  db
    .selectFrom("cashuOperation")
    .select(["id", "ownerId", "status", "isDeleted", "counter"])
)
const allPointerRowsQuery = createQuery((db) =>
  db.selectFrom("shardPointer").select(["id", "ownerId", "index"])
)
const allSettingRowsQuery = createQuery((db) =>
  db.selectFrom("setting").select(["id", "ownerId", "key", "value"])
)

const proof = (secret: string, amount = 8): NewCashuProof => ({
  mint,
  unit: "sat",
  keysetId,
  amount: CashuAmount(amount),
  secret,
  C: "02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2",
  dleq: null,
  state: "available",
  operationId: null,
})

const topup = (quoteId: string): NewCashuOperation => ({
  kind: "topup",
  status: "pending",
  mint,
  unit: "sat",
  keysetId,
  amount: CashuAmount(100),
  feeReserve: null,
  inputsTotal: null,
  quoteId: quoteId as CashuQuoteId,
  invoice: null,
  sourceMint: null,
  counter: null,
  locked: false,
  expiresAtSec: 1_900_000_000,
  createdAtSec: 1_800_000_000,
  tokenText: null,
  error: null,
})

/** Every owner reported synced unless the test holds it back. */
const createOwnerSync = (synced = true) => {
  let allSynced = synced
  const listeners = new Set<() => void>()
  const ownerSync: LinkyOwnerSync = {
    isOwnerSynced: () => allSynced,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    ownerSync,
    markSynced: () => {
      allSynced = true
      for (const listener of listeners) listener()
    },
  }
}

const setup = async ({
  synced = true,
  now = () => 1_800_000_000_000,
}: {
  readonly synced?: boolean
  readonly now?: () => number
} = {}) => {
  const evoluTest = await createEvoluTest()
  const registered = new Map<OwnerId, number>()
  const sync = createOwnerSync(synced)
  const store = createCashuShardStore({
    evolu: evoluTest.evolu,
    linkyAppOwner,
    ownerSync: sync.ownerSync,
    relays: ["wss://evolu.linky.fit"],
    now,
    registerOwner: (owner) => {
      registered.set(owner.id, (registered.get(owner.id) ?? 0) + 1)
      return () => registered.set(owner.id, (registered.get(owner.id) ?? 1) - 1)
    },
  })
  return {
    evolu: evoluTest.evolu,
    store,
    registered,
    markSynced: sync.markSynced,
    [Symbol.asyncDispose]: async () => {
      store[Symbol.dispose]()
      await evoluTest[Symbol.asyncDispose]()
    },
  }
}

/** A row "Linky" wrote: straight into the database under one of its owners. */
const linkyWrite = (
  evolu: Evolu,
  table: "cashuProof" | "shardPointer",
  values: Record<string, unknown>,
  owner: Owner
) =>
  new Promise<void>((resolve) => {
    evolu.upsert(table, values as never, { owner, onComplete: resolve })
  })

const linkyProof = (secret: string, state: string, owner: Owner) => ({
  values: {
    id: cashuProofIdFor(secret),
    mint,
    unit: "sat",
    keysetId,
    amount: 8,
    secret,
    c: "02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2",
    state,
  },
  owner,
})

const movePointer = (evolu: Evolu, index: number) =>
  linkyWrite(
    evolu,
    "shardPointer",
    {
      id: shardPointerIdFor("cashu"),
      scope: "cashu",
      index,
      rotatedAtMs: 1_700_000_000_000,
    },
    linkyAppOwner
  )

const ownersOf = async (
  evolu: Evolu
): Promise<ReadonlyArray<OwnerId | null>> => [
  ...(await evolu.loadQuery(allProofRowsQuery)).map((row) => row.ownerId),
  ...(await evolu.loadQuery(allOperationRowsQuery)).map((row) => row.ownerId),
  ...(await evolu.loadQuery(allPointerRowsQuery)).map((row) => row.ownerId),
  ...(await evolu.loadQuery(allSettingRowsQuery)).map((row) => row.ownerId),
]

const waitForHydration = (store: CashuShardStore) => store.whenHydrated()

describe("cashu shard store", () => {
  test("a missing pointer means shard 0, as on an account Linky never saw", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    expect(await t.store.activeIndex()).toBe(0)

    await t.store.insertProofs([proof("a")])

    const [row] = await t.evolu.loadQuery(allProofRowsQuery)
    expect(row?.ownerId).toBe(shard(0).id)
  })

  test("every write names a Linky owner, never Payky's own", async () => {
    await using t = await setup()
    await waitForHydration(t.store)

    await t.store.insertProofs([proof("a"), proof("b")])
    const operationId = await t.store.insertOperation(topup("q1"))
    await t.store.updateOperation(operationId, { counter: 64 })
    await t.store.updateProof(cashuProofIdFor("a"), { state: "spent" })
    await t.store.writeSetting("defaultMint", "https://cashu.cz")

    const owners = await ownersOf(t.evolu)
    expect(owners.length).toBeGreaterThan(0)
    expect(owners).not.toContain(t.evolu.appOwner.id)
    expect(new Set(owners)).toEqual(new Set([shard(0).id, linkyAppOwner.id]))
    const [setting] = await t.evolu.loadQuery(allSettingRowsQuery)
    expect(setting?.ownerId).toBe(linkyAppOwner.id)
  })

  test("Linky's app owner and every shard up to the pointer stay registered", async () => {
    await using t = await setup()
    await movePointer(t.evolu, 2)
    await waitForHydration(t.store)
    await t.store.repairPointers()

    expect(await t.store.activeIndex()).toBe(2)
    for (const owner of [linkyAppOwner, shard(0), shard(1), shard(2)])
      expect(t.registered.get(owner.id)).toBe(1)
  })

  test("a pointer Linky moves while Payky runs is followed", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    await t.store.insertProofs([proof("a")])

    await movePointer(t.evolu, 3)
    await t.store.insertProofs([proof("b")])

    const rows = await t.evolu.loadQuery(allProofRowsQuery)
    expect(rows.find((row) => row.id === cashuProofIdFor("b"))?.ownerId).toBe(
      shard(3).id
    )
    expect(t.registered.get(shard(3).id)).toBe(1)
  })

  test("an update of a row in an older shard copies it forward and tombstones the old copy", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    await t.store.insertProofs([proof("a")])
    await movePointer(t.evolu, 1)

    await t.store.updateProof(cashuProofIdFor("a"), { state: "held" })

    const rows = await t.evolu.loadQuery(allProofRowsQuery)
    expect(
      rows.map(({ ownerId, state, isDeleted }) => ({
        ownerId,
        state,
        isDeleted,
      }))
    ).toEqual(
      expect.arrayContaining([
        { ownerId: shard(0).id, state: "available", isDeleted: sqliteTrue },
        // Linky's copy-forward leaves `isDeleted` unset, as here.
        { ownerId: shard(1).id, state: "held", isDeleted: null },
      ])
    )
    const [merged] = await t.store.loadProofs()
    expect(merged?.state).toBe("held")
  })

  test("an operation insert is an upsert by its key", async () => {
    await using t = await setup()
    await waitForHydration(t.store)

    const first = await t.store.insertOperation(topup("q1"))
    const again = await t.store.insertOperation({
      ...topup("q1"),
      status: "done",
    })

    expect(again).toBe(first)
    expect(first).toBe(cashuOperationIdFor("topup|https://cashu.cz|q1"))
    const rows = await t.evolu.loadQuery(allOperationRowsQuery)
    expect(rows).toHaveLength(1)
    expect((await t.store.loadOperation(first))?.status).toBe("done")
  })

  test("the pending operations are the ones still pending once merged, an older shard's pending copy aside", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    const settled = await t.store.insertOperation(topup("q1"))
    const stillPending = await t.store.insertOperation(topup("q2"))
    await movePointer(t.evolu, 1)

    await t.store.updateOperation(settled, { status: "done" })

    expect((await t.store.loadPendingOperations()).map(({ id }) => id)).toEqual(
      [stillPending]
    )
  })

  test("an operation write fires the operation changes", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    const fired = Promise.withResolvers<void>()
    const stop = t.store.subscribeOperationChanges(() => fired.resolve())
    await t.evolu.loadQuery(
      cashuOperationChangesQuery(await t.store.shardOwnerIds())
    )

    await t.store.insertOperation(topup("q1"))

    await fired.promise
    stop()
  })

  test("any spent copy wins the merge, even a tombstoned one", async () => {
    await using t = await setup()
    await movePointer(t.evolu, 1)
    const spentOld = linkyProof("s", "spent", shard(0))
    await linkyWrite(t.evolu, "cashuProof", spentOld.values, spentOld.owner)
    await linkyWrite(
      t.evolu,
      "cashuProof",
      { ...spentOld.values, isDeleted: sqliteTrue },
      spentOld.owner
    )
    const availableNew = linkyProof("s", "available", shard(1))
    await linkyWrite(
      t.evolu,
      "cashuProof",
      availableNew.values,
      availableNew.owner
    )
    const plainOld = linkyProof("p", "available", shard(0))
    await linkyWrite(t.evolu, "cashuProof", plainOld.values, plainOld.owner)
    const plainNew = linkyProof("p", "held", shard(1))
    await linkyWrite(t.evolu, "cashuProof", plainNew.values, plainNew.owner)

    const merged = await t.store.loadProofs()
    expect(
      Object.fromEntries(merged.map((row) => [row.secret, row.state]))
    ).toEqual({ s: "spent", p: "held" })
  })

  test("writes wait until the Linky owners are hydrated", async () => {
    await using t = await setup({ synced: false })
    let written = false
    const write = t.store.insertProofs([proof("a")]).then(() => {
      written = true
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(written).toBe(false)
    expect(await t.evolu.loadQuery(allProofRowsQuery)).toEqual([])

    t.markSynced()
    await write
    expect(t.store.isHydrated()).toBe(true)
    expect(await t.evolu.loadQuery(allProofRowsQuery)).toHaveLength(1)
  })

  test("the active shard rotates past 170 mutations, at most once a minute", async () => {
    let nowMs = 1_800_000_000_000
    await using t = await setup({ now: () => nowMs })
    await waitForHydration(t.store)

    // One write is one mutation (one Evolu timestamp), however many rows.
    for (let i = 0; i < 169; i += 1)
      await t.store.insertProofs([proof(`r${i}`)])
    expect(await t.store.activeIndex()).toBe(0)
    await t.store.insertProofs([proof("r169")])
    expect(await t.store.activeIndex()).toBe(1)
    // The rotation creates the pointer Linky reads (decision 8).
    expect(await t.evolu.loadQuery(allPointerRowsQuery)).toEqual([
      { id: shardPointerIdFor("cashu"), ownerId: linkyAppOwner.id, index: 1 },
    ])

    for (let i = 0; i < 175; i += 1)
      await t.store.insertProofs([proof(`s${i}`)])
    expect(await t.store.activeIndex()).toBe(1)

    nowMs += 61_000
    await t.store.insertProofs([proof("t")])
    expect(await t.store.activeIndex()).toBe(2)
  }, 60_000)

  test("repairPointers moves the pointer up to the newest shard holding rows, never down", async () => {
    await using t = await setup()
    const a = linkyProof("a", "available", shard(1))
    await linkyWrite(t.evolu, "cashuProof", a.values, a.owner)
    const b = linkyProof("b", "available", shard(2))
    await linkyWrite(t.evolu, "cashuProof", b.values, b.owner)
    await linkyWrite(
      t.evolu,
      "cashuProof",
      { ...b.values, isDeleted: sqliteTrue },
      b.owner
    )

    await t.store.repairPointers()
    expect(await t.store.activeIndex()).toBe(2)

    await movePointer(t.evolu, 5)
    await t.store.repairPointers()
    expect(await t.store.activeIndex()).toBe(5)
  })

  test("a setting write is skipped when the value is the same", async () => {
    await using t = await setup()
    await waitForHydration(t.store)
    await t.store.writeSetting("defaultMint", "https://cashu.cz")
    await t.store.writeSetting("defaultMint", "https://cashu.cz")
    expect(await t.store.readSetting("defaultMint")).toBe("https://cashu.cz")
    expect(await t.evolu.loadQuery(allSettingRowsQuery)).toHaveLength(1)
  })
})

describe("startCashuShardStore", () => {
  const registrations = () => {
    const live = new Map<OwnerId, number>()
    return {
      live,
      registerOwner: (owner: { readonly id: OwnerId }) => {
        live.set(owner.id, (live.get(owner.id) ?? 0) + 1)
        return () => live.set(owner.id, (live.get(owner.id) ?? 1) - 1)
      },
    }
  }

  test("a demo account registers no Linky owner and keeps its rows local", async () => {
    await using evoluTest = await createEvoluTest()
    const { live, registerOwner } = registrations()
    const store = startCashuShardStore({
      evolu: evoluTest.evolu,
      account: {
        masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
        demo: "seeded",
      },
      ownerSync: createOwnerSync(false).ownerSync,
      fetchRelays: () => Promise.resolve(null),
      registerOwner,
      signal: new AbortController().signal,
    })
    await store.whenHydrated()
    await store.writeSetting("defaultMint", "https://cashu.cz")
    expect(live.size).toBe(0)
  })

  test("an account syncs Linky's owners only once Cashu is enabled, and releases them with the app Evolu", async () => {
    await using evoluTest = await createEvoluTest()
    const { live, registerOwner } = registrations()
    const controller = new AbortController()
    const store = startCashuShardStore({
      evolu: evoluTest.evolu,
      account: {
        masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
        demo: null,
      },
      ownerSync: createOwnerSync(false).ownerSync,
      fetchRelays: () => Promise.resolve(null),
      registerOwner,
      signal: controller.signal,
    })
    expect(store.linkyAppOwner.id).toBe(linkyAppOwner.id)
    await store.activeIndex()
    await new Promise((resolve) => setTimeout(resolve, 10))
    // Until Cashu is enabled, no Linky relay is contacted (landing/0009).
    expect([...live.values()].filter((count) => count > 0)).toEqual([])

    await using run = testCreateRun({
      evolu: evoluTest.evolu,
      evoluOwner: evoluTest.evolu.appOwner,
      cashuShardStore: store,
    })
    await run.ok(saveCashuAccount({ enabled: true }))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(live.get(linkyAppOwner.id)).toBe(1)
    expect(live.get(shard(0).id)).toBe(1)
    expect(live.has(evoluTest.evolu.appOwner.id)).toBe(false)

    controller.abort()
    expect([...live.values()].every((count) => count === 0)).toBe(true)
  })
})
