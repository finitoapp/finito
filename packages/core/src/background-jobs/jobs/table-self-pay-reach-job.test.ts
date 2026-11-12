import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { FetchDep } from "../../deps.ts"
import { deleteAccount } from "../../modules/account/account-actions.ts"
import { saveFioPlugin } from "../../modules/fio-plugin/fio-plugin-actions.ts"
import { deriveTableSelfPayKeys } from "../../modules/shared/key-derivation.ts"
import { PositiveInteger, WssUrl } from "../../modules/shared/schema.ts"
import { updateTable } from "../../modules/table/table-actions.ts"
import { saveSelfPayViewPublishResult } from "../../modules/table-self-pay/table-self-pay-actions.ts"
import {
  createSelfPayTestContext,
  type SelfPayTestContext,
  selfPayTestRoot,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import { deriveSelfPayViewTag } from "../../modules/table-self-pay/table-self-pay-view-utils.ts"
import { createNotificationStore } from "../notifications.ts"
import { startTableSelfPayReachJob } from "./table-self-pay-reach-job.ts"

const guestsCannotPay = { type: "guestsCannotPay" } as const
const tableBillsUnseen = { type: "tableBillsUnseen" } as const
const relay = WssUrl("wss://relay.test")

const startJob = async (context: SelfPayTestContext) => {
  const store = createNotificationStore()
  const errors: unknown[] = []
  const run = testCreateRun({
    ...context.deps,
    notifications: store.notifications,
    fetch: (() => {
      throw new Error("The reach job fetches nothing.")
    }) as unknown as FetchDep["fetch"],
    onError: (error: unknown) => {
      errors.push(error)
    },
  })
  const job = await run.ok(startTableSelfPayReachJob)
  return {
    store,
    errors,
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
    },
  }
}

const syncBankAccount = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  await run.ok(
    saveFioPlugin({
      accountId: context.ibanAccountId,
      numberOfSecondsBetweenChecks: PositiveInteger(60),
      isActive: sqliteTrue,
    })
  )
}

const publishTable = async (
  context: SelfPayTestContext,
  {
    version,
    accepted,
  }: { readonly version: number; readonly accepted: boolean }
) => {
  await using run = testCreateRun(context.deps)
  await run.ok(
    saveSelfPayViewPublishResult({
      tag: deriveSelfPayViewTag(
        deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).viewKey
      ),
      createdAt: 1_780_000_000 + version,
      version,
      content: `view ${version}`,
      relays: [{ url: relay, accepted }],
    })
  )
}

describe("table self-pay reach job", () => {
  test("says guests cannot pay while a table with its QR code on has no payment method", async () => {
    await using context = await createSelfPayTestContext()
    await using job = await startJob(context)
    await using run = testCreateRun(context.deps)

    await expect.poll(() => job.store.getSnapshot()).toEqual([])

    await run.ok(deleteAccount(context.sparkAccountId))
    await expect.poll(() => job.store.getSnapshot()).toEqual([guestsCannotPay])

    await run.ok(updateTable({ id: context.tableId, selfPayEnabled: 0 }))
    await expect.poll(() => job.store.getSnapshot()).toEqual([])

    await run.ok(updateTable({ id: context.tableId, selfPayEnabled: 1 }))
    await expect.poll(() => job.store.getSnapshot()).toEqual([guestsCannotPay])

    await syncBankAccount(context)
    await expect.poll(() => job.store.getSnapshot()).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("says guests cannot see the bills while every relay refused a table's last publish", async () => {
    await using context = await createSelfPayTestContext()
    await using job = await startJob(context)

    await publishTable(context, { version: 1, accepted: true })
    await expect.poll(() => job.store.getSnapshot()).toEqual([])

    await publishTable(context, { version: 2, accepted: false })
    await expect.poll(() => job.store.getSnapshot()).toEqual([tableBillsUnseen])

    await publishTable(context, { version: 3, accepted: true })
    await expect.poll(() => job.store.getSnapshot()).toEqual([])
    expect(job.errors).toEqual([])
  })

  test("disposing the job drops its notifications", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(deleteAccount(context.sparkAccountId))
    const job = await startJob(context)
    await expect.poll(() => job.store.getSnapshot()).toEqual([guestsCannotPay])

    await job[Symbol.asyncDispose]()

    expect(job.store.getSnapshot()).toEqual([])
  })
})
