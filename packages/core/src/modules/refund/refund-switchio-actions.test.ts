import {
  createIdFromString,
  err,
  ok,
  type Result,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep, UuidDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import {
  createSwitchioUnavailableError,
  interpretSwitchioRefundResult,
  type SwitchioCardPaymentResult,
  type SwitchioCardRefundResult,
  type SwitchioClosureDep,
  type SwitchioReferralRefundRequest,
  type SwitchioRefundDep,
  type SwitchioRefundError,
  type SwitchioReversalRequest,
  type SwitchioTerminalDep,
  type SwitchioTransactionLookup,
} from "../../switchio.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveCardSwitchioAccount } from "../account/account-actions.ts"
import { createCardSwitchioAccountId } from "../account/account-utils.ts"
import { closeCardSwitchioBatch } from "../card-switchio-closure/card-switchio-closure-actions.ts"
import {
  createPayment,
  payPaymentWithSwitchioCard,
} from "../payment/payment-actions.ts"
import { paymentCardSwitchioRefundSourceQuery } from "../payment/payment-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { createRowId } from "../shared/evolu-utils.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import { refundPayment } from "./refund-actions.ts"
import {
  cardSwitchioRefundAttemptsByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "./refund-queries.ts"
import {
  dismissCardSwitchioRefundAttempt,
  resolveCardSwitchioRefundAttempt,
  settleRestoredCardSwitchioRefund,
  startCardSwitchioRefund,
} from "./refund-switchio-actions.ts"

const accountId = createCardSwitchioAccountId("CZK")
const refundId = "123456789012345678"

const approvedPaymentResult: SwitchioCardPaymentResult = {
  responseCode: "OK",
  authCode: "114546",
  sequenceNumber: null,
  maskedPan: null,
  cardLabel: null,
  terminalId: null,
  terminalDateTime: null,
  refundId,
}

const approvedRefundResult: SwitchioCardRefundResult = {
  responseCode: "OK",
  authCode: "223344",
  sequenceNumber: null,
  maskedPan: null,
  terminalDateTime: null,
}
const approvedRefund = ok(approvedRefundResult)

const unreadable = interpretSwitchioRefundResult({
  resultCode: 0,
  transactionResult: null,
})

type Answer = Result<SwitchioCardRefundResult, SwitchioRefundError>

/**
 * A payment of 250 CZK (and `tipAmount`) paid on the SwitchioPay terminal of
 * `chargingDeviceId`, with a terminal that answers refunds from `answers`, in
 * order, and lookups from `lookups`.
 */
const setup = async ({
  tipAmount = 0,
  payment = approvedPaymentResult,
  answers = [],
  lookups = [],
}: {
  readonly tipAmount?: number
  readonly payment?: SwitchioCardPaymentResult
  readonly answers?: ReadonlyArray<Answer>
  readonly lookups?: ReadonlyArray<SwitchioTransactionLookup>
}) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const requests: SwitchioReferralRefundRequest[] = []
  const reversals: SwitchioReversalRequest[] = []
  const looked: string[] = []
  const pendingAnswers = [...answers]
  const pendingLookups = [...lookups]
  let uuid = 0
  const clock = createTestDateDep()
  const deps = {
    ...evoluTestDeps(evolu),
    ...clock,
    uuid: {
      create: () =>
        `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    },
    switchioTerminal: { pay: async () => ok(payment) },
    switchioClosure: {
      close: async () =>
        ok({
          batchNumber: 1,
          shiftNumber: 1,
          debitsCount: 1,
          debitsAmount: 25_000,
          creditsCount: 0,
          creditsAmount: 0,
          adjsCount: 0,
          adjsAmount: 0,
          terminalDateTime: null,
          responseMessage: null,
        }),
    },
    switchioRefund: {
      reverse: async (request) => {
        reversals.push(request)
        return pendingAnswers.shift() ?? unreadable
      },
      referralRefund: async (request) => {
        requests.push(request)
        return pendingAnswers.shift() ?? unreadable
      },
      lookup: async (transactionId) => {
        looked.push(transactionId)
        return pendingLookups.shift() ?? { type: "unknown" }
      },
    },
  } satisfies EvoluDep &
    EvoluOwnerDep &
    DateDep &
    UuidDep &
    SwitchioTerminalDep &
    SwitchioClosureDep &
    SwitchioRefundDep
  const run = testCreateRun(deps)
  await run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
  const deviceId = createRowId<"Device">()
  const paymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId: null,
      tableId: null,
      amount: NonNegativeInteger(25_000 + tipAmount),
      currency: "CZK",
      tipAmount: NonNegativeInteger(tipAmount),
      canceledAt: null,
      expiresAt: null,
    })
  )
  await run.orThrow(
    payPaymentWithSwitchioCard({ paymentId, accountId, deviceId })
  )

  const attempts = () =>
    evolu.loadQuery(cardSwitchioRefundAttemptsByPaymentIdQuery(paymentId))
  const refunds = () => evolu.loadQuery(refundsByPaymentIdQuery(paymentId))
  const refundTransactions = () =>
    evolu.loadQuery(
      createQuery((db) =>
        db
          .selectFrom("accountTransaction")
          .select(["id", "amount", "kind"])
          .where("accountId", "=", accountId)
          .where("amount", "<", 0 as never)
      )
    )

  return {
    run,
    deviceId,
    paymentId,
    requests,
    reversals,
    looked,
    advanceClock: clock.advance,
    attempts,
    refunds,
    refundTransactions,
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("refund to the card through SwitchioPay", () => {
  test("records the refund and the money going out once the terminal approves", async () => {
    await using t = await setup({ answers: [approvedRefund] })

    await expect(
      t.run(
        startCardSwitchioRefund({
          paymentId: t.paymentId,
          deviceId: t.deviceId,
          amount: NonNegativeInteger(10_000),
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })

    expect(t.requests).toEqual([
      {
        transactionId: "00000000-0000-4000-8000-000000000001",
        amount: 10_000,
        currencyCode: 203,
        refundId,
      },
    ])
    await expect(t.refunds()).resolves.toMatchObject([
      {
        amount: 10_000,
        method: "cardSwitchio",
        // EET reports a refund only when it names its device.
        deviceId: t.deviceId,
      },
    ])
    await expect(t.refundTransactions()).resolves.toMatchObject([
      { amount: -10_000, kind: "cardSwitchio" },
    ])
    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)

  test("refunds the tip on its own, under the tip's one id", async () => {
    await using t = await setup({ tipAmount: 2_000, answers: [approvedRefund] })

    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        tip: true,
      })
    )

    await expect(t.refunds()).resolves.toMatchObject([
      {
        id: createIdFromString(`refund:tip:${t.paymentId}`),
        amount: 2_000,
        isTip: 1,
      },
    ])
    expect(t.requests[0]?.amount).toBe(2_000)
  }, 15_000)

  test("a declined refund is kept to be shown and does not block another try", async () => {
    await using t = await setup({
      answers: [
        interpretSwitchioRefundResult({
          resultCode: -1,
          transactionResult: JSON.stringify({
            responseCode: "DECLINED",
            responseMessage: "zamitnuto",
          }),
        }),
        approvedRefund,
      ],
    })
    const start = startCardSwitchioRefund({
      paymentId: t.paymentId,
      deviceId: t.deviceId,
      amount: NonNegativeInteger(5_000),
    })

    const declined = await t.run(start)
    expect(!declined.ok && declined.error).toMatchObject({
      type: "CardSwitchioRefundDeclined",
      responseMessage: "zamitnuto",
    })
    await expect(t.attempts()).resolves.toMatchObject([
      { status: "failed", failureReason: "declined" },
    ])

    await expect(t.run(start)).resolves.toMatchObject({
      ok: true,
      value: { status: "refunded" },
    })
    await expect(t.attempts()).resolves.toEqual([])
    await expect(t.refunds()).resolves.toHaveLength(1)
  }, 15_000)

  test("a refund the terminal never started leaves nothing behind", async () => {
    await using t = await setup({
      answers: [
        interpretSwitchioRefundResult({
          resultCode: 2,
          transactionResult: null,
        }),
        err(createSwitchioUnavailableError({ reason: "notInstalled" })),
      ],
    })
    const start = startCardSwitchioRefund({
      paymentId: t.paymentId,
      deviceId: t.deviceId,
      amount: NonNegativeInteger(5_000),
    })

    const busy = await t.run(start)
    expect(!busy.ok && busy.error.type).toBe("SwitchioRefundNotStarted")
    await expect(t.attempts()).resolves.toEqual([])

    const missing = await t.run(start)
    expect(!missing.ok && missing.error.type).toBe("SwitchioUnavailable")
    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)

  test("an unknown result blocks another refund until staff dismiss it", async () => {
    await using t = await setup({ answers: [unreadable, approvedRefund] })
    const start = startCardSwitchioRefund({
      paymentId: t.paymentId,
      deviceId: t.deviceId,
      amount: NonNegativeInteger(5_000),
    })

    await expect(t.run(start)).resolves.toEqual({
      ok: true,
      value: { status: "unresolved" },
    })
    const [attempt] = await t.attempts()
    expect(attempt?.status).toBe("unknown")

    const blocked = await t.run(start)
    expect(!blocked.ok && blocked.error).toMatchObject({
      type: "CardSwitchioRefundAttemptRunning",
      attemptId: attempt?.id,
    })
    expect(t.requests).toHaveLength(1)

    if (attempt === undefined) throw new Error("no attempt")
    await t.run.ok(dismissCardSwitchioRefundAttempt(attempt.id))
    await expect(t.run(start)).resolves.toMatchObject({
      value: { status: "refunded" },
    })
  }, 15_000)

  test("a pending attempt of another phone can be dismissed", async () => {
    await using t = await setup({})
    // The launching phone died with SwitchioPay open: its attempt stays
    // pending, and only another device can let the payment be refunded.
    const pending = new Promise<Answer>(() => {})
    const run = testCreateRun({
      ...t.run.deps,
      switchioRefund: {
        ...t.run.deps.switchioRefund,
        referralRefund: () => pending,
      },
    })
    void run(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    await expect.poll(() => t.attempts()).toMatchObject([{ status: "pending" }])
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    await t.run.ok(dismissCardSwitchioRefundAttempt(attempt.id))

    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)

  test("refuses a payment the terminal gave no refund id, or one not paid by card", async () => {
    await using t = await setup({
      payment: { ...approvedPaymentResult, refundId: null },
    })

    const result = await t.run(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )

    expect(!result.ok && result.error.type).toBe(
      "CardSwitchioRefundNotAvailable"
    )
    expect(t.requests).toEqual([])
    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)
})

describe("a refund result that comes back later", () => {
  const restoredApproval = (transactionId: string) => ({
    resultCode: -1,
    transactionId,
    transactionResult: JSON.stringify({ transactionId, responseCode: "OK" }),
  })

  const startUnknown = async (t: Awaited<ReturnType<typeof setup>>) => {
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")
    return attempt
  }

  test("is recorded once, however often it is settled", async () => {
    await using t = await setup({ answers: [unreadable] })
    const attempt = await startUnknown(t)

    for (let i = 0; i < 2; i++) {
      await expect(
        t.run(
          settleRestoredCardSwitchioRefund({
            restored: restoredApproval(attempt.transactionId),
          })
        )
      ).resolves.toEqual({ ok: true, value: { status: "refunded" } })
    }

    await expect(t.refunds()).resolves.toHaveLength(1)
    await expect(t.refundTransactions()).resolves.toHaveLength(1)
    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)

  test("is recorded even after staff dismissed its attempt, since the money went back", async () => {
    await using t = await setup({ answers: [unreadable] })
    const attempt = await startUnknown(t)
    await t.run.ok(dismissCardSwitchioRefundAttempt(attempt.id))

    await t.run.orThrow(
      settleRestoredCardSwitchioRefund({
        restored: restoredApproval(attempt.transactionId),
      })
    )

    await expect(t.refunds()).resolves.toMatchObject([
      { amount: 5_000, method: "cardSwitchio", deviceId: t.deviceId },
    ])
  }, 15_000)

  test("of an older attempt is recorded after another one began", async () => {
    await using t = await setup({ answers: [unreadable, unreadable] })
    const first = await startUnknown(t)
    await t.run.ok(dismissCardSwitchioRefundAttempt(first.id))
    const second = await startUnknown(t)
    expect(second.id).not.toBe(first.id)

    await t.run.orThrow(
      settleRestoredCardSwitchioRefund({
        restored: restoredApproval(first.transactionId),
      })
    )

    await expect(t.refunds()).resolves.toHaveLength(1)
    // The second attempt is untouched: its own answer is still to come.
    await expect(t.attempts()).resolves.toMatchObject([
      { id: second.id, status: "unknown" },
    ])
  }, 15_000)

  test("is recorded even when another device refunded part of the payment meanwhile", async () => {
    await using t = await setup({ answers: [unreadable] })
    const attempt = await startUnknown(t)
    // Offline, another device refunded the rest outside the app.
    await t.run.orThrow(
      refundPayment({
        paymentId: t.paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(20_000),
      })
    )

    await t.run.orThrow(
      settleRestoredCardSwitchioRefund({
        restored: restoredApproval(attempt.transactionId),
      })
    )

    const refunds = await t.refunds()
    expect(refunds.reduce((sum, { amount }) => sum + amount, 0)).toBe(25_000)
    expect(refunds.map(({ method }) => method).sort()).toEqual([
      "cardSwitchio",
      "outside",
    ])
  }, 15_000)

  test("refuses a result no attempt was made for", async () => {
    await using t = await setup({})

    const result = await t.run(
      settleRestoredCardSwitchioRefund({
        restored: restoredApproval("unknown"),
      })
    )

    expect(!result.ok && result.error.type).toBe(
      "CardSwitchioRefundAttemptNotFound"
    )
  }, 15_000)
})

describe("asking the terminal what became of a refund", () => {
  test("records an approval the terminal reports", async () => {
    await using t = await setup({
      answers: [unreadable],
      lookups: [
        {
          type: "approved",
          result: approvedRefundResult,
        },
      ],
    })
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    await expect(
      t.run(
        resolveCardSwitchioRefundAttempt({
          attemptId: attempt.id,
          deviceId: t.deviceId,
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })

    expect(t.looked).toEqual([attempt.transactionId])
    await expect(t.refunds()).resolves.toHaveLength(1)
    await expect(t.attempts()).resolves.toEqual([])
  }, 15_000)

  test("keeps a decline the terminal reports as failed", async () => {
    await using t = await setup({
      answers: [unreadable],
      lookups: [{ type: "declined" }],
    })
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    const result = await t.run(
      resolveCardSwitchioRefundAttempt({
        attemptId: attempt.id,
        deviceId: t.deviceId,
      })
    )

    expect(!result.ok && result.error.type).toBe("CardSwitchioRefundDeclined")
    await expect(t.attempts()).resolves.toMatchObject([{ status: "failed" }])
    await expect(t.refunds()).resolves.toEqual([])
  }, 15_000)

  test("turns a pending attempt nothing answers any more into an unknown one", async () => {
    await using t = await setup({})
    const run = testCreateRun({
      ...t.run.deps,
      switchioRefund: {
        ...t.run.deps.switchioRefund,
        referralRefund: () => new Promise<Answer>(() => {}),
      },
    })
    void run(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    await expect.poll(() => t.attempts()).toMatchObject([{ status: "pending" }])
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    await expect(
      t.run(
        resolveCardSwitchioRefundAttempt({
          attemptId: attempt.id,
          deviceId: t.deviceId,
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "unresolved" } })

    await expect(t.attempts()).resolves.toMatchObject([{ status: "unknown" }])
  }, 15_000)

  test("is not asked from a phone whose terminal never saw the refund", async () => {
    await using t = await setup({ answers: [unreadable] })
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(5_000),
      })
    )
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    const result = await t.run(
      resolveCardSwitchioRefundAttempt({
        attemptId: attempt.id,
        deviceId: createRowId<"Device">(),
      })
    )

    expect(!result.ok && result.error.type).toBe(
      "CardSwitchioRefundOtherDevice"
    )
    expect(t.looked).toEqual([])
  }, 15_000)
})

describe("a reversal before the refund to the card (refund/0008)", () => {
  test("takes the whole payment back on the phone that charged it, tip included", async () => {
    await using t = await setup({ tipAmount: 2_000, answers: [approvedRefund] })

    await expect(
      t.run(
        startCardSwitchioRefund({
          paymentId: t.paymentId,
          deviceId: t.deviceId,
          whole: true,
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })

    const [source] = await t.run.deps.evolu.loadQuery(
      paymentCardSwitchioRefundSourceQuery(t.paymentId)
    )
    expect(t.reversals).toEqual([
      {
        transactionId: "00000000-0000-4000-8000-000000000001",
        originalTransactionId: source?.transactionId,
      },
    ])
    expect(t.requests).toEqual([])
    const refunds = await t.refunds()
    expect(
      [...refunds].sort((a, b) => (a.isTip ?? 0) - (b.isTip ?? 0))
    ).toMatchObject([
      {
        id: createIdFromString(`refund:reversal:${t.paymentId}`),
        amount: 25_000,
        isTip: null,
        deviceId: t.deviceId,
      },
      {
        id: createIdFromString(`refund:tip:${t.paymentId}`),
        amount: 2_000,
        isTip: 1,
        deviceId: t.deviceId,
      },
    ])
    const transactions = await t.refundTransactions()
    expect(transactions.map(({ amount }) => amount).sort()).toEqual([
      -2_000, -25_000,
    ])
  }, 15_000)

  test("reverses a refund of every goods amount of a payment without a tip", async () => {
    await using t = await setup({ answers: [approvedRefund] })

    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        amount: NonNegativeInteger(25_000),
      })
    )

    expect(t.reversals).toHaveLength(1)
    expect(t.requests).toEqual([])
  }, 15_000)

  test("two reversals of one payment write one refund of the goods and one of the tip", async () => {
    await using t = await setup({ tipAmount: 2_000, answers: [unreadable] })
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )
    const [first] = await t.attempts()
    if (first === undefined) throw new Error("no attempt")
    await t.run.ok(dismissCardSwitchioRefundAttempt(first.id))
    const run = testCreateRun({
      ...t.run.deps,
      switchioRefund: {
        ...t.run.deps.switchioRefund,
        reverse: async () => approvedRefund,
      },
    })
    await run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )
    // The first one comes back approved too, after all.
    await t.run.orThrow(
      settleRestoredCardSwitchioRefund({
        restored: {
          resultCode: -1,
          transactionId: first.transactionId,
          transactionResult: JSON.stringify({ responseCode: "OK" }),
        },
      })
    )

    await expect(t.refunds()).resolves.toHaveLength(2)
    await expect(t.refundTransactions()).resolves.toHaveLength(2)
  }, 15_000)

  test.each([
    ["only part of the goods goes back", { amount: NonNegativeInteger(5_000) }],
    ["the tip goes back alone", { tip: true as const }],
  ] as const)(
    "refunds to the card when %s",
    async (_, what) => {
      await using t = await setup({
        tipAmount: 2_000,
        answers: [approvedRefund],
      })

      await t.run.orThrow(
        startCardSwitchioRefund({
          paymentId: t.paymentId,
          deviceId: t.deviceId,
          ...what,
        })
      )

      expect(t.reversals).toEqual([])
      expect(t.requests).toHaveLength(1)
    },
    15_000
  )

  test("refunds the whole payment to the card, in one tap, from another phone", async () => {
    await using t = await setup({ tipAmount: 2_000, answers: [approvedRefund] })

    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: createRowId<"Device">(),
        whole: true,
      })
    )

    expect(t.reversals).toEqual([])
    expect(t.requests).toMatchObject([{ amount: 27_000, refundId }])
    const refunds = await t.refunds()
    expect(refunds.map(({ amount }) => amount).sort()).toEqual([2_000, 25_000])
  }, 15_000)

  test("refunds to the card once the charging phone closed its batch", async () => {
    await using t = await setup({ answers: [approvedRefund] })
    t.advanceClock(60_000)
    await t.run.orThrow(closeCardSwitchioBatch({ deviceId: t.deviceId }))

    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )

    expect(t.reversals).toEqual([])
    expect(t.requests).toHaveLength(1)
  }, 15_000)

  test("refunds to the card what is left after an earlier refund", async () => {
    await using t = await setup({ answers: [approvedRefund] })
    await t.run.orThrow(
      refundPayment({
        paymentId: t.paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(5_000),
      })
    )

    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )

    expect(t.reversals).toEqual([])
    expect(t.requests).toMatchObject([{ amount: 20_000 }])
  }, 15_000)

  test("a reversal the terminal declines lets a refund to the card follow", async () => {
    await using t = await setup({
      answers: [
        interpretSwitchioRefundResult({
          resultCode: -1,
          transactionResult: JSON.stringify({
            responseCode: "DECLINED",
            responseMessage: "batch closed",
          }),
        }),
        approvedRefund,
      ],
    })

    const declined = await t.run(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )
    expect(!declined.ok && declined.error).toMatchObject({
      type: "CardSwitchioReversalDeclined",
      responseCode: "DECLINED",
    })
    await expect(t.attempts()).resolves.toMatchObject([{ status: "failed" }])

    await expect(
      t.run(
        startCardSwitchioRefund({
          paymentId: t.paymentId,
          deviceId: t.deviceId,
          whole: true,
          referral: true,
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "refunded" } })
    expect(t.reversals).toHaveLength(1)
    expect(t.requests).toMatchObject([{ amount: 25_000 }])
    await expect(t.refunds()).resolves.toHaveLength(1)
  }, 15_000)

  test("a restored answer that is not a reversal leaves the reversal unknown", async () => {
    await using t = await setup({ answers: [unreadable] })
    await t.run.orThrow(
      startCardSwitchioRefund({
        paymentId: t.paymentId,
        deviceId: t.deviceId,
        whole: true,
      })
    )
    const [attempt] = await t.attempts()
    if (attempt === undefined) throw new Error("no attempt")

    await expect(
      t.run(
        settleRestoredCardSwitchioRefund({
          restored: {
            resultCode: -1,
            transactionId: attempt.transactionId,
            transactionResult: JSON.stringify({
              responseCode: "OK",
              reversal: false,
            }),
          },
        })
      )
    ).resolves.toEqual({ ok: true, value: { status: "unresolved" } })
    await expect(t.refunds()).resolves.toEqual([])
  }, 15_000)
})
