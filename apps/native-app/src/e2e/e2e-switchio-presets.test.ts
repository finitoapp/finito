import {
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentResult,
  interpretSwitchioRefundResult,
  interpretSwitchioReversalResult,
  interpretSwitchioTransactionLookup,
  SwitchioNativeClosureResultSchema,
  SwitchioNativePayResultSchema,
} from "@payky/core/switchio"
import { describe, expect, test, vi } from "vitest"
import type { PaykySwitchioNativeModule } from "../platform/switchio.ts"

const e2eBuild = vi.hoisted(() => ({ enabled: true }))

// A build with no native module, as the web export is.
vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }))
vi.mock("../core/native-env.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/native-env.ts")>()
  return {
    ...actual,
    nativeEnv: new Proxy(actual.nativeEnv, {
      get: (target, key) =>
        key === "EXPO_PUBLIC_PAYKY_E2E"
          ? e2eBuild.enabled
          : Reflect.get(target, key),
    }),
  }
})

const { createE2eSwitchioModule, e2eSwitchioTerminal, setE2eSwitchioScenario } =
  await import("./e2e-switchio-presets.ts")
const switchio = await import("../platform/switchio.ts")

type Scenario = Parameters<typeof createE2eSwitchioModule>[0]["scenario"]

/** A fake terminal whose scenario a test can change between launches. */
const createTerminal = () => {
  const state: { scenario: ReturnType<Scenario> } = { scenario: "approved" }
  const module = createE2eSwitchioModule({
    scenario: () => state.scenario,
    now: () => new Date(2026, 10, 13, 14, 39, 37),
  })
  return { state, module }
}

const pay = async (
  module: PaykySwitchioNativeModule,
  transactionId: string,
  amount = 12_900,
  tipAmount = 1_000
) => {
  const raw = SwitchioNativePayResultSchema.parse(
    await module.pay(transactionId, amount, tipAmount, 203, null, "a1")
  )
  module.acknowledgeResult(transactionId)
  return raw
}

const lookup = async (
  module: PaykySwitchioNativeModule,
  transactionId: string
) =>
  interpretSwitchioTransactionLookup({
    transactionId,
    ...SwitchioNativeClosureResultSchema.parse(
      await module.lookupTransaction(transactionId)
    ),
  })

const close = async (module: PaykySwitchioNativeModule) => {
  const raw = SwitchioNativeClosureResultSchema.parse(
    await module.close("closure-1", "a1")
  )
  module.acknowledgeClosureResult()
  return interpretSwitchioClosureResult(raw)
}

/** The approved payment's `refundId`, as core reads it. */
const refundIdOf = (raw: {
  readonly resultCode: number
  readonly transactionResult: string | null
}) => {
  const result = interpretSwitchioPaymentResult(raw)
  if (!result.ok || result.value.refundId === null)
    throw new Error("Not approved")
  return result.value.refundId
}

describe("the fake SwitchioPay's raw results read as their scenario says", () => {
  test("approved: the card is charged, with a refund id of 18 digits", async () => {
    const { module } = createTerminal()

    const raw = await pay(module, "t1")

    expect(raw.transactionId).toBe("t1")
    expect(interpretSwitchioPaymentResult(raw)).toEqual({
      ok: true,
      value: {
        responseCode: "OK",
        authCode: "115001",
        sequenceNumber: "000001001",
        maskedPan: e2eSwitchioTerminal.maskedPan,
        cardLabel: "VISA",
        terminalId: "N92-0001",
        terminalDateTime: "Nov 13, 2026 14:39:37",
        refundId: "424242000000001001",
      },
    })
    expect(await lookup(module, "t1")).toMatchObject({
      type: "approved",
      reversed: false,
    })
  })

  test("declined: a decline, never an unknown outcome", async () => {
    const { state, module } = createTerminal()
    state.scenario = "declined"

    const result = interpretSwitchioPaymentResult(await pay(module, "t1"))

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      responseCode: "DECLINED",
    })
  })

  test.each([
    "unknown",
    "cancelled",
    "unknown-then-approved",
    "unknown-then-not-found",
  ] as const)("%s: a payment of unknown outcome", async (scenario) => {
    const { state, module } = createTerminal()
    state.scenario = scenario

    const result = interpretSwitchioPaymentResult(await pay(module, "t1"))

    expect(!result.ok && result.error.type).toBe("SwitchioResultUnreadable")
  })

  test("unknown-then-approved: get_transaction finds the charge", async () => {
    const { state, module } = createTerminal()
    state.scenario = "unknown-then-approved"
    await pay(module, "t1")

    expect(await lookup(module, "t1")).toMatchObject({ type: "approved" })
  })

  test("unknown-then-not-found: get_transaction finds nothing", async () => {
    const { state, module } = createTerminal()
    state.scenario = "unknown-then-not-found"
    await pay(module, "t1")

    const answer = await module.lookupTransaction("t1")

    expect(answer).toMatchObject({
      resultCode: -1,
      transactionResult: expect.stringContaining("Transaction not found"),
    })
    expect(await lookup(module, "t1")).toEqual({ type: "unknown" })
  })

  test("busy: a payment fails, a closure says busy, a refund never started", async () => {
    const { state, module } = createTerminal()
    await pay(module, "t1")
    state.scenario = "busy"

    const payment = interpretSwitchioPaymentResult(await pay(module, "t2"))
    expect(!payment.ok && payment.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      resultCode: 2,
    })
    const closure = await close(module)
    expect(!closure.ok && closure.error).toMatchObject({
      type: "SwitchioClosureFailed",
      busy: true,
    })
    const refund = interpretSwitchioRefundResult(
      SwitchioNativePayResultSchema.parse(
        await module.reversal("r1", "t1", "a1")
      )
    )
    expect(!refund.ok && refund.error.type).toBe("SwitchioRefundNotStarted")
  })

  test.each([
    ["launch-refused", "SWITCHIO_LAUNCH_REFUSED"],
    ["not-installed", "SWITCHIO_NOT_INSTALLED"],
  ] as const)(
    "%s: every launch is rejected with %s",
    async (scenario, code) => {
      const { state, module } = createTerminal()
      state.scenario = scenario

      await expect(
        module.pay("t1", 100, 0, 203, null, "a1")
      ).rejects.toMatchObject({ code })
      await expect(module.close("c1", "a1")).rejects.toMatchObject({ code })
      await expect(module.lookupTransaction("t1")).rejects.toMatchObject({
        code,
      })
      expect(module.peekStoredResult()).toBeNull()
      expect(module.isInstalled()).toBe(scenario !== "not-installed")
    }
  )

  test("restored-approved: the promise is lost and the approval waits in the store", async () => {
    const { state, module } = createTerminal()
    state.scenario = "restored-approved"

    await expect(
      module.pay("t1", 100, 0, 203, null, "a1")
    ).rejects.toMatchObject({ code: "E2E_SWITCHIO_PROMISE_LOST" })

    const stored = SwitchioNativePayResultSchema.parse(
      module.peekStoredResult()
    )
    expect(module.peekStoredResult()).toMatchObject({ accountId: "a1" })
    expect(stored.transactionId).toBe("t1")
    expect(interpretSwitchioPaymentResult(stored).ok).toBe(true)
    module.acknowledgeResult("another")
    expect(module.peekStoredResult()).not.toBeNull()
    module.acknowledgeResult("t1")
    expect(module.peekStoredResult()).toBeNull()
  })

  test("a reversal takes the payment back, and get_transaction says it is reversed", async () => {
    const { module } = createTerminal()
    await pay(module, "t1")

    const reversal = interpretSwitchioReversalResult(
      SwitchioNativePayResultSchema.parse(
        await module.reversal("r1", "t1", "a1")
      )
    )

    expect(reversal.ok).toBe(true)
    expect(await lookup(module, "t1")).toMatchObject({
      type: "approved",
      reversed: true,
    })
    // As on a device: the reversal is not found by its own id.
    expect(await lookup(module, "r1")).toEqual({ type: "unknown" })
    // A second reversal of the same payment is declined.
    const again = interpretSwitchioReversalResult(
      SwitchioNativePayResultSchema.parse(
        await module.reversal("r2", "t1", "a1")
      )
    )
    expect(!again.ok && again.error.type).toBe("SwitchioRefundFailed")
  })

  test("reversal-declined: a decline, and the payment reads as not reversed", async () => {
    const { state, module } = createTerminal()
    await pay(module, "t1")
    state.scenario = "reversal-declined"

    const reversal = interpretSwitchioReversalResult(
      SwitchioNativePayResultSchema.parse(
        await module.reversal("r1", "t1", "a1")
      )
    )

    expect(!reversal.ok && reversal.error.type).toBe("SwitchioRefundFailed")
    expect(await lookup(module, "t1")).toMatchObject({
      type: "approved",
      reversed: false,
    })
  })

  test("a payment of a closed batch cannot be reversed, only refunded", async () => {
    const { module } = createTerminal()
    const refundId = refundIdOf(await pay(module, "t1"))
    await close(module)

    const reversal = interpretSwitchioReversalResult(
      SwitchioNativePayResultSchema.parse(
        await module.reversal("r1", "t1", "a1")
      )
    )
    expect(!reversal.ok && reversal.error.type).toBe("SwitchioRefundFailed")

    const refund = interpretSwitchioRefundResult(
      SwitchioNativePayResultSchema.parse(
        await module.referralRefund("r2", 5_000, 203, refundId, "a1")
      )
    )
    expect(refund.ok).toBe(true)
    expect(await lookup(module, "r2")).toMatchObject({ type: "approved" })
  })

  test("a referral refund is declined past what the payment charged, or for an unknown refund id", async () => {
    const { module } = createTerminal()
    const refundId = refundIdOf(await pay(module, "t1", 1_000, 0))

    for (const [amount, id] of [
      [1_001, refundId],
      [100, "999999999999999999"],
    ] as const) {
      const refund = interpretSwitchioRefundResult(
        SwitchioNativePayResultSchema.parse(
          await module.referralRefund("r1", amount, 203, id, "a1")
        )
      )
      expect(!refund.ok && refund.error.type).toBe("SwitchioRefundFailed")
    }
  })

  test("refund-unknown: no data, but get_transaction finds the refund approved", async () => {
    const { state, module } = createTerminal()
    const refundId = refundIdOf(await pay(module, "t1"))
    state.scenario = "refund-unknown"

    const raw = SwitchioNativePayResultSchema.parse(
      await module.referralRefund("r1", 5_000, 203, refundId, "a1")
    )

    const refund = interpretSwitchioRefundResult(raw)
    expect(!refund.ok && refund.error.type).toBe("SwitchioResultUnreadable")
    // Kept for the restore path until it is acknowledged.
    expect(module.peekStoredRefundResult()).toMatchObject({
      transactionId: "r1",
    })
    expect(await lookup(module, "r1")).toMatchObject({ type: "approved" })
  })

  test("a closure sums the batch since the last one", async () => {
    const { module } = createTerminal()
    const refundId = refundIdOf(await pay(module, "t1", 12_900, 1_000))
    await pay(module, "t2", 5_000, 0)
    await pay(module, "t3", 2_000, 0)
    await module.reversal("r1", "t3", "a1")
    await module.referralRefund("r2", 3_000, 203, refundId, "a1")

    expect(await close(module)).toEqual({
      ok: true,
      value: {
        shiftNumber: 1,
        batchNumber: 1,
        debitsCount: 2,
        debitsAmount: 18_900,
        creditsCount: 1,
        creditsAmount: 3_000,
        adjsCount: 0,
        adjsAmount: 0,
        terminalDateTime: "Nov 13, 2026 14:39:37",
        responseMessage: "Batch closed",
      },
    })
    expect(await close(module)).toMatchObject({
      ok: true,
      value: { batchNumber: 2, debitsCount: 0, debitsAmount: 0 },
    })
  })

  test("closure-unknown: an unknown outcome, and the batch stays open", async () => {
    const { state, module } = createTerminal()
    await pay(module, "t1", 1_000, 0)
    state.scenario = "closure-unknown"

    const unknown = await close(module)
    expect(!unknown.ok && unknown.error.type).toBe("SwitchioResultUnreadable")

    state.scenario = "approved"
    expect(await close(module)).toMatchObject({
      ok: true,
      value: { batchNumber: 1, debitsCount: 1, debitsAmount: 1_000 },
    })
  })
})

describe("in an e2e build the fake stands in for the missing native module", () => {
  test("only while a scenario is on", async () => {
    expect(switchio.isSwitchioSupported()).toBe(false)

    setE2eSwitchioScenario("approved")
    expect(switchio.isSwitchioSupported()).toBe(true)
    expect(switchio.isSwitchioInstalled()).toBe(true)
    const { switchioTerminal } = switchio.createSwitchioTerminalDep({
      demo: false,
      accountId: "a1",
    })
    const result = await switchioTerminal.pay({
      transactionId: "t1",
      amount: 100,
      tipAmount: 0,
      currencyCode: 203,
    })
    expect(result).toMatchObject({
      ok: true,
      value: { terminalId: "N92-0001" },
    })

    setE2eSwitchioScenario("not-installed")
    expect(switchio.isSwitchioInstalled()).toBe(false)

    setE2eSwitchioScenario(null)
    expect(switchio.isSwitchioSupported()).toBe(false)
  })

  test("never outside one", () => {
    e2eBuild.enabled = false
    setE2eSwitchioScenario("approved")
    expect(switchio.isSwitchioSupported()).toBe(false)
    e2eBuild.enabled = true
  })
})
