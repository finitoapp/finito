import {
  sqliteFalse,
  sqliteTrue,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveFiatBankAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { loadBillStatus } from "../bill/bill-guards.ts"
import { createPayment } from "../payment/payment-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { activeClaimedTransactionsByPaymentIdQuery } from "../reconciliation-claim/reconciliation-claim-queries.ts"
import { calculatePaymentExcess } from "../shared/claimed-amount.ts"
import {
  DateStringSchema,
  IbanSchema,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  VariableSymbol,
} from "../shared/schema.ts"
import { formatSelfPayBankMessage } from "../table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  selectSelfPayTestShare,
  selfPayPointersByBillIdQuery,
} from "../table-self-pay/table-self-pay-test-fixtures.ts"
import {
  connectMonetaPlugin,
  disconnectMonetaPlugin,
  saveMonetaPlugin,
  syncMonetaTransactions,
  updateMonetaPluginSyncPointer,
} from "./moneta-plugin-actions.ts"
import {
  activeMonetaPluginsQuery,
  monetaPluginByIdQuery,
  monetaPluginSyncPointerByPluginIdQuery,
} from "./moneta-plugin-queries.ts"
import { monetaPluginId } from "./moneta-plugin-utils.ts"

const iban = IbanSchema.decode("CZ3806000000002123456789")
const otherIban = IbanSchema.decode("CZ6508000000192000145399")
const token = NonEmptyStringSchema.decode("moneta-token")

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const accountsResponse = (accountIban: string = iban) =>
  jsonResponse({
    accounts: [{ id: "bank-account-1", identification: { iban: accountIban } }],
  })

const transaction = (overrides: Record<string, unknown> = {}) => ({
  entryReference: "E-1",
  amount: { value: "199,50", currency: "CZK" },
  creditDebitIndicator: "CRDT",
  reversalIndicator: false,
  status: "BOOK",
  bookingDate: { date: "2026-05-26" },
  entryDetails: {
    transactionDetails: {
      relatedParties: { debtor: { name: "Customer Ltd." } },
      remittanceInformation: {
        structured: {
          creditorReferenceInformation: { reference: "VS:000123456" },
        },
      },
    },
  },
  ...overrides,
})

/** A bank that answers the account list and then the given transactions. */
const fakeBank = (
  transactions: () => ReadonlyArray<unknown>,
  accountIban: string = iban
) => {
  const requests: URL[] = []
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push(url)
    return url.pathname.endsWith("/transactions")
      ? jsonResponse({ pageCount: 1, transactions: transactions() })
      : accountsResponse(accountIban)
  }

  return { fetch, requests }
}

const accountTransactionsQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin(
        "accountTransactionIban",
        "accountTransactionIban.id",
        "accountTransaction.id"
      )
      .select([
        "accountTransaction.id",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.note",
        "accountTransactionIban.variableSymbol",
        "accountTransactionIban.bankReference",
      ])
      .where("accountTransaction.accountId", "=", accountId)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
  )

const claimsQuery = createQuery((db) =>
  db
    .selectFrom("reconciliationClaim")
    .select(["id", "paymentId", "accountTransactionId"])
    .where("isDeleted", "is not", sqliteTrue)
)

const setUp = async (fetch: typeof globalThis.fetch) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const deps = {
    ...evoluTestDeps(evolu),
    ...createTestDateDep(new Date("2026-05-26T10:00:00.000Z")),
    console: testCreateConsole(),
    lockManager: createInProcessLockManager(),
    fetch,
  }
  const run = testCreateRun(deps)
  const accountId = await run.ok(
    saveFiatBankAccount({ enabled: true, iban, currency: "CZK" })
  )
  if (accountId === null) throw new Error("No fiat bank account was saved.")

  return {
    evolu,
    deps,
    run,
    accountId,
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

const createIbanPayment = async (
  context: Awaited<ReturnType<typeof setUp>>,
  amount = 19_950
) =>
  await context.run.orThrow(
    createPayment({
      deviceId: null,
      billId: null,
      tableId: null,
      amount: NonNegativeInteger(amount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
      iban: {
        accountId: context.accountId,
        variableSymbol: VariableSymbol("123456"),
        specificSymbol: null,
      },
    })
  )

const paymentExcess = async (
  context: Awaited<ReturnType<typeof setUp>>,
  paymentId: PaymentId
) =>
  calculatePaymentExcess({
    claims: await context.evolu.loadQuery(
      activeClaimedTransactionsByPaymentIdQuery(paymentId)
    ),
    amount: NonNegativeInteger(19_950),
  })

const range = {
  fromDate: DateStringSchema.decode("2026-05-25"),
  toDate: DateStringSchema.decode("2026-05-26"),
}

describe("connectMonetaPlugin", () => {
  test("connects the token to the account the bank lists with its IBAN", async () => {
    const bank = fakeBank(() => [])
    await using context = await setUp(bank.fetch)

    await expect(
      context.run(
        connectMonetaPlugin({ accountId: context.accountId, iban, token })
      )
    ).resolves.toEqual({ ok: true, value: monetaPluginId })

    await expect
      .poll(() => context.evolu.loadQuery(activeMonetaPluginsQuery))
      .toMatchObject([
        {
          id: monetaPluginId,
          accountId: context.accountId,
          token,
          monetaAccountId: "bank-account-1",
          numberOfSecondsBetweenChecks: 300,
          iban,
          currency: "CZK",
        },
      ])
    expect(bank.requests.map((url) => url.pathname)).toEqual([
      "/api/v4/vip/aisp/my/accounts",
    ])
  })

  test("keeps the sync settings when a token is connected again", async () => {
    await using context = await setUp(fakeBank(() => []).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.ok(
      saveMonetaPlugin({
        numberOfSecondsBetweenChecks: PositiveInteger(900),
        isActive: sqliteFalse,
      })
    )

    await context.run.orThrow(
      connectMonetaPlugin({
        accountId: context.accountId,
        iban,
        token: NonEmptyStringSchema.decode("new-token"),
      })
    )

    await expect
      .poll(() =>
        context.evolu.loadQuery(monetaPluginByIdQuery(monetaPluginId))
      )
      .toMatchObject([
        {
          token: "new-token",
          numberOfSecondsBetweenChecks: 900,
          isActive: sqliteFalse,
        },
      ])
  })

  test("keeps the sync pointer for the same bank account and drops it for another", async () => {
    let bankAccountId = "bank-account-1"
    await using context = await setUp(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input)
      return url.pathname.endsWith("/transactions")
        ? jsonResponse({ transactions: [] })
        : jsonResponse({
            accounts: [{ id: bankAccountId, identification: { iban } }],
          })
    })
    const pointer = () =>
      context.evolu.loadQuery(
        monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
      )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-20"),
      })
    )

    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await expect(pointer()).resolves.toMatchObject([
      { lastSyncedDate: "2026-05-20" },
    ])

    bankAccountId = "bank-account-2"
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await expect(pointer()).resolves.toEqual([])
  })

  test("refuses a token the bank does not know", async () => {
    await using context = await setUp(async () =>
      jsonResponse({ errors: [{ error: "UNAUTHORISED" }] }, 401)
    )

    await expect(
      context.run(
        connectMonetaPlugin({ accountId: context.accountId, iban, token })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "MonetaUnauthorizedError", code: "UNAUTHORISED" },
    })
    await expect(
      context.evolu.loadQuery(monetaPluginByIdQuery(monetaPluginId))
    ).resolves.toEqual([])
  })

  test("refuses a token that sees another account", async () => {
    await using context = await setUp(async () => accountsResponse(otherIban))

    await expect(
      context.run(
        connectMonetaPlugin({ accountId: context.accountId, iban, token })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "MonetaAccountNotVisible",
        iban,
        visibleIbans: [otherIban],
      },
    })
  })

  test("reports a bank that does not answer", async () => {
    await using context = await setUp(async () => {
      throw new TypeError("Network request failed")
    })

    await expect(
      context.run(
        connectMonetaPlugin({ accountId: context.accountId, iban, token })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "FetchError" } })
  })
})

describe("disconnectMonetaPlugin", () => {
  test("clears the token and the sync pointer, so a later token starts afresh", async () => {
    await using context = await setUp(fakeBank(() => []).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.ok(
      updateMonetaPluginSyncPointer({
        lastSyncedDate: DateStringSchema.decode("2026-05-20"),
      })
    )

    await context.run.ok(disconnectMonetaPlugin())

    await expect(
      context.evolu.loadQuery(monetaPluginByIdQuery(monetaPluginId))
    ).resolves.toEqual([])
    await expect(
      context.evolu.loadQuery(
        monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
      )
    ).resolves.toEqual([])
  })
})

describe("syncMonetaTransactions", () => {
  test("records an incoming transfer and pays the payment its symbol and amount match", async () => {
    await using context = await setUp(fakeBank(() => [transaction()]).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)

    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual({
      ok: true,
      value: {
        downloadedCount: 1,
        recordedCount: 1,
        claimedPaymentIds: [paymentId],
        isTruncated: false,
        callCount: 1,
      },
    })

    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toMatchObject([
      {
        amount: 19_950,
        currency: "CZK",
        note: "Customer Ltd.",
        variableSymbol: "123456",
        bankReference: "E-1",
      },
    ])
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toMatchObject([
      { paymentId },
    ])
  })

  test("a pending transfer pays nothing until the bank books it", async () => {
    let listed = [
      transaction({ entryReference: "P-1", status: "PDNG", bookingDate: null }),
    ]
    await using context = await setUp(fakeBank(() => listed).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)

    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 0, claimedPaymentIds: [] },
    })

    // Booked under another reference than it was listed pending with.
    listed = [transaction({ entryReference: "B-1", status: "BOOK" })]
    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 1, claimedPaymentIds: [paymentId] },
    })
    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toMatchObject([{ bankReference: "B-1" }])
  })

  test("skips outgoing, reversed, foreign-currency and scheduled entries", async () => {
    await using context = await setUp(
      fakeBank(() => [
        transaction({ entryReference: "out", creditDebitIndicator: "DBIT" }),
        transaction({ entryReference: "rev", reversalIndicator: true }),
        transaction({
          entryReference: "eur",
          amount: { value: 199.5, currency: "EUR" },
        }),
        transaction({ entryReference: "futr", status: "FUTR" }),
        transaction({ entryReference: null }),
      ]).fetch
    )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await createIbanPayment(context)

    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual({
      ok: true,
      value: {
        downloadedCount: 5,
        recordedCount: 0,
        claimedPaymentIds: [],
        isTruncated: false,
        callCount: 1,
      },
    })
    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toEqual([])
  })

  test("a second sync of the same transfer records and claims nothing", async () => {
    await using context = await setUp(fakeBank(() => [transaction()]).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await createIbanPayment(context)
    await context.run.orThrow(syncMonetaTransactions(range))

    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { downloadedCount: 1, recordedCount: 0, claimedPaymentIds: [] },
    })
    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toHaveLength(1)
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toHaveLength(1)
  })

  test("pays a payment created after its transfer was recorded", async () => {
    await using context = await setUp(fakeBank(() => [transaction()]).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.orThrow(syncMonetaTransactions(range))
    const paymentId = await createIbanPayment(context)

    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 0, claimedPaymentIds: [paymentId] },
    })
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toMatchObject([
      { paymentId },
    ])
  })

  test("a second transfer quoting a paid payment's symbols claims it as overpaid", async () => {
    await using context = await setUp(
      fakeBank(() => [
        transaction({ entryReference: "E-1" }),
        transaction({ entryReference: "E-2" }),
      ]).fetch
    )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)

    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 2, claimedPaymentIds: [paymentId, paymentId] },
    })
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toHaveLength(2)
    expect(await paymentExcess(context, paymentId)).toBe(19_950)
  })

  test("a transfer synced after its payment was paid claims it as overpaid", async () => {
    let listed = [transaction({ entryReference: "E-1" })]
    await using context = await setUp(fakeBank(() => listed).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)
    await context.run.orThrow(syncMonetaTransactions(range))

    listed = [...listed, transaction({ entryReference: "E-2" })]
    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 1, claimedPaymentIds: [paymentId] },
    })
    expect(await paymentExcess(context, paymentId)).toBe(19_950)
  })

  test("two transfers recorded before their payment existed both claim it", async () => {
    await using context = await setUp(
      fakeBank(() => [
        transaction({ entryReference: "E-1" }),
        transaction({ entryReference: "E-2" }),
      ]).fetch
    )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.orThrow(syncMonetaTransactions(range))
    const paymentId = await createIbanPayment(context)

    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({
      ok: true,
      value: { recordedCount: 0, claimedPaymentIds: [paymentId, paymentId] },
    })
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toHaveLength(2)
  })

  test("a second transfer pays another unpaid payment with the same symbols before overpaying the first", async () => {
    await using context = await setUp(
      fakeBank(() => [
        transaction({ entryReference: "E-1" }),
        transaction({ entryReference: "E-2" }),
      ]).fetch
    )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const first = await createIbanPayment(context)
    const second = await createIbanPayment(context)

    const result = await context.run.orThrow(syncMonetaTransactions(range))

    expect([...result.claimedPaymentIds].sort()).toEqual([first, second].sort())
  })

  test("records a second equal transfer while the first is still listed", async () => {
    let listed = [transaction({ entryReference: "E-1" })]
    await using context = await setUp(fakeBank(() => listed).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.orThrow(syncMonetaTransactions(range))

    listed = [...listed, transaction({ entryReference: "E-2" })]
    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({ ok: true, value: { recordedCount: 1 } })
  })

  test("asks no further back than the two years the bank reads without strong authentication", async () => {
    const bank = fakeBank(() => [])
    await using context = await setUp(bank.fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )

    await context.run.orThrow(
      syncMonetaTransactions({
        fromDate: DateStringSchema.decode("2020-01-01"),
        toDate: range.toDate,
      })
    )

    const fromDate = bank.requests
      .find((url) => url.pathname.endsWith("/transactions"))
      ?.searchParams.get("fromDate")
    expect(fromDate).toBe("2024-05-27")
  })

  test("measures the two readable years from today, not from the end of the window", async () => {
    const bank = fakeBank(() => [])
    await using context = await setUp(bank.fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )

    await context.run.orThrow(
      syncMonetaTransactions({
        fromDate: DateStringSchema.decode("2024-01-01"),
        toDate: DateStringSchema.decode("2024-12-31"),
      })
    )
    await expect(
      context.run(
        syncMonetaTransactions({
          fromDate: DateStringSchema.decode("2023-01-01"),
          toDate: DateStringSchema.decode("2023-12-31"),
        })
      )
    ).resolves.toMatchObject({ ok: true, value: { callCount: 0 } })

    const windows = bank.requests
      .filter((url) => url.pathname.endsWith("/transactions"))
      .map((url) => url.searchParams.get("fromDate"))
    expect(windows).toEqual(["2024-05-27"])
  })

  test("two syncs at once end in one transaction and one claim", async () => {
    await using context = await setUp(fakeBank(() => [transaction()]).fetch)
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)

    const results = await Promise.all([
      context.run(syncMonetaTransactions(range)),
      context.run(syncMonetaTransactions(range)),
    ])

    expect(results).toMatchObject([
      { ok: true, value: { claimedPaymentIds: [paymentId] } },
      { ok: true, value: { claimedPaymentIds: [paymentId] } },
    ])
    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toHaveLength(1)
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toHaveLength(1)
  })

  test("two syncs at once of two transfers both claim the payment, as one sync does", async () => {
    await using context = await setUp(
      fakeBank(() => [
        transaction({ entryReference: "E-1" }),
        transaction({ entryReference: "E-2" }),
      ]).fetch
    )
    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    const paymentId = await createIbanPayment(context)

    await Promise.all([
      context.run(syncMonetaTransactions(range)),
      context.run(syncMonetaTransactions(range)),
    ])

    await expect(
      context.evolu.loadQuery(accountTransactionsQuery(context.accountId))
    ).resolves.toHaveLength(2)
    await expect(context.evolu.loadQuery(claimsQuery)).resolves.toMatchObject([
      { paymentId },
      { paymentId },
    ])
  })

  test("reports no plugin when it is off, disconnected or its IBAN is gone", async () => {
    await using context = await setUp(fakeBank(() => [transaction()]).fetch)
    const notFound = {
      ok: false,
      error: { type: "MonetaPluginNotFound", id: monetaPluginId },
    }

    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual(
      notFound
    )

    await context.run.orThrow(
      connectMonetaPlugin({ accountId: context.accountId, iban, token })
    )
    await context.run.ok(saveMonetaPlugin({ isActive: sqliteFalse }))
    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual(
      notFound
    )

    await context.run.ok(saveMonetaPlugin({ isActive: sqliteTrue }))
    await context.run.ok(
      saveFiatBankAccount({ enabled: true, iban: otherIban, currency: "CZK" })
    )
    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual(
      notFound
    )

    await context.run.ok(
      saveFiatBankAccount({ enabled: true, iban, currency: "CZK" })
    )
    await expect(
      context.run(syncMonetaTransactions(range))
    ).resolves.toMatchObject({ ok: true })

    await context.run.ok(disconnectMonetaPlugin())
    await expect(context.run(syncMonetaTransactions(range))).resolves.toEqual(
      notFound
    )
  })
})

describe("syncMonetaTransactions, self-pay", () => {
  test("credits a self-pay bill from the reference and pointer a MONETA transfer carries", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    const bank = fakeBank(
      () => [
        transaction({
          amount: { value: "450,00", currency: "CZK" },
          bookingDate: { date: "2026-06-05" },
          entryDetails: {
            transactionDetails: {
              relatedParties: { debtor: { name: "Guest" } },
              remittanceInformation: {
                unstructured: formatSelfPayBankMessage({ pointer }),
                structured: {
                  creditorReferenceInformation: {
                    reference: `VS:${reference}`,
                  },
                },
              },
            },
          },
        }),
      ],
      otherIban
    )
    await using run = testCreateRun({ ...context.deps, fetch: bank.fetch })
    await run.orThrow(
      connectMonetaPlugin({
        accountId: context.ibanAccountId,
        iban: otherIban,
        token,
      })
    )

    const synced = await run.orThrow(
      syncMonetaTransactions({
        fromDate: DateStringSchema.decode("2026-06-05"),
        toDate: DateStringSchema.decode("2026-06-05"),
      })
    )

    expect(synced.claimedPaymentIds).toHaveLength(1)
    expect(await run.orThrow(loadBillStatus(billId))).toBe("closed")
    expect(
      await context.deps.evolu.loadQuery(selfPayPointersByBillIdQuery(billId))
    ).toEqual([{ pointer }])
  })
})
