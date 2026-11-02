import { sqliteTrue, testCreateConsole, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import { MONETA_MAX_PAGES } from "../../integrations/moneta/moneta-client.ts"
import { saveFiatBankAccount } from "../../modules/account/account-actions.ts"
import {
  connectMonetaPlugin,
  saveMonetaPlugin,
  updateMonetaPluginSyncPointer,
} from "../../modules/moneta-plugin/moneta-plugin-actions.ts"
import { monetaPluginSyncPointerByPluginIdQuery } from "../../modules/moneta-plugin/moneta-plugin-queries.ts"
import { monetaPluginId } from "../../modules/moneta-plugin/moneta-plugin-utils.ts"
import { createPayment } from "../../modules/payment/payment-actions.ts"
import {
  DateStringSchema,
  IbanSchema,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  VariableSymbol,
} from "../../modules/shared/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  createMonetaAccountTransactionSyncJob,
  getMonetaRetryBackoffMs,
} from "./moneta-account-transaction-sync-job.ts"

const iban = IbanSchema.decode("CZ3806000000002123456789")

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const incoming = {
  entryReference: "E-1",
  amount: { value: 199.5, currency: "CZK" },
  creditDebitIndicator: "CRDT",
  status: "BOOK",
  bookingDate: { date: "2026-05-30" },
  entryDetails: {
    transactionDetails: {
      remittanceInformation: {
        structured: { creditorReferenceInformation: { reference: "VS:42" } },
      },
    },
  },
}

const claimsQuery = createQuery((db) =>
  db
    .selectFrom("reconciliationClaim")
    .select(["paymentId"])
    .where("isDeleted", "is not", sqliteTrue)
)

/**
 * A connected plugin and a running job over a bank whose transaction answer
 * the test can change. `token` is what each transaction request carried.
 */
const setUp = async ({
  intervalSeconds = 60,
}: {
  readonly intervalSeconds?: number
} = {}) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const run = testCreateRun({ ...evoluTestDeps(evolu), ...createTestDateDep() })
  const transactionRequests: Array<{
    readonly url: URL
    readonly token: string | null
  }> = []
  const errors: unknown[] = []
  const console = testCreateConsole()
  let answerTransactions = (): Response =>
    jsonResponse({ pageCount: 1, transactions: [incoming] })
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (!url.pathname.endsWith("/transactions")) {
      return jsonResponse({
        accounts: [{ id: "bank-account-1", identification: { iban } }],
      })
    }
    const headers = new Headers(init?.headers)
    transactionRequests.push({ url, token: headers.get("Authorization") })
    return answerTransactions()
  }

  const accountId = await run.ok(
    saveFiatBankAccount({ enabled: true, iban, currency: "CZK" })
  )
  if (accountId === null) throw new Error("No fiat bank account was saved.")
  const connectRun = testCreateRun({ ...evoluTestDeps(evolu), fetch })
  await connectRun.orThrow(
    connectMonetaPlugin({
      accountId,
      iban,
      token: NonEmptyStringSchema.decode("token-1"),
    })
  )
  await run.ok(
    saveMonetaPlugin({
      numberOfSecondsBetweenChecks: PositiveInteger(intervalSeconds),
    })
  )

  const jobRun = testCreateRun({
    console,
    ...evoluTestDeps(evolu),
    lockManager: createInProcessLockManager(),
    onError: (error: unknown) => {
      errors.push(error)
    },
    fetch,
    ...createTestDateDep(new Date("2026-05-31T10:00:00.000Z")),
  })

  return {
    evolu,
    run,
    connectRun,
    accountId,
    console,
    errors,
    transactionRequests,
    answerTransactionsWith: (answer: () => Response) => {
      answerTransactions = answer
    },
    startJob: () => jobRun.ok(createMonetaAccountTransactionSyncJob()),
    [Symbol.asyncDispose]: async () => {
      await jobRun[Symbol.asyncDispose]()
      await connectRun[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("moneta account transaction sync job", () => {
  test("syncs two months back on its first run, pays the payment and saves the pointer", async () => {
    await using context = await setUp()
    const paymentId = await context.run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: context.accountId,
          variableSymbol: VariableSymbol("42"),
          specificSymbol: null,
        },
      })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.evolu.loadQuery(claimsQuery))
      .toEqual([{ paymentId }])
    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const [request] = context.transactionRequests
    expect(request?.token).toBe("Bearer token-1")
    expect(request?.url.searchParams.get("fromDate")?.slice(0, 7)).toBe(
      "2026-03"
    )
    expect(context.errors).toEqual([])
  })

  test("starts the next sync on the pointer's day, not before it", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-20"),
      })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.transactionRequests.length)
      .toBeGreaterThanOrEqual(1)
    expect(
      context.transactionRequests[0]?.url.searchParams
        .get("fromDate")
        ?.slice(0, 10)
    ).toBe("2026-05-20")
  })

  test("reads a long gap a week at a time, saving the pointer after each week", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-11"),
      })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const windows = context.transactionRequests
      .slice(0, 3)
      .map(({ url }) => [
        url.searchParams.get("fromDate")?.slice(0, 10),
        url.searchParams.get("toDate")?.slice(0, 10),
      ])
    expect(windows).toEqual([
      ["2026-05-11", "2026-05-17"],
      ["2026-05-18", "2026-05-24"],
      ["2026-05-25", "2026-05-31"],
    ])
  })

  test("reads a too-busy week a day at a time to its end, then a week again", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-11"),
      })
    )
    context.answerTransactionsWith(() => {
      const params = context.transactionRequests.at(-1)?.url.searchParams
      return params?.get("fromDate") === "2026-05-11" &&
        params.get("toDate") !== "2026-05-11"
        ? jsonResponse({ pageCount: 1000, transactions: [] })
        : jsonResponse({ pageCount: 1, transactions: [incoming] })
    })

    await using _job = await context.startJob()

    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const windows = context.transactionRequests
      .filter(({ url }) => url.searchParams.get("page") === "0")
      .map(
        ({ url }) =>
          `${url.searchParams.get("fromDate")?.slice(0, 10)}..${url.searchParams.get("toDate")?.slice(0, 10)}`
      )
    expect(windows).toEqual([
      "2026-05-11..2026-05-17",
      "2026-05-11..2026-05-11",
      "2026-05-12..2026-05-12",
      "2026-05-13..2026-05-13",
      "2026-05-14..2026-05-14",
      "2026-05-15..2026-05-15",
      "2026-05-16..2026-05-16",
      "2026-05-17..2026-05-17",
      "2026-05-18..2026-05-24",
      "2026-05-25..2026-05-31",
    ])
    expect(context.errors).toEqual([])
  })

  test("reads a window the bank lists too many pages for a day at a time", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-29"),
      })
    )
    context.answerTransactionsWith(() => {
      const params = context.transactionRequests.at(-1)?.url.searchParams
      return params?.get("fromDate") !== params?.get("toDate")
        ? jsonResponse({ pageCount: 1000, transactions: [] })
        : jsonResponse({ pageCount: 1, transactions: [incoming] })
    })

    await using _job = await context.startJob()

    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const windows = [
      ...new Set(
        context.transactionRequests.map(
          ({ url }) =>
            `${url.searchParams.get("fromDate")?.slice(0, 10)}..${url.searchParams.get("toDate")?.slice(0, 10)}`
        )
      ),
    ]
    expect(windows).toEqual([
      "2026-05-29..2026-05-31",
      "2026-05-29..2026-05-29",
      "2026-05-30..2026-05-30",
      "2026-05-31..2026-05-31",
    ])
    expect(context.errors).toEqual([])
  })

  test("passes a day that lists more pages than one sync reads, and logs it", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-29"),
      })
    )
    context.answerTransactionsWith(() =>
      jsonResponse({ pageCount: 1000, transactions: [] })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const skipped = context.console
      .getEntriesSnapshot()
      .filter(
        ({ method, args }) =>
          method === "error" &&
          args[0] ===
            "Skipped MONETA transactions the bank listed beyond the pages one sync reads."
      )
    expect(skipped).toHaveLength(3)
    expect(context.errors).toEqual([])
  })

  test("asks no narrower window that would end where the truncated one did", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-31"),
      })
    )
    context.answerTransactionsWith(() =>
      jsonResponse({ pageCount: 1000, transactions: [] })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.console.getEntriesSnapshot())
      .toContainEqual(
        expect.objectContaining({
          method: "error",
          args: [
            "Skipped MONETA transactions the bank listed beyond the pages one sync reads.",
            expect.anything(),
          ],
        })
      )
    expect(context.transactionRequests).toHaveLength(MONETA_MAX_PAGES)
  })

  test("starts no further back than the bank reads without strong authentication", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2020-01-01"),
      })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.transactionRequests.length)
      .toBeGreaterThanOrEqual(1)
    expect(
      context.transactionRequests[0]?.url.searchParams
        .get("fromDate")
        ?.slice(0, 10)
    ).toBe("2024-06-01")
  })

  test("starts a pointer set in the future today", async () => {
    await using context = await setUp()
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2027-01-01"),
      })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() =>
        context.evolu.loadQuery(
          monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
        )
      )
      .toMatchObject([{ lastSyncedDate: "2026-05-31" }])
    const [request] = context.transactionRequests
    expect(request?.url.searchParams.get("fromDate")?.slice(0, 10)).toBe(
      "2026-05-31"
    )
    expect(context.errors).toEqual([])
  })

  test("logs an exceeded daily limit without reporting a job error", async () => {
    await using context = await setUp()
    context.answerTransactionsWith(
      () => new Response("Too many requests", { status: 429 })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.console.getEntriesSnapshot())
      .toContainEqual({
        method: "error",
        path: ["moneta-account-transaction-sync-job"],
        args: [
          "Skipped MONETA sync because the daily limit was exceeded.",
          { pluginId: monetaPluginId, responseBody: "Too many requests" },
        ],
      })
    expect(context.errors).toEqual([])
  })

  test("stops asking the bank once it refuses the token, until a new one is connected", async () => {
    await using context = await setUp({ intervalSeconds: 1 })
    context.answerTransactionsWith(() =>
      jsonResponse({ errors: [{ error: "UNAUTHORISED" }] }, 401)
    )

    await using _job = await context.startJob()

    await expect.poll(() => context.transactionRequests.length).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    expect(context.transactionRequests).toHaveLength(1)
    expect(context.errors).toEqual([])

    context.answerTransactionsWith(() =>
      jsonResponse({ pageCount: 1, transactions: [] })
    )
    await context.connectRun.orThrow(
      connectMonetaPlugin({
        accountId: context.accountId,
        iban,
        token: NonEmptyStringSchema.decode("token-2"),
      })
    )

    await expect
      .poll(() => context.transactionRequests.at(-1)?.token, { timeout: 3_000 })
      .toBe("Bearer token-2")
  }, 15_000)

  test("reports an unexpected failure and backs off before the next try", async () => {
    await using context = await setUp({ intervalSeconds: 1 })
    context.answerTransactionsWith(
      () => new Response("Internal error", { status: 500 })
    )

    await using _job = await context.startJob()

    await expect
      .poll(() => context.errors)
      .toMatchObject([{ type: "MonetaHttpError", status: 500 }])
    // The test clock stands still, so the backoff never runs out.
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    expect(context.transactionRequests).toHaveLength(1)
  }, 15_000)

  test("doubles retries up to 15 minutes", () => {
    expect(getMonetaRetryBackoffMs(300, 1)).toBe(300_000)
    expect(getMonetaRetryBackoffMs(300, 2)).toBe(600_000)
    expect(getMonetaRetryBackoffMs(300, 3)).toBe(900_000)
    expect(getMonetaRetryBackoffMs(300, 10)).toBe(900_000)
  })
})
