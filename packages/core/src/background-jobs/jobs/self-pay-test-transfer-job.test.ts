import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createQuery } from "../../evolu/schema.ts"
import { loadBillStatus } from "../../modules/bill/bill-guards.ts"
import { deriveSelfPaySelectionKey } from "../../modules/shared/key-derivation.ts"
import {
  type FiatCurrency,
  NonEmptyStringSchema,
  PositiveInteger,
  VariableSymbol,
} from "../../modules/shared/schema.ts"
import {
  formatSelfPayBankMessage,
  type SelfPayPointer,
} from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  type SelfPayTestContext,
  selectSelfPayTestShare,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import { createSelfPayTestTransferEvent } from "../../modules/table-self-pay/table-self-pay-test-transfer-utils.ts"
import { recordSelfPayTestTransfers } from "./self-pay-test-transfer-job.ts"

const accountTransactionsQuery = createQuery((db) =>
  db
    .selectFrom("accountTransaction")
    .select(["accountId", "amount"])
    .where("isDeleted", "is not", 1)
)

const sendTestTransfer = async (
  context: SelfPayTestContext,
  {
    amount,
    reference,
    pointer,
    currency = "CZK",
  }: {
    readonly amount: number
    readonly reference: string
    readonly pointer: SelfPayPointer
    readonly currency?: FiatCurrency
  }
) => {
  await context.deps.nostrRelayClient.publish(
    context.deps.selfPayDefaultRelays,
    createSelfPayTestTransferEvent({
      transfer: {
        amount: PositiveInteger(amount),
        currency,
        variableSymbol: VariableSymbol(reference),
        recipientMessage: NonEmptyStringSchema.decode(
          formatSelfPayBankMessage({ pointer })
        ),
      },
      selectionKey: deriveSelfPaySelectionKey(context.deps.tableSelfPayRoot),
      createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
    })
  )
}

const checkTestTransfers = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  await run.ok(recordSelfPayTestTransfers)
}

describe("recordSelfPayTestTransfers", () => {
  test("credits the bill a test transfer names, as the same bank transfer would", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    await sendTestTransfer(context, { amount: 45_000, reference, pointer })

    await checkTestTransfers(context)

    expect(
      await context.deps.evolu.loadQuery(accountTransactionsQuery)
    ).toEqual([{ accountId: context.ibanAccountId, amount: 45_000 }])
    await using run = testCreateRun(context.deps)
    expect(await run.orThrow(loadBillStatus(billId))).toBe("closed")
  })

  test("books a test transfer once, however often the till looks", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    await sendTestTransfer(context, { amount: 20_000, reference, pointer })

    await checkTestTransfers(context)
    await checkTestTransfers(context)

    expect(
      await context.deps.evolu.loadQuery(accountTransactionsQuery)
    ).toHaveLength(1)
  })

  test("leaves a test transfer in another currency than the bank account's alone", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 45_000 }],
    })
    const { pointer } = await selectSelfPayTestShare(context, reference)
    await sendTestTransfer(context, {
      amount: 45_000,
      reference,
      pointer,
      currency: "EUR",
    })

    await checkTestTransfers(context)

    expect(
      await context.deps.evolu.loadQuery(accountTransactionsQuery)
    ).toEqual([])
  })
})
