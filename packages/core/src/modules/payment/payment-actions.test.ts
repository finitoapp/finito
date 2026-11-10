import {
  createIdFromString,
  ok,
  sqliteTrue,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import {
  createYadioApiDep,
  type YadioApiDep,
} from "../../integrations/yadio/yadio-client.ts"
import type { SparkWalletDep } from "../../spark/spark-wallet.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import {
  interpretSwitchioPaymentResult,
  type SwitchioTerminalDep,
} from "../../switchio.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveCardSwitchioAccount } from "../account/account-actions.ts"
import { createCardSwitchioAccountId } from "../account/account-utils.ts"
import { deleteAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  addTipToBill,
  appendGuardedBillLines,
  appendRemoveBillLine,
  cancelBill,
  confirmBillClosedDespiteCancellation,
  createBill,
  splitBill,
} from "../bill/bill-actions.ts"
import { loadBillCoverage, loadBillStatus } from "../bill/bill-guards.ts"
import { billByIdQuery } from "../bill/bill-queries.ts"
import {
  insertBillLineRows,
  loadCalculatedBillLineSummaries,
} from "../bill-line/bill-line-actions.ts"
import { deriveBillLineSummaryDiff } from "../bill-line/bill-line-utils.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { upsertItemSnapshot } from "../item/item-actions.ts"
import { itemsByPaymentIdQuery } from "../item/item-queries.ts"
import { createStandaloneItemSnapshot } from "../item/item-utils.ts"
import { paymentLinesByPaymentIdQuery } from "../payment-line/payment-line-queries.ts"
import { paymentLinesToBillLineSummaries } from "../payment-line/payment-line-utils.ts"
import { activeReconciliationClaimsByPaymentIdQuery } from "../reconciliation-claim/reconciliation-claim-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  SpecificSymbol,
  TimestampMs,
  TimestampMsSchema,
  VariableSymbol,
} from "../shared/schema.ts"
import {
  cancelPayment,
  confirmPaymentPaidDespiteCancellation,
  createPayment,
  deletePayment,
  loadPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
  payPaymentWithBoltCard,
  payPaymentWithSwitchioCard,
  settleRestoredSwitchioCardPayment,
  updatePayment,
} from "./payment-actions.ts"
import { preparePaymentMethod } from "./payment-preparation-actions.ts"
import {
  paymentByIdQuery,
  paymentsWithClaimsByBillIdQuery,
} from "./payment-queries.ts"
import {
  accountTransactionSourcesByPaymentIdQuery,
  accountTransactionsByPaymentIdQuery,
  createPaymentAccounts,
  paymentWithDetailsByIdQuery,
  reconciliationClaimsByPaymentIdQuery,
} from "./payment-test-fixtures.ts"
import type { PaymentId } from "./payment-types.ts"

const paymentCardSwitchioByPaymentIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db.selectFrom("paymentCardSwitchio").selectAll().where("id", "=", id)
  )

describe("payment actions", () => {
  test("creates and loads a payment with payment option details through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, sparkAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(1_000),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
        spark: {
          accountId: sparkAccountId,
          amountSats: NonNegativeInteger(20_000),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc200u1test"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("abc"),
            paymentPreimage: null,
          },
          sparkInvoice: {
            sparkInvoice: NonEmptyStringSchema.decode("spark-invoice-test"),
          },
        },
        iban: {
          accountId: ibanAccountId,
          variableSymbol: VariableSymbol("1234567890"),
          specificSymbol: SpecificSymbol("9876543210"),
        },
      })
    )

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          billId: null,
          tableId: null,
          amount: 12_900,
          currency: "CZK",
          tipAmount: 1_000,
          canceledAt: null,
          cashRegister: {
            id,
            accountId: cashRegisterAccountId,
          },
          spark: {
            id,
            accountId: sparkAccountId,
            amountSats: 20_000,
            exchangeRate: 1_500_000,
            exchangeRateSource: "yadio",
            exchangeRateFetchedAt: 1_700_000_000_000,
            lnInvoice: "lnbc200u1test",
            sparkInvoice: "spark-invoice-test",
            paymentHash: "abc",
          },
          iban: {
            id,
            accountId: ibanAccountId,
            variableSymbol: "1234567890",
            specificSymbol: "9876543210",
          },
        },
      ])

    await expect
      .poll(() =>
        evolu.loadQuery(
          createQuery((db) =>
            db.selectFrom("paymentNumber").selectAll().where("id", "=", id)
          )
        )
      )
      .toMatchObject([
        {
          id,
          serialNumber: 1,
          date: "2026-06-05",
        },
      ])

    await expect(run(loadPayment(id))).resolves.toMatchObject({
      ok: true,
      value: {
        id,
        amount: 12_900,
        currency: "CZK",
        tipAmount: 1_000,
      },
    })

    // No bill — nothing to snapshot.
    await expect(
      evolu.loadQuery(paymentLinesByPaymentIdQuery(id))
    ).resolves.toEqual([])
  }, 15_000)

  test("diffs a payment's frozen snapshot against the live bill through the real producers", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    // A manual amount and a tip with the same name and amount: one shared
    // `item` snapshot, two separate lines — the collision that made the diff
    // key on something unique.
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    await run.orThrow(
      addTipToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    const loadDiff = async () => {
      const [paymentLines, itemRows, current] = await Promise.all([
        evolu.loadQuery(paymentLinesByPaymentIdQuery(paymentId)),
        evolu.loadQuery(itemsByPaymentIdQuery(paymentId)),
        run.ok(loadCalculatedBillLineSummaries(billId)),
      ])

      return deriveBillLineSummaryDiff(
        paymentLinesToBillLineSummaries(paymentLines, itemRows),
        current
      )
    }

    // Nothing has moved yet. This is the property the diff's whole first pass
    // rests on: `paymentLinesToBillLineSummaries` and
    // `calculateBillLineSummaries` must derive the *same* summary ids for the
    // same line, or an untouched bill would read as every line removed and
    // re-added. The unit tests around `deriveBillLineSummaryDiff` build both
    // sides by hand and cannot catch that.
    await expect.poll(loadDiff).toEqual({
      added: [],
      removed: [],
      changed: [],
    })
  }, 15_000)

  test("snapshots the bill's line-item summaries as paymentLine rows when the payment is tied to a bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const expectedSummaries = await run.ok(
      loadCalculatedBillLineSummaries(billId)
    )

    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect
      .poll(() => evolu.loadQuery(paymentLinesByPaymentIdQuery(paymentId)))
      .toMatchObject(
        expectedSummaries.map((summary) => ({
          paymentId,
          billId,
          catalogItemId: summary.catalogItemId,
          itemId: summary.itemId,
          type: summary.type,
          quantity: summary.quantity,
          totalAmount: summary.totalAmount,
        }))
      )

    // Simulates another (still offline) device adding an item to the same
    // bill after this payment was created — a direct, unguarded write, the
    // same way the e2e bridge simulates it, since `addManualAmountToBill`'s
    // own editing lock correctly refuses this on this device (a pending
    // payment locks the bill). Must not retroactively change the frozen
    // snapshot — that's the whole point of it.
    const extraSnapshot = createStandaloneItemSnapshot({
      catalogItemId: null,
      name: NonEmptyString255("Extra"),
      description: null,
      currency: "CZK",
      unitAmount: NonNegativeInteger(300),
      taxRateId: null,
    })
    await runMutationWithCompletion((options) => {
      upsertItemSnapshot(evolu, extraSnapshot, {
        ...options,
        owner: deps.evoluOwner,
      })
      insertBillLineRows(
        evolu,
        [
          {
            billId,
            deviceId: null,
            catalogItemId: null,
            itemId: extraSnapshot.id,
            type: "manualAmount",
            kind: "add",
            quantity: PositiveNumber(1),
            totalAmount: NonNegativeInteger(300),
          },
        ],
        { ...options, owner: deps.evoluOwner }
      )
    })

    const snapshotRows = await evolu.loadQuery(
      paymentLinesByPaymentIdQuery(paymentId)
    )
    expect(snapshotRows).toHaveLength(expectedSummaries.length)
  }, 15_000)

  test("marks a payment paid in cash by creating a cash account transaction", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)
    const occurredAt = TimestampMsSchema.decode(1_700_000_000_000)
    const note = NonEmptyStringSchema.decode("Paid in cash")

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
          occurredAt,
          note,
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: id,
    })

    await expect
      .poll(() => evolu.loadQuery(accountTransactionsByPaymentIdQuery(id)))
      .toMatchObject([
        {
          accountId: cashRegisterAccountId,
          kind: "cashRegister",
          amount: 12_900,
          currency: "CZK",
          occurredAt,
          note,
          internalTransferGroupId: null,
        },
      ])

    const [accountTransaction] = await evolu.loadQuery(
      accountTransactionsByPaymentIdQuery(id)
    )
    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)))
      .toMatchObject([
        {
          paymentId: id,
          accountTransactionId: accountTransaction?.id,
          source: "manual",
        },
      ])
    // Staff took the cash: a manual confirmation (payment/0010).
    await expect(
      evolu.loadQuery(accountTransactionSourcesByPaymentIdQuery(id))
    ).resolves.toEqual([{ source: "manual" }])
  }, 15_000)

  test("marking a payment paid in cash twice to the same account does not duplicate the transaction or claim", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)
    const occurredAt = TimestampMsSchema.decode(1_700_000_000_000)
    const note = NonEmptyStringSchema.decode("Paid in cash")

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
          occurredAt,
          note,
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)))
      .toHaveLength(1)

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
          occurredAt,
          note,
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    const claims = await evolu.loadQuery(
      reconciliationClaimsByPaymentIdQuery(id)
    )
    expect(claims).toHaveLength(1)

    const transactions = await evolu.loadQuery(
      accountTransactionsByPaymentIdQuery(id)
    )
    expect(transactions).toHaveLength(1)
  }, 15_000)

  test("marking a payment paid in cash to two different accounts creates two transactions and two claims", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)
    // A cash register's id derives from its currency, so `createAccount`
    // cannot make a second CZK one — only data from before derived ids can
    // hold two, which is the shape seeded here.
    const secondCashRegisterAccountId = createRowId<"Account">()
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evolu.appOwner }

      evolu.upsert(
        "accountCashRegister",
        { id: secondCashRegisterAccountId, currency: "CZK" },
        mutationOptions
      )
      evolu.upsert(
        "account",
        {
          id: secondCashRegisterAccountId,
          deviceId: null,
          name: NonEmptyString255("Second cash register"),
          kind: "cashRegister",
        },
        mutationOptions
      )
    })
    const occurredAt = TimestampMsSchema.decode(1_700_000_000_000)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
          occurredAt,
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: secondCashRegisterAccountId,
          occurredAt,
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)))
      .toHaveLength(2)

    const transactions = await evolu.loadQuery(
      accountTransactionsByPaymentIdQuery(id)
    )
    expect(transactions).toHaveLength(2)
    expect(transactions.map((t) => t.accountId).toSorted()).toEqual(
      [cashRegisterAccountId, secondCashRegisterAccountId].toSorted()
    )
  }, 15_000)

  test("cancels a payment", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { ibanAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: ibanAccountId,
          variableSymbol: undefined,
          specificSymbol: null,
        },
      })
    )

    await expect(run(cancelPayment(id))).resolves.toEqual({
      ok: true,
      value: id,
    })

    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toMatchObject([
        {
          id,
        },
      ])
    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)
  }, 15_000)

  test("rejects canceling a payment that already has an active claim", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    await expect(run(cancelPayment(id))).resolves.toMatchObject({
      ok: false,
      error: { type: "PaymentAlreadyPaid", id },
    })

    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toMatchObject([{ id, canceledAt: null }])
  }, 15_000)

  // A claim whose transaction was deleted is not money that arrived: every
  // screen shows the payment as pending and locks its bill, so cancelling it
  // has to work, or nothing ever unlocks the bill.
  test("cancels a payment whose claimed transaction was deleted", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
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
      markPaymentPaidCash({ paymentId: id, accountId: cashRegisterAccountId })
    )
    const [transaction] = await evolu.loadQuery(
      createQuery((db) => db.selectFrom("accountTransaction").select(["id"]))
    )
    if (transaction === undefined) throw new Error("no account transaction")
    await run.ok(deleteAccountTransaction(transaction.id))

    await expect(run(cancelPayment(id))).resolves.toMatchObject({
      ok: true,
      value: id,
    })
    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)
  }, 15_000)

  test("refuses to mark a canceled payment paid by hand", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const id = await run.orThrow(
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
        iban: {
          accountId: ibanAccountId,
          variableSymbol: undefined,
          specificSymbol: null,
        },
      })
    )
    await run.orThrow(cancelPayment(id))

    const refused = {
      ok: false,
      error: { type: "PaymentCanceled", id },
    }
    await expect(
      run(
        markPaymentPaidCash({ paymentId: id, accountId: cashRegisterAccountId })
      )
    ).resolves.toEqual(refused)
    await expect(
      run(markPaymentPaidIban({ paymentId: id, accountId: ibanAccountId }))
    ).resolves.toEqual(refused)
    await expect(
      evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id))
    ).resolves.toEqual([])
  }, 15_000)

  test("resolves a canceled+claimed collision back to paid via confirmPaymentPaidDespiteCancellation", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
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

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    // `cancelPayment` itself refuses to cancel an already-claimed payment
    // (see "rejects canceling a payment that already has an active claim"
    // above), so simulate the CRDT merge race the same way "a payment
    // canceled after being claimed" does further down this file.
    evolu.update("payment", {
      id,
      canceledAt: TimestampMsSchema.decode(deps.date.now().getTime()),
    })
    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)

    await expect(
      run(confirmPaymentPaidDespiteCancellation(id))
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(id)))
      .toSatisfy((rows) => rows[0]?.confirmedPaidAt !== null)

    // Calling it again on an already-resolved payment is an idempotent
    // no-op, not a rejection — `canceledAt` and the claim are both still
    // there, exactly what the guard requires.
    await expect(
      run(confirmPaymentPaidDespiteCancellation(id))
    ).resolves.toEqual({ ok: true, value: id })
  }, 15_000)

  test("rejects confirmPaymentPaidDespiteCancellation on a payment that isn't canceled", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
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

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: id,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    await expect(
      run(confirmPaymentPaidDespiteCancellation(id))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "PaymentNotCanceled", id },
    })
  }, 15_000)

  test("rejects confirmPaymentPaidDespiteCancellation on a canceled payment with no active claim", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { ibanAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: ibanAccountId,
          variableSymbol: undefined,
          specificSymbol: null,
        },
      })
    )

    await expect(run(cancelPayment(id))).resolves.toMatchObject({ ok: true })

    await expect(
      run(confirmPaymentPaidDespiteCancellation(id))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "PaymentNotClaimed", id },
    })
  }, 15_000)

  test("resolving a payment's canceled+claimed collision never changes its bill's coverage or status", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    await expect(
      run(
        markPaymentPaidCash({
          paymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    // Simulate the CRDT merge race (same as "a payment canceled after being
    // claimed" below): the payment ends up canceled+claimed, independent of
    // whatever its bill is doing.
    evolu.update("payment", {
      id: paymentId,
      canceledAt: TimestampMsSchema.decode(deps.date.now().getTime()),
    })
    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(paymentId)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)

    // The bill is still closed/paid throughout — a payment's own display
    // collision never touches bill coverage either way.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    const coverageBeforeResolve = await run.ok(loadBillCoverage(billId))

    await expect(
      run(confirmPaymentPaidDespiteCancellation(paymentId))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toEqual(
      coverageBeforeResolve
    )
  }, 15_000)

  test("updates a payment's amount and its cashRegister/spark/iban details", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, sparkAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(1_000),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
        spark: {
          accountId: sparkAccountId,
          amountSats: NonNegativeInteger(20_000),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc200u1test"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("abc"),
            paymentPreimage: null,
          },
          sparkInvoice: {
            sparkInvoice: NonEmptyStringSchema.decode("spark-invoice-test"),
          },
        },
        iban: {
          accountId: ibanAccountId,
          variableSymbol: VariableSymbol("1234567890"),
          specificSymbol: SpecificSymbol("9876543210"),
        },
      })
    )

    await expect(
      run.ok(
        updatePayment({
          id,
          deviceId: undefined,
          billId: undefined,
          tableId: undefined,
          amount: NonNegativeInteger(15_000),
          currency: undefined,
          tipAmount: NonNegativeInteger(2_000),
          canceledAt: undefined,
          cashRegister: {
            accountId: cashRegisterAccountId,
          },
          spark: {
            amountSats: NonNegativeInteger(25_000),
            exchangeRate: PositiveNumber(1_600_000),
            lightning: {
              lnInvoice: NonEmptyStringSchema.decode("lnbc300u1test"),
            },
            sparkInvoice: {
              sparkInvoice: NonEmptyStringSchema.decode(
                "spark-invoice-updated"
              ),
            },
          },
          iban: {
            variableSymbol: VariableSymbol("1111111111"),
            specificSymbol: SpecificSymbol("2222222222"),
          },
        })
      )
    ).resolves.toBe(id)

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          amount: 15_000,
          tipAmount: 2_000,
          spark: {
            amountSats: 25_000,
            exchangeRate: 1_600_000,
            lnInvoice: "lnbc300u1test",
            sparkInvoice: "spark-invoice-updated",
          },
          iban: {
            variableSymbol: "1111111111",
            specificSymbol: "2222222222",
          },
        },
      ])
  }, 15_000)

  test("deletes a payment by soft-deleting it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { ibanAccountId } = await createPaymentAccounts(deps)

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: {
          accountId: ibanAccountId,
          variableSymbol: undefined,
          specificSymbol: null,
        },
      })
    )

    await expect(run.ok(deletePayment(id))).resolves.toBe(id)

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          isDeleted: sqliteTrue,
        },
      ])
  }, 15_000)

  test("creating a payment for a bill neither closes nor unlocks it, and a second/split payment is still accepted", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )

    const firstPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")

    // A second/split payment attempt while the first is still pending and
    // unresolved is deliberately allowed — only editing the bill's lines is
    // locked while a payment is pending, not creating another payment.
    const secondPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )
    expect(secondPaymentId).not.toBe(firstPaymentId)

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
  }, 15_000)

  test("a pending payment locks its bill against edits; canceling the payment unlocks it again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Late addition"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })

    await run.orThrow(cancelPayment(paymentId))

    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Late addition"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: true })
  }, 15_000)

  test("a pending payment with an expiry unlocks its bill once that expiry passes, with no cancellation needed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const clock = createTestDateDep()
    const deps = {
      ...evoluTestDeps(evolu),
      ...clock,
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: TimestampMsSchema.decode(
          deps.date.now().getTime() + 900_000
        ),
      })
    )

    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Late addition"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })

    // The clock advances past the payment's own expiry — no cancellation
    // and no other explicit action at all. docs/bill-payment-states.md:
    // Lightning has a natural resolution path via `expiresAt` (unlike cash
    // and IBAN, which need the manual "Cancel payment" escape hatch) — an
    // abandoned invoice recovers its bill purely from time passing.
    clock.advance(900_001)

    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Late addition"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: true })
  }, 15_000)

  test("confirming a payment that fully covers the bill closes it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
  }, 15_000)

  test("records the account transaction, claim, and bill closing in one mutation batch", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    // Regression guard for the crash window this closed: recording the money
    // and claiming it used to be two separately-awaited mutation batches, so
    // a crash (or a failed second batch) between them could leave the account
    // transaction committed with nothing claiming it. Every write
    // `markPaymentPaidCash` makes below — the account transaction, its source
    // row, the claim, and the bill's `closedAt` cache — must share one
    // batch's `onComplete`, proving they commit together or not at all.
    const upsertSpy = vi.spyOn(evolu, "upsert")
    const updateSpy = vi.spyOn(evolu, "update")

    await run.orThrow(
      markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId })
    )

    const writeCalls = [...upsertSpy.mock.calls, ...updateSpy.mock.calls]
    const completions = new Set(writeCalls.map((call) => call[2]?.onComplete))
    upsertSpy.mockRestore()
    updateSpy.mockRestore()

    expect(writeCalls.length).toBeGreaterThanOrEqual(4)
    expect(completions.size).toBe(1)
  }, 15_000)

  test("stops counting a claim once the transaction behind it is deleted", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
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

    await expect
      .poll(() => evolu.loadQuery(paymentsWithClaimsByBillIdQuery(billId)))
      .toMatchObject([
        { id: paymentId, claimedTransactions: [{ kind: "cashRegister" }] },
      ])

    const [transaction] = await evolu.loadQuery(
      createQuery((db) => db.selectFrom("accountTransaction").select(["id"]))
    )
    if (transaction === undefined) throw new Error("no account transaction")
    await run.ok(deleteAccountTransaction(transaction.id))

    // `claimedTransactions` feeds `derivePaymentStatus`'s `hasActiveClaim` on the bill
    // detail page. A claim whose transaction is gone is not money that
    // arrived — the bill's own coverage already ignores it — so counting it
    // would keep displaying the payment as paid while it funds nothing.
    await expect
      .poll(() => evolu.loadQuery(paymentsWithClaimsByBillIdQuery(billId)))
      .toMatchObject([{ id: paymentId, claimedTransactions: [] }])
  }, 15_000)

  test("marks a payment paid against a cash register or an IBAN account, each under its own deterministic transaction id", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const createCzkPayment = () =>
      run.orThrow(
        createPayment({
          deviceId: null,
          billId: null,
          tableId: null,
          amount: NonNegativeInteger(1_000),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
    const cashPaymentId = await createCzkPayment()
    const ibanPaymentId = await createCzkPayment()

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: cashPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toEqual({ ok: true, value: cashPaymentId })
    // `markPaymentPaidIban` had no coverage at all before this.
    await expect(
      run(
        markPaymentPaidIban({
          paymentId: ibanPaymentId,
          accountId: ibanAccountId,
        })
      )
    ).resolves.toEqual({ ok: true, value: ibanPaymentId })

    // The transaction ids are content-derived so a retried confirmation
    // re-uses the row instead of recording the money twice. The two prefixes
    // are *not* symmetrical — the IBAN one carries a `manual` segment and the
    // cash one does not — so they are pinned verbatim: changing either would
    // silently duplicate a settlement for every payment already confirmed.
    // Looked up by id rather than compared as an ordered list: account ids are
    // random base64url, and SQLite's binary collation does not agree with
    // JS string ordering on them.
    const transactionById = (id: string) =>
      evolu.loadQuery(
        createQuery((db) =>
          db
            .selectFrom("accountTransaction")
            .select(["id", "accountId", "amount", "kind"])
            .where("id", "=", id as never)
        )
      )

    await expect
      .poll(() =>
        transactionById(
          createIdFromString<"AccountTransaction">(
            `accountTransaction:cashRegister:payment:${cashPaymentId}:${cashRegisterAccountId}`
          )
        )
      )
      .toMatchObject([
        {
          accountId: cashRegisterAccountId,
          amount: 1_000,
          kind: "cashRegister",
        },
      ])
    await expect
      .poll(() =>
        transactionById(
          createIdFromString<"AccountTransaction">(
            `accountTransaction:iban:manual:payment:${ibanPaymentId}:${ibanAccountId}`
          )
        )
      )
      // Recorded as the transfer it is, not as cash: Activity's "Paid by"
      // and the sales statistics read the method from this kind.
      .toMatchObject([
        { accountId: ibanAccountId, amount: 1_000, kind: "iban" },
      ])

    // And exactly those two rows — no stray settlement under another id.
    await expect(
      evolu.loadQuery(
        createQuery((db) => db.selectFrom("accountTransaction").select(["id"]))
      )
    ).resolves.toHaveLength(2)

    // Each path also claims its transaction against the payment — that claim
    // is what makes the payment read as paid.
    await expect
      .poll(() =>
        evolu.loadQuery(
          activeReconciliationClaimsByPaymentIdQuery(cashPaymentId)
        )
      )
      .toHaveLength(1)
    await expect
      .poll(() =>
        evolu.loadQuery(
          activeReconciliationClaimsByPaymentIdQuery(ibanPaymentId)
        )
      )
      .toHaveLength(1)
  }, 15_000)

  test("refuses to mark a payment paid against a missing or wrong-currency account", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    // Both accounts above hold CZK, so a EUR payment mismatches each of them.
    const eurPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "EUR",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: eurPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "AccountCurrencyMismatch",
        accountKind: "cashRegister",
        accountCurrency: "CZK",
        paymentCurrency: "EUR",
      },
    })
    await expect(
      run(
        markPaymentPaidIban({
          paymentId: eurPaymentId,
          accountId: ibanAccountId,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "AccountCurrencyMismatch",
        accountKind: "iban",
        accountCurrency: "CZK",
        paymentCurrency: "EUR",
      },
    })

    // A cash register is not an IBAN account and vice versa: each path only
    // accepts its own kind, and reports its own not-found error.
    const czkPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )
    await expect(
      run(
        markPaymentPaidCash({
          paymentId: czkPaymentId,
          accountId: ibanAccountId,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "CashRegisterAccountNotFound", id: ibanAccountId },
    })
    await expect(
      run(
        markPaymentPaidIban({
          paymentId: czkPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "IbanAccountNotFound", id: cashRegisterAccountId },
    })

    // Nothing was recorded for any of the refusals.
    await expect(
      evolu.loadQuery(
        createQuery((db) => db.selectFrom("accountTransaction").select(["id"]))
      )
    ).resolves.toEqual([])
  }, 15_000)

  test("confirming a payment that only partially covers the bill leaves it open and unlocked", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(400),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")

    // The confirmed payment is no longer pending (it's paid), so the bill
    // is open *and* editable again — only a live/pending payment locks it.
    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Dessert"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(200),
        })
      )
    ).resolves.toMatchObject({ ok: true })
  }, 15_000)

  test("rejects creating a payment for a canceled bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(cancelBill(billId))

    await expect(
      run(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(12_900),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed", status: "canceled" },
    })
  }, 15_000)

  test("rejects creating a payment for an already-closed bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
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
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    await expect(
      run(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(500),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed", status: "closed" },
    })
  }, 15_000)

  test("rejects creating a payment for a bill resolved via confirmBillClosedDespiteCancellation", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    await run.orThrow(cancelBill(billId))
    await run.orThrow(
      markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId })
    )
    await run.orThrow(confirmBillClosedDespiteCancellation(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    // Once resolved, the bill is just as final as an ordinarily-closed one
    // — a new payment attempt is rejected the same way.
    await expect(
      run(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(500),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed", status: "closed" },
    })
  }, 15_000)

  test("canceling a bill with a pending payment leaves it canceled even after that payment is later confirmed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    // `cancelBill` does not check the editing lock, so discarding a cart
    // with a still-pending payment attached is allowed — the UI hides this
    // path (the bill page shows the "locked" message instead of the cart
    // once a payment is pending), but the domain guard doesn't forbid it,
    // matching a real cross-device race (one device cancels while another
    // is mid-payment on a different terminal). See docs/bill-payment-states.md.
    await run.orThrow(cancelBill(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    // The claim still landed and still counts toward coverage, but the
    // cancellation is never overridden — the bill stays `canceled`, not
    // force-closed.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_000,
      coverage: "paid",
    })
  }, 15_000)

  test("a payment canceled after being claimed (a CRDT merge race) still counts toward bill coverage", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    // `cancelPayment` itself refuses to cancel an already-claimed payment
    // (see the "rejects canceling a payment that already has an active
    // claim" test), so this state can only be reached the way a real
    // multi-device merge would produce it: a concurrent cancellation write
    // that lands after the claim already did. Simulate that merged state
    // directly rather than going through `cancelPayment`.
    evolu.update("payment", {
      id: paymentId,
      canceledAt: TimestampMsSchema.decode(deps.date.now().getTime()),
    })
    await expect
      .poll(() => evolu.loadQuery(paymentByIdQuery(paymentId)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)

    // The payment now displays as canceled, but the money it already
    // claimed still counts — the bill it closed stays `closed`/`paid`, not
    // reverted.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_000,
      coverage: "paid",
    })
  }, 15_000)

  test("the editing lock rejects addCatalogItemToBill, addTipToBill, appendRemoveBillLine, and splitBill the same way it rejects addManualAmountToBill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const existingLine = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Starter"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(500),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId: "catalog-item-1" as CatalogItemId,
          quantity: PositiveNumber(1),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })

    await expect(
      run(
        addTipToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Tip"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(100),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })

    await expect(
      run(
        appendRemoveBillLine({
          billId,
          deviceId: null,
          lineSummary: existingLine,
          quantity: PositiveNumber(1),
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })

    const otherBillId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(2),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: otherBillId,
          items: [existingLine],
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
  }, 15_000)

  test("appendGuardedBillLines rejects a locked bill, unlike the unguarded appendBillLines it replaced in cart undo/redo/clear", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Starter"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    const line = {
      billId,
      deviceId: null,
      catalogItemId: lineSummary.catalogItemId,
      itemId: lineSummary.itemId,
      type: lineSummary.type,
      kind: "remove" as const,
      quantity: lineSummary.quantity,
      totalAmount: lineSummary.totalAmount,
    }

    await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(500),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(appendGuardedBillLines(billId, [line]))
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(billId)))
      .toMatchObject([{ id: lineSummary.id, totalAmount: 500 }])
  }, 15_000)

  test("splitBill rejects a locked target bill even when the source bill is open", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const sourceBillId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Shared dish"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    const targetBillId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(2),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId: targetBillId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(
        splitBill({
          sourceBillId,
          targetBillId,
          items: [lineSummary],
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
  }, 15_000)

  test("confirming a payment whose amount exceeds the bill total closes it as overpaid", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_500),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_500,
      coverage: "overpaid",
    })
  }, 15_000)

  test("a payment's tip amount does not count toward bill coverage", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_200),
        currency: "CZK",
        tipAmount: NonNegativeInteger(200),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_000,
      coverage: "paid",
    })
  }, 15_000)

  test("a second confirmed split payment re-closes an already-closed bill and updates its coverage", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const firstPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    // A second/split payment created while the bill is still open, and
    // still confirmed after the bill has already closed from the first one.
    const secondPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(500),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: firstPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    // Confirming the second payment must not be rejected just because the
    // bill already reads `closed` — status is derived live from coverage,
    // not gated by any stored "already closed" field, so a second covering
    // claim is just as welcome as the first (and refreshes the `closedAt`
    // cache idempotently via `loadBillClosedAtIfCovered`).
    await expect(
      run(
        markPaymentPaidCash({
          paymentId: secondPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_500,
      coverage: "overpaid",
    })
  }, 15_000)

  test("preserves a bill's original closedAt across a later re-close instead of overwriting it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const clock = createTestDateDep()
    const deps = {
      ...evoluTestDeps(evolu),
      ...clock,
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const firstPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    // Created while the bill is still `open` — `createPayment` would
    // reject a second payment once the bill is `closed`, so this one must
    // be created *before* the first payment below is confirmed.
    const secondPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(200),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(
        markPaymentPaidCash({
          paymentId: firstPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    const [firstClose] = await evolu.loadQuery(billByIdQuery(billId))
    const firstClosedAt = firstClose?.closedAt
    expect(firstClosedAt).not.toBeNull()

    // The clock advances, and the second (overpaying) payment is confirmed
    // afterward — re-closing the already-`closed` bill idempotently.
    clock.advance(60_000)
    await expect(
      run(
        markPaymentPaidCash({
          paymentId: secondPaymentId,
          accountId: cashRegisterAccountId,
        })
      )
    ).resolves.toMatchObject({ ok: true })

    // Still closed, but `closedAt` must stay the *first* close time, not
    // get bumped to the second claim's time.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: firstClosedAt }])
  }, 15_000)

  test("concurrently confirming two payments that together cover a bill still closes it correctly", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const firstPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(600),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )
    const secondPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(400),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    // Neither payment alone covers the bill, so if the two claims are
    // written concurrently, each write's own pre-write coverage check may
    // only see itself and skip refreshing the `closedAt` cache. That no
    // longer matters for correctness: `loadBillStatus` derives status live
    // from whatever claims exist by the time it's called, not from that
    // cache, so the bill still reads `closed` regardless of which write
    // "saw" the other first. See docs/bill-payment-states.md's "`closedAt`
    // is a cache, not a status".
    const [firstResult, secondResult] = await Promise.all([
      run(
        markPaymentPaidCash({
          paymentId: firstPaymentId,
          accountId: cashRegisterAccountId,
        })
      ),
      run(
        markPaymentPaidCash({
          paymentId: secondPaymentId,
          accountId: cashRegisterAccountId,
        })
      ),
    ])
    expect(firstResult.ok).toBe(true)
    expect(secondResult.ok).toBe(true)

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_000,
      coverage: "paid",
    })
  }, 15_000)

  test("a bill with a zero line-item total is trivially paid once its zero-amount payment is confirmed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId } = await createPaymentAccounts(deps)

    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    // No line items added — the bill's total stays 0 (e.g. fully discounted).
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(0),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
      })
    )

    await expect(
      run(markPaymentPaidCash({ paymentId, accountId: cashRegisterAccountId }))
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 0,
      claimedSum: 0,
      coverage: "paid",
    })
  }, 15_000)

  test("takes a card payment on the terminal and settles it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const requests: Array<{ readonly transactionId: string }> = []
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      switchioTerminal: {
        pay: async (request) => {
          requests.push(request)
          return ok({
            responseCode: "OK",
            authCode: "114546",
            sequenceNumber: "001001614",
            maskedPan: "970348******3910",
            cardLabel: "Air Bank",
            terminalId: "M1TNEXGO01",
            terminalDateTime: "Jul 16, 2020 14:39:37",
            refundId: "123456789012345678",
          })
        },
      },
      // `preparePaymentMethod` declares the Spark/rate deps for its other
      // branches; the card branch never reaches them.
      fetch: async () => new Response("{}"),
      sparkWallet: { create: async () => createFakeSparkWallet({}) },
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      SwitchioTerminalDep &
      SparkWalletDep &
      FetchDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
    const cardAccountId = createCardSwitchioAccountId("CZK")

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(1_000),
        canceledAt: null,
        expiresAt: null,
      })
    )
    await run.orThrow(
      preparePaymentMethod({
        paymentId: id,
        card: { accountId: cardAccountId },
      })
    )

    await expect(
      run(
        payPaymentWithSwitchioCard({ paymentId: id, accountId: cardAccountId })
      )
    ).resolves.toEqual({ ok: true, value: id })

    // ECR adds `tipAmount` to the `amount` it is given, so the terminal
    // must be asked for the total *minus* the tip: 11_900 + 1_000 is the
    // 12_900 the customer owes, not 13_900.
    expect(requests).toMatchObject([
      {
        amount: 11_900,
        tipAmount: 1_000,
        currencyCode: 203,
      },
    ])
    expect(requests[0]?.transactionId).toContain(id)

    await expect
      .poll(() => evolu.loadQuery(accountTransactionsByPaymentIdQuery(id)))
      .toMatchObject([
        {
          accountId: cardAccountId,
          kind: "cardSwitchio",
          amount: 12_900,
          currency: "CZK",
        },
      ])

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id)))
      .toHaveLength(1)

    await expect
      .poll(() => evolu.loadQuery(paymentCardSwitchioByPaymentIdQuery(id)))
      .toMatchObject([
        {
          accountId: cardAccountId,
          transactionId: requests[0]?.transactionId,
          responseCode: "OK",
          authCode: "114546",
          sequenceNumber: "001001614",
          maskedPan: "970348******3910",
          cardLabel: "Air Bank",
          terminalId: "M1TNEXGO01",
          terminalDateTime: "Jul 16, 2020 14:39:37",
          refundId: "123456789012345678",
        },
      ])
  }, 15_000)

  test("a declined card leaves the payment unsettled but keeps the terminal request id", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      switchioTerminal: {
        pay: async () =>
          interpretSwitchioPaymentResult({
            resultCode: 0,
            transactionResult: JSON.stringify({
              responseCode: "DECLINED",
              responseMessage: "zamitnuto",
            }),
          }),
      },
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & SwitchioTerminalDep
    await using run = testCreateRun(deps)
    await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
    const cardAccountId = createCardSwitchioAccountId("CZK")

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    const result = await run(
      payPaymentWithSwitchioCard({ paymentId: id, accountId: cardAccountId })
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      responseCode: "DECLINED",
    })

    // No money arrived, so nothing may claim the payment...
    expect(
      await evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(id))
    ).toHaveLength(0)
    // ...but the ECR request id written before the intent left is still
    // there, which is what makes a lost result traceable.
    const [cardRow] = await evolu.loadQuery(
      paymentCardSwitchioByPaymentIdQuery(id)
    )
    expect(cardRow?.transactionId).toContain(id)
    expect(cardRow?.responseCode).toBe(null)
    // A decline is a definite answer, so the attempt is not left unresolved.
    expect(cardRow?.unresolvedTransactionId).toBe(null)
  }, 15_000)

  test("refuses a card account whose currency differs from the payment", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      switchioTerminal: {
        pay: async () => {
          throw new Error("The terminal must not be asked to pay.")
        },
      },
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & SwitchioTerminalDep
    await using run = testCreateRun(deps)
    await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "EUR" }))
    const cardAccountId = createCardSwitchioAccountId("EUR")

    const id = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    const result = await run(
      payPaymentWithSwitchioCard({ paymentId: id, accountId: cardAccountId })
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "AccountCurrencyMismatch",
      accountKind: "cardSwitchio",
    })
  }, 15_000)

  describe("card payment attempts", () => {
    const approved = ok({
      responseCode: "OK",
      authCode: "114546",
      sequenceNumber: null,
      maskedPan: null,
      cardLabel: null,
      terminalId: null,
      terminalDateTime: null,
      refundId: "123456789012345678",
    })

    const setUp = async (
      pay: SwitchioTerminalDep["switchioTerminal"]["pay"]
    ) => {
      const testEvolu = await createEvoluTest()
      const { evolu } = testEvolu
      const requests: Array<{ readonly transactionId: string }> = []
      const dateDep = createTestDateDep()
      const deps = {
        ...evoluTestDeps(evolu),
        ...dateDep,
        switchioTerminal: {
          pay: async (request) => {
            requests.push(request)
            return pay(request)
          },
        },
      } satisfies EvoluDep & EvoluOwnerDep & DateDep & SwitchioTerminalDep
      const run = testCreateRun(deps)
      await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
      const accountId = createCardSwitchioAccountId("CZK")
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
        })
      )
      return {
        evolu,
        run,
        requests,
        accountId,
        paymentId,
        advanceClock: dateDep.advance,
        [Symbol.asyncDispose]: async () => {
          await run[Symbol.asyncDispose]()
          await testEvolu[Symbol.asyncDispose]()
        },
      }
    }

    test("records the device that took the card payment on its claim", async () => {
      await using ctx = await setUp(async () => approved)
      const { evolu, run, accountId, paymentId } = ctx
      const deviceId = createRowId<"Device">()

      await run.orThrow(
        payPaymentWithSwitchioCard({ paymentId, accountId, deviceId })
      )

      await expect
        .poll(() =>
          evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(paymentId))
        )
        .toMatchObject([{ deviceId }])
    }, 15_000)

    test("records a card payment the terminal approved as automatic, not by hand", async () => {
      await using ctx = await setUp(async () => approved)
      const { evolu, run, accountId, paymentId } = ctx

      await run.orThrow(payPaymentWithSwitchioCard({ paymentId, accountId }))

      await expect(
        evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(paymentId))
      ).resolves.toMatchObject([{ source: "auto" }])
      await expect(
        evolu.loadQuery(accountTransactionSourcesByPaymentIdQuery(paymentId))
      ).resolves.toEqual([{ source: "auto" }])
    }, 15_000)

    test("keeps what a refund to the card needs: the terminal's refund id, the phone that charged the card and when", async () => {
      await using ctx = await setUp(async () => approved)
      const { evolu, run, requests, accountId, paymentId } = ctx
      // `setUp` creates the payment without a device: as if another device
      // had created it and this phone took the card when it was reopened.
      const chargingDeviceId = createRowId<"Device">()

      await run.orThrow(
        payPaymentWithSwitchioCard({
          paymentId,
          accountId,
          deviceId: chargingDeviceId,
        })
      )

      const [row] = await evolu.loadQuery(
        paymentCardSwitchioByPaymentIdQuery(paymentId)
      )
      expect(row).toMatchObject({
        transactionId: requests[0]?.transactionId,
        refundId: "123456789012345678",
        deviceId: chargingDeviceId,
        approvedAt: testFixedDate.getTime(),
      })
    }, 15_000)

    test("keeps the first approval time when the same result is recorded again after a restart", async () => {
      await using ctx = await setUp(async () => approved)
      const { evolu, run, requests, accountId, paymentId, advanceClock } = ctx
      await run.orThrow(payPaymentWithSwitchioCard({ paymentId, accountId }))
      const transactionId = requests[0]?.transactionId ?? null

      advanceClock(60_000)
      await run.orThrow(
        settleRestoredSwitchioCardPayment({
          restored: {
            resultCode: -1,
            transactionId,
            transactionResult: JSON.stringify({
              responseCode: "OK",
              refundId: "123456789012345678",
            }),
          },
        })
      )

      const [row] = await evolu.loadQuery(
        paymentCardSwitchioByPaymentIdQuery(paymentId)
      )
      expect(row?.approvedAt).toBe(testFixedDate.getTime())
    }, 15_000)

    test("refuses an already paid payment before the terminal is asked", async () => {
      await using ctx = await setUp(async () => approved)
      const { run, requests, accountId, paymentId } = ctx

      await run.orThrow(payPaymentWithSwitchioCard({ paymentId, accountId }))
      const second = await run(
        payPaymentWithSwitchioCard({ paymentId, accountId })
      )

      expect(!second.ok && second.error).toMatchObject({
        type: "PaymentNotPayable",
        status: "paid",
      })
      expect(requests).toHaveLength(1)
    }, 15_000)

    test("refuses a canceled payment before the terminal is asked", async () => {
      await using ctx = await setUp(async () => approved)
      const { run, requests, accountId, paymentId } = ctx

      await run.orThrow(cancelPayment(paymentId))
      const result = await run(
        payPaymentWithSwitchioCard({ paymentId, accountId })
      )

      expect(!result.ok && result.error).toMatchObject({
        type: "PaymentNotPayable",
        status: "canceled",
      })
      expect(requests).toHaveLength(0)
    }, 15_000)

    test("an unreadable result blocks another attempt until it is explicitly retried", async () => {
      const results = [
        interpretSwitchioPaymentResult({
          resultCode: -1,
          transactionResult: "not json",
        }),
        approved,
      ]
      await using ctx = await setUp(async () => {
        const next = results.shift()
        if (next === undefined) throw new Error("Unexpected terminal call.")
        return next
      })
      const { evolu, run, requests, accountId, paymentId } = ctx

      const first = await run(
        payPaymentWithSwitchioCard({ paymentId, accountId })
      )
      expect(!first.ok && first.error.type).toBe("SwitchioResultUnreadable")
      const [unresolvedRow] = await evolu.loadQuery(
        paymentCardSwitchioByPaymentIdQuery(paymentId)
      )
      expect(unresolvedRow?.unresolvedTransactionId).toBe(
        requests[0]?.transactionId
      )

      const blocked = await run(
        payPaymentWithSwitchioCard({ paymentId, accountId })
      )
      expect(!blocked.ok && blocked.error).toMatchObject({
        type: "SwitchioAttemptUnresolved",
        transactionId: requests[0]?.transactionId,
      })
      expect(requests).toHaveLength(1)

      await expect(
        run(
          payPaymentWithSwitchioCard({
            paymentId,
            accountId,
            retryUnresolved: true,
          })
        )
      ).resolves.toEqual({ ok: true, value: paymentId })
      const [settledRow] = await evolu.loadQuery(
        paymentCardSwitchioByPaymentIdQuery(paymentId)
      )
      expect(settledRow).toMatchObject({
        transactionId: requests[1]?.transactionId,
        unresolvedTransactionId: null,
        authCode: "114546",
      })
    }, 15_000)

    test("settles a result restored after the app was killed", async () => {
      // The WebView died while SwitchioPay was in the foreground: the bridge
      // call never resolved normally, so the attempt stays unresolved.
      await using ctx = await setUp(async () =>
        interpretSwitchioPaymentResult({
          resultCode: -1,
          transactionResult: null,
        })
      )
      const { evolu, run, requests, accountId, paymentId } = ctx
      await run(payPaymentWithSwitchioCard({ paymentId, accountId }))
      const transactionId = requests[0]?.transactionId ?? null

      await expect(
        run(
          settleRestoredSwitchioCardPayment({
            restored: {
              resultCode: -1,
              transactionId,
              transactionResult: JSON.stringify({
                transactionId,
                responseCode: "OK",
                authCode: "998877",
              }),
            },
          })
        )
      ).resolves.toEqual({ ok: true, value: paymentId })

      await expect
        .poll(() =>
          evolu.loadQuery(reconciliationClaimsByPaymentIdQuery(paymentId))
        )
        .toHaveLength(1)
      const [row] = await evolu.loadQuery(
        paymentCardSwitchioByPaymentIdQuery(paymentId)
      )
      expect(row).toMatchObject({
        unresolvedTransactionId: null,
        authCode: "998877",
      })
    }, 15_000)

    test("refuses a restored result for an unknown request id", async () => {
      await using ctx = await setUp(async () => approved)

      const result = await ctx.run(
        settleRestoredSwitchioCardPayment({
          restored: {
            resultCode: -1,
            transactionId: "unknown",
            transactionResult: JSON.stringify({ responseCode: "OK" }),
          },
        })
      )

      expect(!result.ok && result.error).toMatchObject({
        type: "SwitchioRestoredResultUnmatched",
        transactionId: "unknown",
      })
    }, 15_000)
  })

  describe("bolt card payments", () => {
    const setUp = async ({ canceled }: { readonly canceled: boolean }) => {
      const testEvolu = await createEvoluTest()
      const { evolu } = testEvolu
      const requestedUrls: string[] = []
      const deps = {
        ...evoluTestDeps(evolu),
        ...createTestDateDep(),
        fetch: async (input) => {
          const url = input instanceof URL ? input.toString() : String(input)
          requestedUrls.push(url)
          return Response.json(
            url.startsWith("https://card.example.test/callback")
              ? { status: "OK" }
              : {
                  tag: "withdrawRequest",
                  callback: "https://card.example.test/callback",
                  k1: "k1",
                  minWithdrawable: 1_000,
                  maxWithdrawable: 100_000_000,
                }
          )
        },
      } satisfies EvoluDep & EvoluOwnerDep & DateDep & FetchDep
      const run = testCreateRun(deps)
      const { sparkAccountId } = await createPaymentAccounts(deps)
      const paymentId = await run.orThrow(
        createPayment({
          deviceId: null,
          billId: null,
          tableId: null,
          amount: NonNegativeInteger(12_900),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: canceled ? TimestampMs(1_700_000_000_000) : null,
          expiresAt: null,
          spark: {
            accountId: sparkAccountId,
            amountSats: NonNegativeInteger(20_000),
            exchangeRate: PositiveNumber(1_500_000),
            exchangeRateSource: "yadio",
            exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
            lightning: {
              lnInvoice: NonEmptyStringSchema.decode("lnbc200u1test"),
              lightningReceiveRequestId: null,
              paymentHash: null,
              paymentPreimage: null,
            },
          },
        })
      )

      return {
        run,
        paymentId,
        requestedUrls,
        [Symbol.asyncDispose]: async () => {
          await run[Symbol.asyncDispose]()
          await testEvolu[Symbol.asyncDispose]()
        },
      }
    }

    const uri = "lnurlw://card.example.test/ln?p=AA&c=BB"

    test("hands the payment's Lightning invoice to the card's service", async () => {
      await using ctx = await setUp({ canceled: false })

      await expect(
        ctx.run(payPaymentWithBoltCard({ paymentId: ctx.paymentId, uri }))
      ).resolves.toEqual({ ok: true, value: undefined })
      expect(ctx.requestedUrls).toEqual([
        "https://card.example.test/ln?p=AA&c=BB",
        "https://card.example.test/callback?k1=k1&pr=lnbc200u1test",
      ])
    }, 15_000)

    test("does not touch the card for a payment that can no longer be paid", async () => {
      await using ctx = await setUp({ canceled: true })

      const result = await ctx.run(
        payPaymentWithBoltCard({ paymentId: ctx.paymentId, uri })
      )

      expect(!result.ok && result.error).toMatchObject({
        type: "PaymentNotPayable",
        status: "canceled",
      })
      expect(ctx.requestedUrls).toEqual([])
    }, 15_000)
  })

  describe("cash received", () => {
    const cashReceivedByPaymentIdQuery = (id: PaymentId) =>
      createQuery((db) =>
        db
          .selectFrom("paymentCashRegister")
          .select(["receivedAmount"])
          .where("id", "=", id)
      )

    const createCashContext = async () => {
      const testEvolu = await createEvoluTest()
      const { evolu } = testEvolu
      const deps = {
        ...evoluTestDeps(evolu),
        ...createTestDateDep(),
      } satisfies EvoluDep & EvoluOwnerDep & DateDep
      const { cashRegisterAccountId } = await createPaymentAccounts(deps)
      await using run = testCreateRun(deps)
      const billId = await run.ok(
        createBill({
          deviceId: null,
          displayNumber: PositiveInteger(1),
          label: null,
          tableId: null,
          currency: "CZK",
        })
      )
      await run.orThrow(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Lunch"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(7_890),
        })
      )
      const paymentId = await run.orThrow(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(7_890),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
          cashRegister: { accountId: cashRegisterAccountId },
        })
      )

      return {
        evolu,
        deps,
        billId,
        paymentId,
        cashRegisterAccountId,
        [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
      }
    }

    test("stores the cash received and keeps the charge everywhere else", async () => {
      await using ctx = await createCashContext()
      await using run = testCreateRun(ctx.deps)

      await expect(
        run(
          markPaymentPaidCash({
            paymentId: ctx.paymentId,
            accountId: ctx.cashRegisterAccountId,
            receivedAmount: NonNegativeInteger(8_000),
          })
        )
      ).resolves.toEqual({ ok: true, value: ctx.paymentId })

      await expect(
        ctx.evolu.loadQuery(cashReceivedByPaymentIdQuery(ctx.paymentId))
      ).resolves.toEqual([{ receivedAmount: 8_000 }])
      await expect(
        ctx.evolu.loadQuery(accountTransactionsByPaymentIdQuery(ctx.paymentId))
      ).resolves.toMatchObject([{ amount: 7_890 }])
      await expect(run.ok(loadBillCoverage(ctx.billId))).resolves.toEqual({
        billTotal: 7_890,
        claimedSum: 7_890,
        coverage: "paid",
      })
      await expect(run.orThrow(loadBillStatus(ctx.billId))).resolves.toBe(
        "closed"
      )
    }, 15_000)

    test("refuses less than the charge rounded to whole crowns", async () => {
      await using ctx = await createCashContext()
      await using run = testCreateRun(ctx.deps)

      await expect(
        run(
          markPaymentPaidCash({
            paymentId: ctx.paymentId,
            accountId: ctx.cashRegisterAccountId,
            receivedAmount: NonNegativeInteger(7_700),
          })
        )
      ).resolves.toEqual({
        ok: false,
        error: {
          type: "CashReceivedBelowCharge",
          receivedAmount: 7_700,
          leastReceivedAmount: 7_900,
        },
      })

      await expect(
        ctx.evolu.loadQuery(
          activeReconciliationClaimsByPaymentIdQuery(ctx.paymentId)
        )
      ).resolves.toEqual([])
      await expect(
        ctx.evolu.loadQuery(cashReceivedByPaymentIdQuery(ctx.paymentId))
      ).resolves.toEqual([{ receivedAmount: null }])
    }, 15_000)

    test("keeps no received amount when the caller gives none", async () => {
      await using ctx = await createCashContext()
      await using run = testCreateRun(ctx.deps)

      await run.orThrow(
        markPaymentPaidCash({
          paymentId: ctx.paymentId,
          accountId: ctx.cashRegisterAccountId,
        })
      )

      await expect(
        ctx.evolu.loadQuery(cashReceivedByPaymentIdQuery(ctx.paymentId))
      ).resolves.toEqual([{ receivedAmount: null }])
    }, 15_000)
  })
})
