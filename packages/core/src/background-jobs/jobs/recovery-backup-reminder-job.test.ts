import { testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { FetchDep } from "../../deps.ts"
import {
  createDefaultEvoluTransportUrls,
  createOrSelectAccount,
  snoozeBackupReminder,
} from "../../evolu/device-account.ts"
import {
  completeOnboarding,
  markRecoveryPhraseVerified,
} from "../../modules/app-settings/app-settings-actions.ts"
import {
  defaultPaymentMethod,
  defaultPaymentMethodOrder,
} from "../../modules/app-settings/app-settings-utils.ts"
import {
  createPayment,
  markPaymentPaidCash,
} from "../../modules/payment/payment-actions.ts"
import { createPaymentAccounts } from "../../modules/payment/payment-test-fixtures.ts"
import { MasterKey } from "../../modules/shared/key-derivation.ts"
import { NonNegativeInteger, TimestampMs } from "../../modules/shared/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { testDeviceAccountId } from "../../testing/background-jobs.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createTestDeviceEvolu } from "../../testing/device-evolu.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createNotificationStore } from "../notifications.ts"
import { startRecoveryBackupReminderJob } from "./recovery-backup-reminder-job.ts"

const day = 24 * 60 * 60 * 1000
const backup = { type: "recoveryPhraseBackup" } as const

const setup = async () => {
  await using disposer = new AsyncDisposableStack()
  const testEvolu = disposer.use(await createEvoluTest())
  const device = disposer.use(await createTestDeviceEvolu())
  const { evolu } = testEvolu
  const { deviceEvolu } = device
  const clock = createTestDateDep()
  const store = createNotificationStore()
  const errors: unknown[] = []

  const { accountId } = await createOrSelectAccount(
    deviceEvolu,
    MasterKey("000102030405060708090a0b0c0d0e0f"),
    { defaultTransports: createDefaultEvoluTransportUrls("relay.example") }
  )
  expect(accountId).toBe(testDeviceAccountId)

  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    deviceEvolu,
    deviceAccountId: accountId,
    notifications: store.notifications,
    fetch: (() => {
      throw new Error("The reminder job fetches nothing.")
    }) as unknown as FetchDep["fetch"],
    lockManager: createInProcessLockManager(),
    console: testCreateConsole(),
    onError: (error: unknown) => {
      errors.push(error)
    },
  }
  const run = disposer.use(testCreateRun(deps))
  await run.orThrow(
    completeOnboarding({
      fiatCurrency: "CZK",
      defaultPaymentMethod,
      paymentMethodOrderJson: JSON.stringify(defaultPaymentMethodOrder),
    })
  )
  const { cashRegisterAccountId } = await createPaymentAccounts(deps)

  const startJob = async () => {
    const jobRun = testCreateRun(deps)
    const job = await jobRun.ok(startRecoveryBackupReminderJob)
    return {
      [Symbol.asyncDispose]: async () => {
        await job[Symbol.asyncDispose]()
        await jobRun[Symbol.asyncDispose]()
      },
    }
  }

  const pay = async () => {
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    await run.orThrow(
      markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId })
    )
  }

  const snooze = (untilMs: number) => {
    snoozeBackupReminder(deviceEvolu, accountId, TimestampMs(untilMs))
  }

  const verify = async () => {
    await run.ok(markRecoveryPhraseVerified())
  }

  const disposables = disposer.move()
  return {
    verify,
    clock,
    store,
    errors,
    startJob,
    pay,
    snooze,
    [Symbol.asyncDispose]: () => disposables.disposeAsync(),
  }
}

/** Long enough for the job to have reacted to a write, were it going to. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 200))

describe("recovery backup reminder job", () => {
  test("raises nothing before the first paid payment", async () => {
    await using test = await setup()
    await using _job = await test.startJob()

    await settle()
    expect(test.store.getSnapshot()).toEqual([])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("raises the notification once a payment is paid", async () => {
    await using test = await setup()
    await using _job = await test.startJob()

    await test.pay()

    await expect.poll(() => test.store.getSnapshot()).toEqual([backup])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("drops it while snoozed and raises it again once the snooze runs out", async () => {
    await using test = await setup()
    await test.pay()
    await using _job = await test.startJob()
    await expect.poll(() => test.store.getSnapshot()).toEqual([backup])

    // A short real delay, so the job's timer fires within the test.
    const now = test.clock.date.now().getTime()
    test.snooze(now + 50)
    await expect.poll(() => test.store.getSnapshot()).toEqual([])

    // The timer fires on schedule, but only a clock past the snooze ends it.
    await settle()
    expect(test.store.getSnapshot()).toEqual([])

    test.clock.advance(7 * day)
    await expect.poll(() => test.store.getSnapshot()).toEqual([backup])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("drops it once the phrase is verified", async () => {
    await using test = await setup()
    await test.pay()
    await using _job = await test.startJob()
    await expect.poll(() => test.store.getSnapshot()).toEqual([backup])

    await test.verify()

    await expect.poll(() => test.store.getSnapshot()).toEqual([])
    expect(test.errors).toEqual([])
  }, 15_000)

  test("disposing the job drops its notification", async () => {
    await using test = await setup()
    await test.pay()
    const job = await test.startJob()
    await expect.poll(() => test.store.getSnapshot()).toEqual([backup])

    await job[Symbol.asyncDispose]()

    expect(test.store.getSnapshot()).toEqual([])
  }, 15_000)
})
