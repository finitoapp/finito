import { testCreateRun } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import { addCatalogItemToBill, createBill } from "../bill/bill-actions.ts"
import { loadOverpaymentInput } from "../bill/bill-overpayment-guards.ts"
import type { BillId, OverpaymentScope } from "../bill/bill-types.ts"
import { deriveBillOverpayment } from "../bill/bill-utils.ts"
import {
  appendBillLines,
  loadCalculatedBillLineSummaries,
} from "../bill-line/bill-line-actions.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import {
  createPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
} from "../payment/payment-actions.ts"
import { createPaymentAccounts } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { claimManualReconciliation } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMs,
} from "../shared/schema.ts"

export const createOverpaymentContext = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep()
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
  } satisfies EvoluDep & EvoluOwnerDep & DateDep
  const accounts = await createPaymentAccounts(deps)

  const createBillOf = async (
    lines: ReadonlyArray<{
      readonly name: string
      readonly unitAmount: number
      readonly quantity: number
    }>
  ): Promise<BillId> => {
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
    for (const [index, line] of lines.entries()) {
      const catalogItemId = await run.ok(
        createCatalogItem({
          deviceId: null,
          categoryId: null,
          name: NonEmptyString255(line.name),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(line.unitAmount),
          sortOrder: NonNegativeInteger(index),
          scanCode: null,
        })
      )
      await run.orThrow(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId,
          quantity: PositiveNumber(line.quantity),
        })
      )
    }
    return billId
  }

  const createTestPayment = async ({
    amount,
    billId = null,
    tipAmount = 0,
  }: {
    readonly amount: number
    readonly billId?: BillId | null
    readonly tipAmount?: number
  }): Promise<PaymentId> => {
    await using run = testCreateRun(deps)
    return await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(amount),
        currency: "CZK",
        tipAmount: NonNegativeInteger(tipAmount),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId: accounts.cashRegisterAccountId },
      })
    )
  }

  const settleInCash = async (paymentId: PaymentId, receivedAmount: number) => {
    await using run = testCreateRun(deps)
    await run.orThrow(
      markPaymentPaidCash({
        paymentId,
        accountId: accounts.cashRegisterAccountId,
        receivedAmount: NonNegativeInteger(receivedAmount),
      })
    )
  }

  const settleByTransfer = async (paymentId: PaymentId) => {
    await using run = testCreateRun(deps)
    await run.orThrow(
      markPaymentPaidIban({ paymentId, accountId: accounts.ibanAccountId })
    )
  }

  const settleWithTransfer = async (paymentId: PaymentId, amount: number) => {
    await using run = testCreateRun(deps)
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId: accounts.ibanAccountId,
        kind: "iban",
        amount: Integer(amount),
        currency: "CZK",
        occurredAt: TimestampMs(clock.date.now().getTime()),
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
  }

  const removeLineOnAnotherDevice = async (billId: BillId, name: string) => {
    await using run = testCreateRun(deps)
    const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
    const removed = summaries.find((summary) => summary.name === name)
    if (removed === undefined) throw new Error(`No line ${name}`)
    await run.ok(
      appendBillLines([
        {
          billId,
          deviceId: null,
          catalogItemId: removed.catalogItemId,
          itemId: removed.itemId,
          type: removed.type,
          kind: "remove",
          quantity: removed.quantity,
          totalAmount: removed.totalAmount,
        },
      ])
    )
  }

  const createOverpaidBill = async (amount: number) => {
    const billId = await createBillOf([
      { name: "Dinner", unitAmount: amount, quantity: 1 },
    ])
    const paymentId = await createTestPayment({ amount, billId })
    await settleInCash(paymentId, amount)
    await settleByTransfer(paymentId)
    return { billId, paymentId }
  }

  const deriveOverpayment = async (scope: OverpaymentScope) => {
    await using run = testCreateRun(deps)
    return deriveBillOverpayment(await run.orThrow(loadOverpaymentInput(scope)))
  }

  return {
    evolu,
    deps,
    clock,
    ...accounts,
    createBillOf,
    createTestPayment,
    settleInCash,
    settleByTransfer,
    settleWithTransfer,
    removeLineOnAnotherDevice,
    createOverpaidBill,
    deriveOverpayment,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

export type OverpaymentContext = Awaited<
  ReturnType<typeof createOverpaymentContext>
>
