import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createAccount } from "../account/account-actions.ts"
import { createAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import { addManualAmountToBill, createBill } from "../bill/bill-actions.ts"
import { eetPaymentsToReportQuery } from "../eet/eet-queries.ts"
import { configureEet, createEetTestContext } from "../eet/eet-test-fixtures.ts"
import { reconcileAccountTransaction } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  VariableSymbol,
} from "../shared/schema.ts"
import { upsertBillSelfPayReferences } from "./table-self-pay-actions.ts"
import { deriveBillSelfPayReference } from "./table-self-pay-reference-utils.ts"

const openEetSelfPayBill = async (
  context: Awaited<ReturnType<typeof createEetTestContext>>
) => {
  await configureEet(context)
  await using run = testCreateRun(context.deps)
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )
  const billId = await run.ok(
    createBill({
      deviceId: context.deviceId,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId: null,
      currency: "CZK",
    })
  )
  await run.orThrow(
    addManualAmountToBill({
      billId,
      deviceId: context.deviceId,
      totalAmount: NonNegativeInteger(25_000),
      name: NonEmptyString255("Menu"),
      currency: "CZK",
    })
  )
  const reference = deriveBillSelfPayReference(billId)
  await runMutationWithCompletion((options) =>
    upsertBillSelfPayReferences(context.deps.evolu, [{ billId, reference }], {
      ...options,
      owner: context.deps.evoluOwner,
    })
  )
  const receiveTransfer = async (amount: number) => {
    await using transferRun = testCreateRun(context.deps)
    const accountTransactionId = await transferRun.ok(
      createAccountTransaction({
        accountId,
        amount: Integer(amount),
        currency: "CZK",
        occurredAt: context.clock.date.now().getTime(),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
        iban: {
          variableSymbol: VariableSymbol(reference),
          constantSymbol: null,
          specificSymbol: null,
          bankReference: NonEmptyString255("bank-reference-1"),
        },
      })
    )
    return await transferRun.ok(
      reconcileAccountTransaction(accountTransactionId)
    )
  }
  return { receiveTransfer }
}

describe("self-pay in EET", () => {
  test("two devices recording one arrival yield one sale, reported by the device that opened the bill", async () => {
    await using context = await createEetTestContext()
    const { receiveTransfer } = await openEetSelfPayBill(context)

    const firstDevice = await receiveTransfer(25_000)
    context.clock.advance(60_000)
    const secondDevice = await receiveTransfer(25_000)

    expect(secondDevice).toBe(firstDevice)
    expect(
      await context.deps.evolu.loadQuery(eetPaymentsToReportQuery)
    ).toMatchObject([
      {
        id: firstDevice,
        paymentDeviceId: context.deviceId,
        firstClaimDeviceId: null,
        amount: 25_000,
      },
    ])
  })

  test("money too small to match a bill is never reported", async () => {
    await using context = await createEetTestContext()
    const { receiveTransfer } = await openEetSelfPayBill(context)

    expect(await receiveTransfer(40)).toBe(null)
    expect(
      await context.deps.evolu.loadQuery(eetPaymentsToReportQuery)
    ).toEqual([])
  })
})
