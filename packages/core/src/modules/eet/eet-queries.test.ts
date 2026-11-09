import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createRowId } from "../shared/evolu-utils.ts"
import { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import {
  createEetReversal,
  createEetSale,
  deliverEetReversal,
  deliverEetSale,
  disableEet,
} from "./eet-actions.ts"
import {
  eetExtraClaimsQuery,
  eetPaymentsToReportQuery,
  eetReversalByRefundIdQuery,
  eetReversalsByPaymentIdQuery,
  eetSaleByIdQuery,
  eetSalesToDeliverQuery,
  unconfirmedEetReversalsQuery,
  unconfirmedEetSalesQuery,
} from "./eet-queries.ts"
import {
  configureEet,
  createEetTestContext,
  createTestPayment,
  type EetTestContext,
  settleByTransfer,
  settleInCash,
} from "./eet-test-fixtures.ts"

const createSale = async (
  context: EetTestContext,
  {
    currency = "CZK",
    deviceId = context.deviceId,
  }: {
    readonly currency?: "CZK" | "EUR"
    readonly deviceId?: EetTestContext["deviceId"]
  } = {}
) => {
  await using run = testCreateRun(context.deps)
  const saleId = await run.ok(
    createEetSale({
      payment: {
        id: createRowId<"Payment">(),
        billId: null,
        amount: NonNegativeInteger(25_000),
        tipAmount: NonNegativeInteger(0),
        cashReceivedAmount: null,
        currency,
        method: "cashRegister",
        firstClaimedAt: TimestampMs(context.clock.date.now().getTime()),
        firstClaimTransactionId: createRowId<"AccountTransaction">(),
        firstSettlementValue: NonNegativeInteger(25_000),
      },
      deviceId,
    })
  )
  if (saleId === null) throw new Error("Expected a created sale.")
  return saleId
}

describe("eetPaymentsToReportQuery", () => {
  test("lists settled payments of every device since EET was enabled", async () => {
    await using context = await createEetTestContext()
    const before = await createTestPayment(context)
    await settleInCash(context, before)
    context.clock.advance(1_000)
    await configureEet(context)
    context.clock.advance(1_000)
    const settled = await createTestPayment(context, { tipAmount: 2_000 })
    await settleInCash(context, settled, { receivedAmount: 26_000 })
    const unsettled = await createTestPayment(context)
    const phoneDeviceId = createRowId<"Device">()
    const takenOnPhone = await createTestPayment(context, {
      deviceId: phoneDeviceId,
    })
    await settleInCash(context, takenOnPhone)

    const rows = await context.deps.evolu.loadQuery(eetPaymentsToReportQuery)

    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          id: settled,
          billId: null,
          amount: 25_000,
          tipAmount: 2_000,
          currency: "CZK",
          paymentDeviceId: context.deviceId,
          cashReceivedAmount: 26_000,
          enabledAt: context.clock.date.now().getTime() - 1_000,
          firstClaimedAt: context.clock.date.now().getTime(),
          firstClaimDeviceId: context.deviceId,
          method: "cashRegister",
          firstClaimTransactionId: expect.any(String),
          firstClaimAmount: 25_000,
          firstClaimCurrency: "CZK",
          paymentAmountSats: null,
        },
        expect.objectContaining({
          id: takenOnPhone,
          paymentDeviceId: phoneDeviceId,
          firstClaimDeviceId: context.deviceId,
        }),
      ])
    )
    expect(rows.map(({ id }) => id)).not.toContain(unsettled)
  })

  test("drops a payment once its sale record exists", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    const [row] = await context.deps.evolu.loadQuery(eetPaymentsToReportQuery)
    if (row === undefined) throw new Error("Expected a payment to report.")
    await using run = testCreateRun(context.deps)

    await run.ok(
      createEetSale({
        payment: { ...row, firstSettlementValue: row.amount },
        deviceId: context.deviceId,
      })
    )

    await expect
      .poll(() => context.deps.evolu.loadQuery(eetPaymentsToReportQuery))
      .toEqual([])
  })
})

describe("eetSalesToDeliverQuery and unconfirmedEetSalesQuery", () => {
  test("separate what may still be sent from what staff must see", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const pending = await createSale(context)
    const confirmed = await createSale(context)
    const rejected = await createSale(context)
    const unsupported = await createSale(context, { currency: "EUR" })
    const otherDeviceId = createRowId<"Device">()
    const otherDevice = await createSale(context, { deviceId: otherDeviceId })
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: confirmed, deviceId: context.deviceId })
    )
    context.responder.answerNext({ type: "error", code: 4, message: "Refused" })
    await run.orThrow(
      deliverEetSale({ id: rejected, deviceId: context.deviceId })
    )

    await expect
      .poll(async () =>
        (await context.deps.evolu.loadQuery(eetSalesToDeliverQuery)).map(
          ({ id, deviceId }) => ({ id, deviceId })
        )
      )
      .toEqual([
        { id: pending, deviceId: context.deviceId },
        { id: otherDevice, deviceId: otherDeviceId },
      ])
    const unconfirmed = await context.deps.evolu.loadQuery(
      unconfirmedEetSalesQuery
    )
    expect(new Set(unconfirmed.map(({ id }) => id))).toEqual(
      new Set([pending, rejected, unsupported, otherDevice])
    )
  })
})

describe("unconfirmedEetReversalsQuery", () => {
  test("lists a reversal until it is confirmed, also one never sent", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSale(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    const [sale] = await context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId))
    if (sale === undefined) throw new Error("Expected a created sale.")
    const reverse = async () => {
      const reversalId = await run.ok(
        createEetReversal({
          refund: {
            id: createRowId<"Refund">(),
            paymentId: sale.paymentId,
            amount: NonNegativeInteger(5_000),
            cashHandedAmount: null,
            isTip: null,
            refundedAt: TimestampMs(context.clock.date.now().getTime()),
            saleId,
          },
          deviceId: context.deviceId,
        })
      )
      if (reversalId === null) throw new Error("Expected a reversal.")
      return reversalId
    }
    const pending = await reverse()
    const confirmed = await reverse()

    await run.orThrow(
      deliverEetReversal({ id: confirmed, deviceId: context.deviceId })
    )
    await run.ok(disableEet())
    context.clock.advance(1_000)
    const neverSent = await reverse()

    expect(
      (await context.deps.evolu.loadQuery(unconfirmedEetReversalsQuery)).map(
        ({ id }) => id
      )
    ).toEqual([neverSent, pending])
  })
})

describe("eetReversalByRefundIdQuery", () => {
  test("finds the reversal of one refund, the row the payment's list holds", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const saleId = await createSale(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      deliverEetSale({ id: saleId, deviceId: context.deviceId })
    )
    const [sale] = await context.deps.evolu.loadQuery(eetSaleByIdQuery(saleId))
    if (sale === undefined) throw new Error("Expected a created sale.")
    const reverse = async () => {
      const refundId = createRowId<"Refund">()
      const reversalId = await run.ok(
        createEetReversal({
          refund: {
            id: refundId,
            paymentId: sale.paymentId,
            amount: NonNegativeInteger(5_000),
            cashHandedAmount: null,
            isTip: null,
            refundedAt: TimestampMs(context.clock.date.now().getTime()),
            saleId,
          },
          deviceId: context.deviceId,
        })
      )
      if (reversalId === null) throw new Error("Expected a reversal.")
      return { refundId, reversalId }
    }
    const { refundId: first } = await reverse()
    const { refundId: second, reversalId } = await reverse()
    await run.orThrow(
      deliverEetReversal({ id: reversalId, deviceId: context.deviceId })
    )

    const byPayment = await context.deps.evolu.loadQuery(
      eetReversalsByPaymentIdQuery(sale.paymentId)
    )
    const [reversal] = await context.deps.evolu.loadQuery(
      eetReversalByRefundIdQuery(second)
    )
    expect(reversal).toEqual(
      byPayment.find(({ refundId }) => refundId === second)
    )
    expect(reversal).toMatchObject({
      refundId: second,
      pok: expect.any(String),
    })
    await expect(
      context.deps.evolu.loadQuery(eetReversalByRefundIdQuery(first))
    ).resolves.toMatchObject([{ refundId: first, pok: null }])
    await expect(
      context.deps.evolu.loadQuery(
        eetReversalByRefundIdQuery(createRowId<"Refund">())
      )
    ).resolves.toEqual([])
  })
})

describe("eetExtraClaimsQuery", () => {
  test("lists every claim of a payment that may have received more than its amount", async () => {
    await using context = await createEetTestContext()
    await configureEet(context)
    const settledTwice = await createTestPayment(context)
    await settleInCash(context, settledTwice)
    await settleByTransfer(context, settledTwice)
    const overpaid = await createTestPayment(context)
    await settleByTransfer(context, overpaid, { amount: 30_000 })
    const settledOnce = await createTestPayment(context)
    await settleInCash(context, settledOnce)

    const claims = await context.deps.evolu.loadQuery(eetExtraClaimsQuery)
    const byPaymentThenAmount = (
      left: { readonly paymentId: string; readonly amount: number },
      right: { readonly paymentId: string; readonly amount: number }
    ) =>
      left.paymentId.localeCompare(right.paymentId) ||
      left.amount - right.amount

    expect(
      claims
        .map(({ paymentId, amount }) => ({ paymentId, amount }))
        .toSorted(byPaymentThenAmount)
    ).toEqual(
      [
        { paymentId: settledTwice, amount: 25_000 },
        { paymentId: settledTwice, amount: 25_000 },
        { paymentId: overpaid, amount: 30_000 },
      ].toSorted(byPaymentThenAmount)
    )
    expect(claims.every(({ reportedExtra }) => reportedExtra === null)).toBe(
      true
    )
  })

  test("lists nothing while EET is disabled", async () => {
    await using context = await createEetTestContext()
    await configureEet(context, { enabled: false })
    const paymentId = await createTestPayment(context)
    await settleInCash(context, paymentId)
    await settleByTransfer(context, paymentId)

    await expect(
      context.deps.evolu.loadQuery(eetExtraClaimsQuery)
    ).resolves.toEqual([])
  })
})
