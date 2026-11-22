import { createIdFromString, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { createAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { SparkSecret } from "../shared/key-derivation.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  TimestampMs,
} from "../shared/schema.ts"
import { checkPendingWithdrawals } from "./withdraw-check-actions.ts"
import type { WithdrawalId } from "./withdraw-types.ts"
import type { PendingWithdrawalTransfer } from "./withdraw-utils.ts"

const thisDevice = createIdFromString<"Device">("this-device")
const otherDevice = createIdFromString<"Device">("other-device")
const cliDevice = createIdFromString<"Device">("cli-device")
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

const failuresQuery = createQuery((db) =>
  db
    .selectFrom("withdrawal")
    .select([
      "withdrawal.id",
      "withdrawal.failedAt",
      "withdrawal.failureReason",
    ])
    .orderBy("withdrawal.id")
)

const setUp = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  await using run = testCreateRun(evoluTestDeps(evolu))
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark wallet"),
      spark: { secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc") },
    })
  )
  return { testEvolu, evolu, accountId }
}

/** Records a Lightning withdrawal and returns it with the `createdAt` Evolu stamped. */
const recordWithdrawal = async (
  evolu: EvoluDep["evolu"],
  accountId: AccountId,
  {
    deviceId,
    sparkTransferId = crypto.randomUUID(),
    failedAt = null,
  }: {
    readonly deviceId: DeviceId | null
    readonly sparkTransferId?: string
    readonly failedAt?: TimestampMs | null
  }
) => {
  const id = createRowId<"Withdrawal">()
  const accountTransactionId = createIdFromString<"AccountTransaction">(
    `accountTransaction:spark:${sparkTransferId}`
  )
  await runMutationWithCompletion((options) => {
    const mutationOptions = { ...options, owner: evolu.appOwner }
    evolu.upsert(
      "withdrawal",
      {
        id,
        accountId,
        deviceId,
        amountSats: PositiveInteger(1000),
        accountTransactionId,
        failedAt,
        failureReason: failedAt === null ? null : "manual",
      },
      mutationOptions
    )
    evolu.upsert(
      "withdrawalLightning",
      {
        id,
        lightningAddress: null,
        lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
        sparkTransferId: NonEmptyStringSchema.decode(sparkTransferId),
        maxFeeSats: NonNegativeInteger(13),
      },
      mutationOptions
    )
  })
  const [row] = await evolu.loadQuery(
    createQuery((db) =>
      db
        .selectFrom("withdrawal")
        .select(["withdrawal.createdAt"])
        .where("withdrawal.id", "=", id)
    )
  )
  if (!row?.createdAt) throw new Error("withdrawal not recorded")
  return {
    id,
    sparkTransferId,
    accountTransactionId,
    createdAt: Date.parse(row.createdAt),
  }
}

const check = async ({
  evolu,
  accountId,
  deviceId,
  at,
  transfers = {},
  lockManager = createInProcessLockManager(),
}: {
  readonly evolu: EvoluDep["evolu"]
  readonly accountId: AccountId
  readonly deviceId: DeviceId
  readonly at: number
  readonly transfers?: Readonly<
    Record<string, PendingWithdrawalTransfer | Error>
  >
  readonly lockManager?: LockManager
}) => {
  const requested: string[] = []
  await using run = testCreateRun({
    ...evoluTestDeps(evolu),
    lockManager,
    ...createTestDateDep(new Date(at)),
  })
  const toRecord = await run.ok(
    checkPendingWithdrawals({
      accountId,
      deviceId,
      getTransfer: async (id) => {
        requested.push(id)
        const transfer = transfers[id]
        if (transfer instanceof Error) throw transfer
        return transfer
      },
    })
  )
  return { toRecord, requested }
}

const failureOf = async (evolu: EvoluDep["evolu"], id: WithdrawalId) =>
  (await evolu.loadQuery(failuresQuery)).find((row) => row.id === id)
    ?.failureReason ?? null

describe("checkPendingWithdrawals", () => {
  test("on the creating device, marks a missing transfer not-created after ten minutes, not before", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + 9 * minute,
    })
    expect(await failureOf(evolu, withdrawal.id)).toBeNull()

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + 10 * minute,
    })
    expect(await failureOf(evolu, withdrawal.id)).toBe("not-created")
  })

  test("does not mark a withdrawal this device is still sending", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })
    const lockManager = createInProcessLockManager()
    let release = () => {}
    const held = lockManager.request(
      `withdrawal-${withdrawal.id}`,
      () => new Promise<void>((resolve) => (release = resolve))
    )

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + day,
      lockManager,
    })
    release()
    await held

    expect(await failureOf(evolu, withdrawal.id)).toBeNull()
  })

  test.each([
    ["another device", otherDevice],
    ["the CLI's own device", cliDevice],
  ])(
    "seen from %s, marks a missing transfer not-created only after 24 hours",
    async (_label, deviceId) => {
      const { testEvolu, evolu, accountId } = await setUp()
      await using _ = testEvolu
      const withdrawal = await recordWithdrawal(evolu, accountId, {
        deviceId: thisDevice,
      })

      await check({
        evolu,
        accountId,
        deviceId,
        at: withdrawal.createdAt + 10 * minute,
      })
      expect(await failureOf(evolu, withdrawal.id)).toBeNull()

      await check({
        evolu,
        accountId,
        deviceId,
        at: withdrawal.createdAt + day,
      })
      expect(await failureOf(evolu, withdrawal.id)).toBe("not-created")
    }
  )

  test("hands back a completed payment with a preimage to record", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })
    const transfer = {
      status: "TRANSFER_STATUS_COMPLETED",
      type: "PREIMAGE_SWAP",
      userRequest: { paymentPreimage: "aa" },
    }

    const { toRecord } = await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + minute,
      transfers: { [withdrawal.sparkTransferId]: transfer },
    })

    expect(toRecord).toEqual([transfer])
    expect(await failureOf(evolu, withdrawal.id)).toBeNull()
  })

  test("marks a final Lightning failure returned", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + minute,
      transfers: {
        [withdrawal.sparkTransferId]: {
          status: "TRANSFER_STATUS_RETURNED",
          type: "PREIMAGE_SWAP",
          userRequest: { status: "LIGHTNING_PAYMENT_FAILED" },
        },
      },
    })

    expect(await failureOf(evolu, withdrawal.id)).toBe("returned")
  })

  test("leaves an unknown user request status alone", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + day,
      transfers: {
        [withdrawal.sparkTransferId]: {
          status: "TRANSFER_STATUS_SENDER_KEY_TWEAKED",
          type: "PREIMAGE_SWAP",
          userRequest: { status: "FUTURE_VALUE" },
        },
      },
    })

    expect(await failureOf(evolu, withdrawal.id)).toBeNull()
  })

  test("checks a withdrawal 15 days old, but not one 17 days old", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const withdrawal = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })

    const fresh = await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + 15 * day,
      transfers: {
        [withdrawal.sparkTransferId]: {
          status: "TRANSFER_STATUS_SENDER_KEY_TWEAKED",
          type: "PREIMAGE_SWAP",
          userRequest: { status: "PENDING" },
        },
      },
    })
    expect(fresh.requested).toEqual([withdrawal.sparkTransferId])

    const old = await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: withdrawal.createdAt + 17 * day,
    })
    expect(old.requested).toEqual([])
    expect(await failureOf(evolu, withdrawal.id)).toBeNull()
  })

  test("skips withdrawals that already have a movement or a failure", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const done = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })
    await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
      failedAt: TimestampMs(1),
    })
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    })
    await run.ok(
      createAccountTransaction({
        id: done.accountTransactionId,
        accountId,
        amount: Integer(-1013),
        currency: "BTC",
        occurredAt: TimestampMs(done.createdAt),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
      })
    )

    const { requested } = await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: done.createdAt + day,
    })

    expect(requested).toEqual([])
  })

  test("keeps checking the others when one withdrawal's lookup fails", async () => {
    const { testEvolu, evolu, accountId } = await setUp()
    await using _ = testEvolu
    const first = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })
    const second = await recordWithdrawal(evolu, accountId, {
      deviceId: thisDevice,
    })

    await check({
      evolu,
      accountId,
      deviceId: thisDevice,
      at: Math.max(first.createdAt, second.createdAt) + minute,
      transfers: {
        [first.sparkTransferId]: new Error("network down"),
        [second.sparkTransferId]: {
          status: "TRANSFER_STATUS_RETURNED",
          type: "PREIMAGE_SWAP",
          userRequest: { status: "USER_SWAP_RETURNED" },
        },
      },
    })

    expect(await failureOf(evolu, first.id)).toBeNull()
    expect(await failureOf(evolu, second.id)).toBe("returned")
  })
})
