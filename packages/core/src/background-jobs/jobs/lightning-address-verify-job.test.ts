import { testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { ConnectivityDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import {
  invoiceTimestamp,
  prepareLightningAddressPayment,
  setupLightningAddressPayment,
  verifyUrl,
} from "../../modules/payment/payment-lightning-address-test-fixtures.ts"
import { createRowId } from "../../modules/shared/evolu-utils.ts"
import { testPreimage } from "../../modules/shared/lightning-invoice-test-fixtures.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { testSyncedAppOwner } from "../../testing/app-owner-sync.ts"
import {
  createTestDeviceAccountDep,
  testNotificationsDep,
} from "../../testing/background-jobs.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import {
  createLightningAddressVerifyJob,
  getLightningAddressVerifyDelayMs,
} from "./lightning-address-verify-job.ts"

const lightningTransactionsQuery = createQuery((db) =>
  db
    .selectFrom("accountTransaction")
    .select(["accountTransaction.kind", "accountTransaction.amount"])
    .where("accountTransaction.kind", "=", "lightningAddress")
)

const createConnectivity = (): ConnectivityDep & {
  readonly goOnline: () => void
} => {
  const listeners = new Set<() => void>()
  return {
    connectivity: {
      onOnline: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    goOnline: () => {
      for (const listener of listeners) listener()
    },
  }
}

const setup = async () => {
  const s = await setupLightningAddressPayment()
  await prepareLightningAddressPayment(s)
  const connectivity = createConnectivity()
  const errors: unknown[] = []

  const startJob = async (options: {
    readonly retryBaseDelayMs: number
    readonly giveUpAfterMs?: number
  }) => {
    const device = await createTestDeviceAccountDep()
    const jobDeps: AppBackgroundJobContext = {
      ...device.deviceAccount,
      ...s.deps,
      ...createEetApiDep(s.deps),
      ...createQerkoApiDep({ posId: "pos" }),
      ...createQerkoSocketDep(),
      ...createQerkoConnectionStatusDep(),
      ...connectivity,
      tableSelfPayRoot: new Uint8Array(32),
      selfPayDefaultRelays: [],
      nostrRelayClient: createNostrRelayClient(),
      ...testSyncedAppOwner,
      deviceId: createRowId<"Device">(),
      lockManager: createInProcessLockManager(),
      ...testNotificationsDep(),
      console: testCreateConsole(),
      onError: (error) => {
        errors.push(error)
      },
    }
    const jobRun = testCreateRun(jobDeps)
    const job = await jobRun.ok(createLightningAddressVerifyJob(options))
    return {
      [Symbol.asyncDispose]: async () => {
        await job[Symbol.asyncDispose]()
        await jobRun[Symbol.asyncDispose]()
        await device[Symbol.asyncDispose]()
      },
    }
  }

  const verifyPolls = () =>
    s.wallet.requests.filter((url) => url === verifyUrl).length

  return {
    ...s,
    connectivity,
    errors,
    startJob,
    verifyPolls,
    [Symbol.asyncDispose]: () => s.testEvolu[Symbol.asyncDispose](),
  }
}

describe("getLightningAddressVerifyDelayMs", () => {
  test("doubles from two seconds up to a minute", () => {
    expect(
      [0, 1, 2, 3, 4, 5, 10].map((polls) =>
        getLightningAddressVerifyDelayMs(polls)
      )
    ).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000])
  })
})

describe("lightning address verify job", () => {
  test("settles a payment nobody is watching once the wallet proves it paid", async () => {
    await using test = await setup()
    await using _job = await test.startJob({ retryBaseDelayMs: 5 })

    await expect.poll(test.verifyPolls).toBeGreaterThanOrEqual(2)
    await expect(
      test.deps.evolu.loadQuery(lightningTransactionsQuery)
    ).resolves.toEqual([])

    test.wallet.settled = true
    test.wallet.preimage = testPreimage
    await expect
      .poll(() => test.deps.evolu.loadQuery(lightningTransactionsQuery))
      .toEqual([{ kind: "lightningAddress", amount: 8_600 }])
    expect(test.errors).toEqual([])

    // Settled, so the invoice leaves the job's watch.
    const polls = test.verifyPolls()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(test.verifyPolls()).toBe(polls)
  }, 15_000)

  test("keeps polling a wallet that says paid without a preimage", async () => {
    await using test = await setup()
    test.wallet.settled = true
    await using _job = await test.startJob({ retryBaseDelayMs: 5 })

    await expect.poll(test.verifyPolls).toBeGreaterThanOrEqual(3)
    await expect(
      test.deps.evolu.loadQuery(lightningTransactionsQuery)
    ).resolves.toEqual([])
  }, 15_000)

  test("polls at once when the device comes back online", async () => {
    await using test = await setup()
    // A first poll a minute away: only coming online can fetch the answer.
    await using _job = await test.startJob({ retryBaseDelayMs: 60_000 })
    test.wallet.settled = true
    test.wallet.preimage = testPreimage

    await expect
      .poll(async () => {
        test.connectivity.goOnline()
        return (await test.deps.evolu.loadQuery(lightningTransactionsQuery))
          .length
      })
      .toBe(1)
  }, 15_000)

  test("gives up a day after the invoice expired", async () => {
    await using test = await setup()
    test.clock.now = new Date((invoiceTimestamp + 600) * 1000 + 86_400_000)
    test.wallet.settled = true
    test.wallet.preimage = testPreimage
    await using _job = await test.startJob({ retryBaseDelayMs: 5 })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(test.verifyPolls()).toBe(0)
  }, 15_000)
})
