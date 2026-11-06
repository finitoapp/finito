import { ok, type Task } from "@evolu/common"

import type { EvoluOwnerDep, LocalStorageDep } from "../deps.ts"
import type { DeviceEvoluDep, EvoluDep } from "../modules/shared/evolu-deps.ts"
import { accountDerivedIdMigration } from "./account-derived-id-migration.ts"
import { agoraEvoluRelayMigration } from "./agora-evolu-relay-migration.ts"
import { deviceAccountDerivedIdMigration } from "./device-account-derived-id-migration.ts"
import { deviceIdMigration } from "./device-id-migration.ts"
import { fioPluginFixedIdMigration } from "./fio-plugin-fixed-id-migration.ts"

/**
 * One data migration over the database its deps `D` open, and the two things
 * the runner needs from it. Two registries use it: `deviceMigrations` over
 * the device database, run before an account is chosen, and `appMigrations`
 * over the active account's app database, run once it is open.
 *
 * There is deliberately no table recording which migrations have run. In a
 * local-first database a "this already happened" flag is a claim about time,
 * and rows arrive by sync at an arbitrary later point: a device that wrote the
 * flag before its data synced would skip the migration forever, and one whose
 * flag has not synced yet would run it again for nothing. The only question
 * with a stable answer is `hasWork` — is there still data to migrate — so that
 * is the only one asked.
 *
 * Two consequences, both required of every entry here:
 *
 * - `hasWork` runs at every app start, forever, so it must be cheap. Prefer a
 *   dedicated `limit(1)` existence query over reusing the migration's own
 *   read, and keep the two agreeing on what counts as work — a `hasWork` that
 *   stays true after `run` finishes reopens the migration popup at every
 *   start.
 * - `run` must be re-runnable, not merely idempotent. Nothing records a
 *   partial run, so a crash halfway through simply leaves `hasWork` true and
 *   the next start does it again.
 */
export interface Migration<D> {
  readonly name: string
  readonly hasWork: Task<boolean, never, D>
  readonly run: Task<unknown, never, D>
}

export type AppMigration = Migration<EvoluDep & EvoluOwnerDep>

/**
 * A migration of the device database. The device database is not synced
 * today (`createDeviceEvolu`), so a "this ran" flag would hold there — but
 * the same `hasWork` contract applies anyway: one model for both registries,
 * and it stays right if device sync is ever turned on.
 */
export type DeviceMigration = Migration<DeviceEvoluDep & LocalStorageDep>

/**
 * Runs in this order; a later migration may depend on an earlier one.
 *
 */
export const appMigrations: ReadonlyArray<AppMigration> = [
  fioPluginFixedIdMigration,
  // After the Fio one: a legacy plugin it adopts can still point at the
  // legacy fiat bank account, and this is what re-points it.
  accountDerivedIdMigration,
]

/**
 * Run before the active account is read (`deviceMigrationsAtom`), so the
 * account and its app database always start from migrated device data. In
 * order, like `appMigrations`, and always before them.
 */
export const deviceMigrations: ReadonlyArray<DeviceMigration> = [
  deviceAccountDerivedIdMigration,
  deviceIdMigration,
  agoraEvoluRelayMigration,
]

/**
 * The migrations with something left to do. Separate from `runMigrations` so
 * the UI can find out whether there is any work *before* it opens a popup
 * about it — on the overwhelming majority of starts the answer is none, and
 * nothing should flash.
 */
export const loadPendingMigrations =
  <D>(
    migrations: ReadonlyArray<Migration<D>>
  ): Task<ReadonlyArray<Migration<D>>, never, D> =>
  async (run) => {
    const pending: Migration<D>[] = []

    for (const migration of migrations) {
      if (await run.ok(migration.hasWork)) pending.push(migration)
    }

    return ok(pending)
  }

/** Runs the given migrations in order, one after another. */
export const runMigrations =
  <D>(migrations: ReadonlyArray<Migration<D>>): Task<number, never, D> =>
  async (run) => {
    for (const migration of migrations) {
      await run.ok(migration.run)
    }

    return ok(migrations.length)
  }
