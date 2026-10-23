import type {
  DisposableRun,
  LockManagerDep,
  TestRunDefaultDeps,
} from "@evolu/common"
import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  createAccountTransaction,
  deleteAccountTransaction,
} from "../account-transaction/account-transaction-actions.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import { addManualAmountToBill, createBill } from "../bill/bill-actions.ts"
import {
  loadBill,
  loadBillCoverage,
  loadBillStatus,
} from "../bill/bill-guards.ts"
import {
  cancelPayment,
  createPayment,
  loadPayment,
} from "../payment/payment-actions.ts"
import { loadPaymentHasActiveClaim } from "../payment/payment-guards.ts"
import { derivePaymentHasCancellationCollision } from "../payment/payment-status-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { SparkSecret } from "../shared/key-derivation.ts"
import type { FiatCurrency } from "../shared/schema.ts"
import {
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  SpecificSymbol,
  TimestampMs,
  VariableSymbol,
} from "../shared/schema.ts"
import {
  claimManualReconciliation,
  reconcileAccountTransaction,
} from "./reconciliation-claim-actions.ts"

// `DateDep` included because every test below builds its run with
// `createTestDateDep()`: without it a helper here can only compose the
// actions that happen not to read the clock.
type TestRun = DisposableRun<
  TestRunDefaultDeps & EvoluDep & EvoluOwnerDep & DateDep
>

const reconciliationClaimsQuery = createQuery((db) =>
  db
    .selectFrom("reconciliationClaim")
    .select(["paymentId", "accountTransactionId", "source"])
    .where("isDeleted", "is not", sqliteTrue)
)

const createIbanAccount = async (run: TestRun): Promise<AccountId> =>
  run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )

const createSparkAccount = async (run: TestRun): Promise<AccountId> =>
  run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark account"),
      spark: {
        secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc"),
      },
    })
  )

const createCashRegisterAccount = async (run: TestRun): Promise<AccountId> =>
  run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: {
        currency: "CZK",
      },
    })
  )

/**
 * A 19 950 CZK IBAN payment and one incoming transfer carrying the very same
 * symbols, so the only thing a case varies is the money on the transfer. The
 * symbol pair already matches: what is under test is that matching symbols
 * alone are not enough to claim a payment.
 */
const seedIbanPaymentAndTransfer = async (
  run: TestRun,
  transfer: { readonly amount: Integer; readonly currency: FiatCurrency }
): Promise<{
  readonly paymentId: PaymentId
  readonly accountTransactionId: AccountTransactionId
}> => {
  const accountId = await createIbanAccount(run)
  const paymentId = await run.orThrow(
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
        accountId,
        variableSymbol: VariableSymbol("123456"),
        specificSymbol: SpecificSymbol("260605"),
      },
    })
  )
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId,
      amount: transfer.amount,
      currency: transfer.currency,
      occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
      note: null,
      internalTransferGroupId: null,
      source: {
        deviceId: null,
        source: "auto",
      },
      iban: {
        variableSymbol: VariableSymbol("123456"),
        constantSymbol: null,
        specificSymbol: SpecificSymbol("260605"),
        bankReference: NonEmptyString255("123456789"),
      },
    })
  )

  return { paymentId, accountTransactionId }
}

describe("reconciliation claim actions", () => {
  test("automatically reconciles a cash register account transaction by amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createCashRegisterAccount(run)
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
        cashRegister: {
          accountId,
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(12_900),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T12:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "manual",
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
  })

  test("automatically reconciles an IBAN account transaction by variable symbol and amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: Date.parse("2026-05-26T12:00:00.000Z"),
        expiresAt: null,
        iban: {
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: SpecificSymbol("260605"),
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: VariableSymbol("123456"),
          constantSymbol: null,
          specificSymbol: SpecificSymbol("260605"),
          bankReference: NonEmptyString255("123456789"),
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })
    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
  })

  test("does not reconcile an IBAN account transaction with a different specific symbol", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: Date.parse("2026-05-26T12:00:00.000Z"),
        expiresAt: null,
        iban: {
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: SpecificSymbol("260605"),
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: VariableSymbol("123456"),
          constantSymbol: null,
          specificSymbol: SpecificSymbol("260606"),
          bankReference: NonEmptyString255("123456790"),
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: null,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])
  })

  test("does not reconcile an IBAN account transaction without variable symbol", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    await run.orThrow(
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
          accountId,
          variableSymbol: null,
          specificSymbol: null,
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: null,
          constantSymbol: null,
          specificSymbol: null,
          bankReference: NonEmptyString255("123456789"),
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: null,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])
  })

  test("does not reconcile a cash register account transaction for a different amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createCashRegisterAccount(run)
    await run.orThrow(
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
          accountId,
        },
      })
    )
    // The cash query matches on the drawer and the amount alone (see the
    // note on `cashRegisterReconciliationCandidateByAccountTransactionIdQuery`),
    // so the amount is the whole of what separates this from a false claim.
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(100),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T12:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "manual",
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: null,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])
  })

  test("does not reconcile an IBAN account transaction for a different amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    // 1 CZK against a 199.50 CZK payment: without the amount check, the right
    // symbols alone would settle the payment — and close its bill — for a
    // hundredth of what was owed.
    const { accountTransactionId } = await seedIbanPaymentAndTransfer(run, {
      amount: Integer(100),
      currency: "CZK",
    })

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: null,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])
  })

  test("does not reconcile an IBAN account transaction in a different currency", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    // The same number of minor units, but euros against a koruna payment.
    const { accountTransactionId } = await seedIbanPaymentAndTransfer(run, {
      amount: Integer(19_950),
      currency: "EUR",
    })

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: null,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])
  })

  test("claims the lowest payment id when two pending payments match equally", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const createMatchingPayment = () =>
      run.orThrow(
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
            accountId,
            variableSymbol: VariableSymbol("123456"),
            specificSymbol: SpecificSymbol("260605"),
          },
        })
      )
    const firstPaymentId = await createMatchingPayment()
    const secondPaymentId = await createMatchingPayment()
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: VariableSymbol("123456"),
          constantSymbol: null,
          specificSymbol: SpecificSymbol("260605"),
          bankReference: NonEmptyString255("123456789"),
        },
      })
    )

    // Payment ids are random, so the tie-break is `orderBy("payment.id")`,
    // not creation order — the expectation has to be derived the same way
    // rather than assumed to be the payment written first. This pins the
    // outcome, not the clause: SQLite happens to return these rows in id
    // order even with the `orderBy` deleted, so it is the single claim and
    // the deterministic winner that are under test here.
    const expectedPaymentId =
      firstPaymentId < secondPaymentId ? firstPaymentId : secondPaymentId

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: expectedPaymentId,
    })

    // Exactly one claim: the transfer funds one of the two payments, never
    // both.
    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId: expectedPaymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
  })

  test("automatically reconciles a Spark account transaction by LN invoice and sats amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createSparkAccount(run)
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
        spark: {
          accountId,
          amountSats: NonNegativeInteger(8_600),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc8600n1prepared"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
            paymentPreimage: null,
          },
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(8_600),
        currency: "BTC",
        occurredAt: Date.parse("2026-05-27T10:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        spark: {
          sparkTransferId: NonEmptyStringSchema.decode("spark-transfer-1"),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc8600n1prepared"),
            preImage: NonEmptyStringSchema.decode("preimage-1"),
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
          },
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
  })

  test("automatically reconciles a Spark account transaction by Spark invoice and sats amount", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createSparkAccount(run)
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
        spark: {
          accountId,
          amountSats: NonNegativeInteger(8_600),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          sparkInvoice: {
            sparkInvoice: NonEmptyStringSchema.decode("spark-invoice-prepared"),
          },
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(8_600),
        currency: "BTC",
        occurredAt: Date.parse("2026-05-27T10:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        spark: {
          sparkTransferId: NonEmptyStringSchema.decode("spark-transfer-1"),
          sparkInvoice: {
            sparkInvoice: NonEmptyStringSchema.decode("spark-invoice-prepared"),
          },
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
  })

  test("picks the candidate matching the transaction's kind, not the first query", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)

    // Two payments on one account, same amount and currency, differing only in
    // method. `reconcileAccountTransaction` asks all three candidate queries
    // about the same transaction, so this is the case where the answer could
    // come from the wrong one: only the query matching `accountTransaction.kind`
    // may match, and nothing about the order the queries are asked in decides
    // it. Nothing else covers a transaction with a competing candidate.
    const cashRegisterPaymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: {
          accountId,
        },
      })
    )
    const ibanPaymentId = await run.orThrow(
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
          accountId,
          variableSymbol: VariableSymbol("123456"),
          specificSymbol: null,
        },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        iban: {
          variableSymbol: VariableSymbol("123456"),
          constantSymbol: null,
          specificSymbol: null,
          bankReference: NonEmptyString255("123456789"),
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: ibanPaymentId,
    })

    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([
        {
          paymentId: ibanPaymentId,
          accountTransactionId,
          source: "auto",
        },
      ])
    expect(ibanPaymentId).not.toBe(cashRegisterPaymentId)
  })

  test("automatically reconciling a payment's claim closes its fully covered bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createCashRegisterAccount(run)

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
        totalAmount: NonNegativeInteger(12_900),
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
        cashRegister: { accountId },
      })
    )
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(12_900),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T12:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "manual",
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
  })

  test("a Lightning settlement in satoshis closes its fiat bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createSparkAccount(run)

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
        totalAmount: NonNegativeInteger(12_900),
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
        spark: {
          accountId,
          amountSats: NonNegativeInteger(8_600),
          exchangeRate: PositiveNumber(1_500_000),
          exchangeRateSource: "yadio",
          exchangeRateFetchedAt: TimestampMs(1_700_000_000_000),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc8600n1prepared"),
            lightningReceiveRequestId: null,
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
            paymentPreimage: null,
          },
        },
      })
    )
    // The settlement records satoshis; the bill and the payment are in
    // koruna. Summed raw, 8 600 against a 12 900 total read as underpaid and
    // the bill stayed open — and editable again — for good.
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(8_600),
        currency: "BTC",
        occurredAt: Date.parse("2026-05-27T10:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: {
          deviceId: null,
          source: "auto",
        },
        spark: {
          sparkTransferId: NonEmptyStringSchema.decode("spark-transfer-1"),
          lightning: {
            lnInvoice: NonEmptyStringSchema.decode("lnbc8600n1prepared"),
            preImage: NonEmptyStringSchema.decode("preimage-1"),
            paymentHash: NonEmptyStringSchema.decode("payment-hash-1"),
          },
        },
      })
    )

    await expect(
      run(reconcileAccountTransaction(accountTransactionId))
    ).resolves.toEqual({
      ok: true,
      value: paymentId,
    })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 12_900,
      claimedSum: 12_900,
      coverage: "paid",
    })
  })

  test("a partial claim does not cache the bill as closed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const accountId = await createCashRegisterAccount(run)

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
        totalAmount: NonNegativeInteger(12_900),
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
        cashRegister: { accountId },
      })
    )
    // Only 50.00 of the 129.00 owed. The claim is real, so it is written —
    // but the bill is not covered, and the `closedAt` cache must not say it
    // is while the live derivation says otherwise.
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(5_000),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T12:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "manual" },
      })
    )

    await run.ok(
      claimManualReconciliation({
        paymentId,
        accountTransactionId,
        deviceId: null,
      })
    )

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      claimedSum: 5_000,
      coverage: "underpaid",
    })
    await expect(
      run.orThrow(loadBill(billId)).then((bill) => bill.closedAt)
    ).resolves.toBeNull()
  })
})

/**
 * Which payment a transfer may land on (payment/0004): one whose earlier claim
 * is gone is waiting for money again, and a canceled one is the last resort
 * rather than excluded.
 */
describe("reconciliation candidates", () => {
  const ibanSymbols = {
    variableSymbol: VariableSymbol("123456"),
    specificSymbol: SpecificSymbol("260605"),
  }

  const createMatchingIbanPayment = (run: TestRun, accountId: AccountId) =>
    run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(19_950),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        iban: { accountId, ...ibanSymbols },
      })
    )

  const createMatchingIbanTransfer = (
    run: TestRun,
    accountId: AccountId,
    bankReference: string
  ) =>
    run.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(19_950),
        currency: "CZK",
        occurredAt: Date.parse("2026-05-26T00:00:00.000Z"),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
        iban: {
          ...ibanSymbols,
          constantSymbol: null,
          bankReference: NonEmptyString255(bankReference),
        },
      })
    )

  test("a payment whose claim was deleted is matched again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const paymentId = await createMatchingIbanPayment(run, accountId)
    const firstTransfer = await createMatchingIbanTransfer(run, accountId, "1")
    await run.ok(reconcileAccountTransaction(firstTransfer))
    const [claim] = await evolu.loadQuery(
      createQuery((db) => db.selectFrom("reconciliationClaim").select(["id"]))
    )
    if (claim === undefined) throw new Error("no claim")
    evolu.update("reconciliationClaim", { id: claim.id, isDeleted: sqliteTrue })
    await expect
      .poll(() => evolu.loadQuery(reconciliationClaimsQuery))
      .toEqual([])

    const secondTransfer = await createMatchingIbanTransfer(run, accountId, "2")

    await expect(
      run(reconcileAccountTransaction(secondTransfer))
    ).resolves.toEqual({ ok: true, value: paymentId })
  })

  test("a payment whose claimed transaction was deleted is matched again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const paymentId = await createMatchingIbanPayment(run, accountId)
    const firstTransfer = await createMatchingIbanTransfer(run, accountId, "1")
    await run.ok(reconcileAccountTransaction(firstTransfer))
    await run.ok(deleteAccountTransaction(firstTransfer))

    const secondTransfer = await createMatchingIbanTransfer(run, accountId, "2")

    await expect(
      run(reconcileAccountTransaction(secondTransfer))
    ).resolves.toEqual({ ok: true, value: paymentId })
  })

  test("a live payment takes the transfer before a canceled one that sorts first", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const first = await createMatchingIbanPayment(run, accountId)
    const second = await createMatchingIbanPayment(run, accountId)
    // Ids are random: cancel whichever one `payment.id` would pick, so the
    // id order alone would hand it the transfer.
    const [canceled, live] = first < second ? [first, second] : [second, first]
    await run.orThrow(cancelPayment(canceled))
    const transfer = await createMatchingIbanTransfer(run, accountId, "1")

    await expect(run(reconcileAccountTransaction(transfer))).resolves.toEqual({
      ok: true,
      value: live,
    })
  })

  test("a transfer for a canceled payment is still claimed, as a collision", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
      lockManager: createInProcessLockManager(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep & LockManagerDep
    await using run = testCreateRun(deps)
    const accountId = await createIbanAccount(run)
    const paymentId = await createMatchingIbanPayment(run, accountId)
    await run.orThrow(cancelPayment(paymentId))
    const transfer = await createMatchingIbanTransfer(run, accountId, "1")

    await expect(run(reconcileAccountTransaction(transfer))).resolves.toEqual({
      ok: true,
      value: paymentId,
    })
    const payment = await run.orThrow(loadPayment(paymentId))
    expect(
      derivePaymentHasCancellationCollision({
        canceledAt: payment.canceledAt,
        confirmedPaidAt: payment.confirmedPaidAt,
        hasActiveClaim: await run.ok(loadPaymentHasActiveClaim(paymentId)),
      })
    ).toBe(true)
  })
})
