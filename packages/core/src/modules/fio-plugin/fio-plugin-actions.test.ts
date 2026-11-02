import {
  evoluJsonArrayFrom,
  sqliteFalse,
  sqliteTrue,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  DateStringSchema,
  IbanSchema,
  NonEmptyString255,
  PositiveInteger,
} from "../shared/schema.ts"
import {
  addFioPluginToken,
  deleteFioPlugin,
  deleteFioPluginToken,
  loadFioPlugin,
  saveFioPlugin,
  updateFioPluginSyncPointer,
} from "./fio-plugin-actions.ts"
import {
  activeFioPluginsQuery,
  fioPluginByIdQuery,
  fioPluginTokensByPluginIdQuery,
} from "./fio-plugin-queries.ts"
import type { FioPluginId } from "./fio-plugin-types.ts"
import { fioPluginId } from "./fio-plugin-utils.ts"

const fioPluginWithTokensByIdQuery = (id: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPlugin")
      .select((eb) => [
        "fioPlugin.id",
        "fioPlugin.accountId",
        "fioPlugin.numberOfSecondsBetweenChecks",
        "fioPlugin.syncLookbackDays",
        "fioPlugin.isActive",
        "fioPlugin.isDeleted",
        evoluJsonArrayFrom(
          eb
            .selectFrom("fioPluginToken")
            .select([
              "fioPluginToken.id",
              "fioPluginToken.fioPluginId",
              "fioPluginToken.token",
              "fioPluginToken.isDeleted",
            ])
            .whereRef("fioPluginToken.fioPluginId", "=", "fioPlugin.id")
            .orderBy("fioPluginToken.createdAt")
        ).as("tokens"),
      ])
      .where("fioPlugin.id", "=", id)
  )

const fioPluginSyncPointerByIdQuery = (id: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPluginSyncPointer")
      .select(["id", "lastSyncedDate", "isDeleted"])
      .where("id", "=", id)
  )

const createIbanAccount = async (
  deps: EvoluDep & EvoluOwnerDep
): Promise<AccountId> => {
  await using run = testCreateRun(deps)
  return await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )
}

describe("fio plugin actions", () => {
  test("creates and loads a FIO plugin with token through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const idResult = await run(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await run.ok(
      addFioPluginToken({
        fioPluginId: idResult.value,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    const id = idResult.value
    await expect
      .poll(() => evolu.loadQuery(fioPluginWithTokensByIdQuery(id)))
      .toMatchObject([
        {
          id,
          accountId,
          numberOfSecondsBetweenChecks: 300,
          syncLookbackDays: 1,
          isActive: sqliteTrue,
          tokens: [
            {
              fioPluginId: id,
              token: "fio-token-1",
              isDeleted: sqliteFalse,
            },
          ],
        },
      ])

    await expect(run(loadFioPlugin(id))).resolves.toMatchObject({
      ok: true,
      value: {
        id,
        accountId,
      },
    })
  }, 15_000)

  test("updates FIO plugin config and adds a token without preloading existing rows", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const idResult = await run(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await run.ok(
      addFioPluginToken({
        fioPluginId: idResult.value,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    const id = idResult.value
    const updateResult = await run(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(600),
        isActive: sqliteFalse,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-2"),
      })
    )

    expect(updateResult).toEqual({
      ok: true,
      value: id,
    })
    await expect
      .poll(() => evolu.loadQuery(fioPluginWithTokensByIdQuery(id)))
      .toMatchObject([
        {
          id,
          numberOfSecondsBetweenChecks: 600,
          syncLookbackDays: 1,
          isActive: sqliteFalse,
          tokens: [
            {
              fioPluginId: id,
              token: "fio-token-1",
              isDeleted: sqliteFalse,
            },
            {
              fioPluginId: id,
              token: "fio-token-2",
              isDeleted: sqliteFalse,
            },
          ],
        },
      ])
  }, 15_000)

  test("creates a FIO plugin without validating account existence or kind", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const cashRegisterAccountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: {
          currency: "CZK",
        },
      })
    )

    const idResult = await run(
      saveFioPlugin({
        accountId: cashRegisterAccountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await run.ok(
      addFioPluginToken({
        fioPluginId: idResult.value,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(fioPluginWithTokensByIdQuery(idResult.value)))
      .toMatchObject([
        {
          id: idResult.value,
          accountId: cashRegisterAccountId,
          tokens: [
            {
              fioPluginId: idResult.value,
              token: "fio-token-1",
            },
          ],
        },
      ])
    await expect(
      run(
        saveFioPlugin({
          accountId: cashRegisterAccountId,
          numberOfSecondsBetweenChecks: PositiveInteger(300),
          isActive: sqliteTrue,
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: idResult.value,
    })
  }, 15_000)

  test("saves tokens before the plugin row exists, and stays off until it does", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    // No `fioPlugin` row at all — which is what "the integration is off"
    // means. The id is fixed, so a token can still be saved against it.
    await run.ok(
      addFioPluginToken({
        fioPluginId,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginTokensByPluginIdQuery(fioPluginId)))
      .toMatchObject([{ token: "fio-token-1" }])

    // The sync job inner-joins `fioPlugin`, so an orphan token syncs nothing.
    await expect(evolu.loadQuery(activeFioPluginsQuery)).resolves.toEqual([])

    // Enabling it is a plain save — no separate "create" step, and the token
    // saved beforehand is picked up as-is.
    await expect(
      run(
        saveFioPlugin({
          accountId,
          numberOfSecondsBetweenChecks: PositiveInteger(60),
          isActive: sqliteTrue,
        })
      )
    ).resolves.toEqual({ ok: true, value: fioPluginId })
    await expect
      .poll(() => evolu.loadQuery(activeFioPluginsQuery))
      .toMatchObject([{ id: fioPluginId, tokens: [{ token: "fio-token-1" }] }])
  }, 15_000)

  test("a save revives a deleted plugin instead of leaving it hidden", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )
    await run.ok(deleteFioPlugin(fioPluginId))
    await expect
      .poll(() => evolu.loadQuery(fioPluginByIdQuery(fioPluginId)))
      .toEqual([])

    // The id is fixed, so this upserts the tombstoned row rather than
    // inserting a new one — it has to clear `isDeleted`, or saving would
    // silently do nothing forever after one delete.
    await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(90),
        isActive: sqliteTrue,
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginByIdQuery(fioPluginId)))
      .toMatchObject([{ id: fioPluginId, numberOfSecondsBetweenChecks: 90 }])
  }, 15_000)

  test("adding the same token twice leaves one row, and a setting saved twice adds none", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const id = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    // The settings form used to carry the token, so every save appended
    // another row for the same value and the sync job's rotation filled up
    // with duplicates. Saving a setting must now touch no token at all.
    await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(120),
        isActive: sqliteTrue,
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginTokensByPluginIdQuery(id)))
      .toEqual([])

    // And the token id is derived from the value, so re-adding one the plugin
    // already has is a no-op rather than a second entry in the rotation.
    const firstTokenId = await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    const repeatTokenId = await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    expect(repeatTokenId).toBe(firstTokenId)
    await expect
      .poll(() => evolu.loadQuery(fioPluginTokensByPluginIdQuery(id)))
      .toMatchObject([{ token: "fio-token-1" }])
  }, 15_000)

  test("re-adding a removed token revives it instead of staying hidden", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const id = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )
    const tokenId = await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await run.ok(deleteFioPluginToken(tokenId))
    await expect
      .poll(() => evolu.loadQuery(fioPluginTokensByPluginIdQuery(id)))
      .toEqual([])

    // The deterministic id means this upserts the tombstoned row rather than
    // inserting a new one, so it has to clear `isDeleted` — otherwise adding
    // a token back would silently do nothing.
    await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-1"),
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginTokensByPluginIdQuery(id)))
      .toMatchObject([{ id: tokenId, token: "fio-token-1" }])
  }, 15_000)

  test("soft deletes only the plugin root row", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const idResult = await run(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await run.ok(
      addFioPluginToken({
        fioPluginId: idResult.value,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    const id = idResult.value
    await expect(run(deleteFioPlugin(id))).resolves.toEqual({
      ok: true,
      value: id,
    })
    await expect(run(deleteFioPlugin(id))).resolves.toEqual({
      ok: true,
      value: id,
    })

    await expect
      .poll(() => evolu.loadQuery(fioPluginWithTokensByIdQuery(id)))
      .toMatchObject([
        {
          id,
          isDeleted: sqliteTrue,
          tokens: [
            {
              fioPluginId: id,
              token: "fio-token-1",
              isDeleted: sqliteFalse,
            },
          ],
        },
      ])
    await expect(run(loadFioPlugin(id))).resolves.toMatchObject({
      ok: false,
      error: {
        type: "FioPluginNotFound",
        id,
      },
    })
    await expect(
      run(
        saveFioPlugin({
          accountId,
          numberOfSecondsBetweenChecks: PositiveInteger(900),
          isActive: sqliteTrue,
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: id,
    })
  }, 15_000)

  test("soft deletes one FIO plugin token", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const idResult = await run(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await run.ok(
      addFioPluginToken({
        fioPluginId: idResult.value,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    const id = idResult.value
    await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-2"),
      })
    )

    // Both tokens can share a `createdAt`, so pick by value, not position.
    const [plugin] = await evolu.loadQuery(fioPluginWithTokensByIdQuery(id))
    const tokenToDelete = plugin?.tokens.find(
      (token) => token.token === "fio-token-1"
    )
    expect(tokenToDelete).toBeDefined()
    if (!tokenToDelete) return

    await expect(run(deleteFioPluginToken(tokenToDelete.id))).resolves.toEqual({
      ok: true,
      value: tokenToDelete.id,
    })

    await expect
      .poll(() => evolu.loadQuery(fioPluginWithTokensByIdQuery(id)))
      .toMatchObject([
        {
          id,
          isDeleted: sqliteFalse,
          tokens: expect.arrayContaining([
            expect.objectContaining({
              token: "fio-token-1",
              isDeleted: sqliteTrue,
            }),
            expect.objectContaining({
              token: "fio-token-2",
              isDeleted: sqliteFalse,
            }),
          ]),
        },
      ])
  }, 15_000)

  test("updates, clears, and restores the deterministic sync pointer", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(deps)

    const id = await run.ok(
      saveFioPlugin({
        accountId,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      addFioPluginToken({
        fioPluginId: id,
        token: NonEmptyString255("fio-token-1"),
      })
    )

    await run.ok(
      updateFioPluginSyncPointer({
        id,
        lastSyncedDate: DateStringSchema.decode("2026-05-31"),
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginSyncPointerByIdQuery(id)))
      .toEqual([
        {
          id,
          lastSyncedDate: "2026-05-31",
          isDeleted: sqliteFalse,
        },
      ])

    await run.ok(
      updateFioPluginSyncPointer({
        id,
        lastSyncedDate: null,
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginSyncPointerByIdQuery(id)))
      .toEqual([
        {
          id,
          lastSyncedDate: "2026-05-31",
          isDeleted: sqliteTrue,
        },
      ])

    await run.ok(
      updateFioPluginSyncPointer({
        id,
        lastSyncedDate: DateStringSchema.decode("2026-06-01"),
      })
    )
    await expect
      .poll(() => evolu.loadQuery(fioPluginSyncPointerByIdQuery(id)))
      .toEqual([
        {
          id,
          lastSyncedDate: "2026-06-01",
          isDeleted: sqliteFalse,
        },
      ])
  }, 15_000)
})
