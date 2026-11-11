import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { writeCashuDefaultMint } from "../../cashu/cashu-mints.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import {
  createCashuTest,
  testCashuMasterKey,
  testMintUrl,
} from "../../testing/cashu.ts"
import { saveCashuAccount } from "../account/account-actions.ts"
import { MintUrl } from "../cashu/cashu-types.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import { createPayment, updatePayment } from "./payment-actions.ts"
import {
  prepareCashuPaymentMethod,
  preparePaymentMethod,
} from "./payment-preparation-actions.ts"
import { createPaymentAccounts } from "./payment-test-fixtures.ts"
import type { PaymentId } from "./payment-types.ts"

const otherMint = MintUrl("https://other.mint.test")

const setup = async () => {
  const t = await createCashuTest({ extraMints: [{ url: otherMint }] })
  const deps = {
    ...t.deps,
    // Yadio: 1 BTC = 1 500 000 CZK, so 129 CZK is 8 600 sats.
    fetch: async () =>
      new Response(
        JSON.stringify({ BTC: 1_500_000, timestamp: 1_700_000_000_000 })
      ),
    ...createYadioApiDep(),
    masterKey: testCashuMasterKey,
    date: { now: () => new Date() },
    sparkWallet: {
      create: async () =>
        createFakeSparkWallet({
          createLightningInvoice: async () => ({
            id: "lightning-request-1",
            invoice: {
              encodedInvoice: "lnbc8600n1spark",
              paymentHash: "payment-hash-1",
            },
            paymentPreimage: "payment-preimage-1",
            sparkInvoice: "spark-invoice-1",
          }),
        }),
    },
  }
  await using run = testCreateRun(deps)
  const cashuAccountId = await run.ok(saveCashuAccount({ enabled: true }))
  if (cashuAccountId === null) throw new Error("no Cashu account")
  // Queued after the seed `saveCashuAccount` started: the fake mint is default.
  await writeCashuDefaultMint(deps.cashuShardStore, testMintUrl)
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
  return { t, deps, cashuAccountId, paymentId }
}

const paymentRowsQuery = (id: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .leftJoin("paymentCashu", "paymentCashu.id", "payment.id")
      .leftJoin("paymentBtc", "paymentBtc.id", "payment.id")
      .select([
        "payment.expiresAt",
        "paymentCashu.amountSats as cashuSats",
        "paymentCashu.mintUrl",
        "paymentCashu.quoteId",
        "paymentCashu.lnInvoice",
        "paymentCashu.quoteExpiresAt",
        "paymentCashu.receiveOperationId",
        "paymentBtc.amountSats as sparkSats",
        "paymentBtc.accountId as sparkAccountId",
      ])
      .where("payment.id", "=", id)
  )

describe("prepareCashuPaymentMethod", () => {
  test("quotes the default mint, writes the topup, the paymentCashu row and the payment's expiry", async () => {
    const { t, deps, cashuAccountId, paymentId } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)

    const result = await run(
      prepareCashuPaymentMethod({ paymentId, accountId: cashuAccountId })
    )

    expect(result.ok).toBe(true)
    const [row] = await deps.evolu.loadQuery(paymentRowsQuery(paymentId))
    expect(row).toMatchObject({
      cashuSats: 8_600,
      mintUrl: testMintUrl,
      receiveOperationId: null,
    })
    expect(row?.lnInvoice?.startsWith("lnbc86000n")).toBe(true)
    expect(row?.expiresAt).toBe(row?.quoteExpiresAt)
    const [operation] = await deps.cashuShardStore.loadOperations()
    expect(operation).toMatchObject({
      kind: "topup",
      status: "pending",
      quoteId: row?.quoteId,
      amount: 8_600,
      keysetId: t.mint.keysetId,
    })
  })

  test("uses the default mint Linky synced", async () => {
    const { t, deps, cashuAccountId, paymentId } = await setup()
    await using _ = t
    await writeCashuDefaultMint(deps.cashuShardStore, otherMint)
    await using run = testCreateRun(deps)

    await run(
      prepareCashuPaymentMethod({ paymentId, accountId: cashuAccountId })
    )

    const [row] = await deps.evolu.loadQuery(paymentRowsQuery(paymentId))
    expect(row?.mintUrl).toBe(otherMint)
  })

  test("leaves Spark's rows alone when both are prepared", async () => {
    const { t, deps, cashuAccountId, paymentId } = await setup()
    await using _ = t
    const { sparkAccountId } = await createPaymentAccounts(deps)
    await using run = testCreateRun(deps)
    await run.orThrow(
      preparePaymentMethod({ paymentId, spark: { accountId: sparkAccountId } })
    )
    const [before] = await deps.evolu.loadQuery(paymentRowsQuery(paymentId))

    await run.orThrow(
      prepareCashuPaymentMethod({ paymentId, accountId: cashuAccountId })
    )

    const [after] = await deps.evolu.loadQuery(paymentRowsQuery(paymentId))
    expect(after?.sparkSats).toBe(before?.sparkSats)
    expect(after?.sparkAccountId).toBe(sparkAccountId)
    expect(after?.cashuSats).toBe(8_600)
  })

  test("refuses a payment of nothing", async () => {
    const { t, deps, cashuAccountId } = await setup()
    await using _ = t
    await using run = testCreateRun(deps)
    // `createPayment` creates no payment of nothing (payment/0012); one
    // changed afterwards, or written by an older app, still reaches here.
    const zero = await run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(100),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )
    await run.ok(updatePayment({ id: zero, amount: NonNegativeInteger(0) }))
    const result = await run(
      prepareCashuPaymentMethod({ paymentId: zero, accountId: cashuAccountId })
    )
    expect(!result.ok && result.error.type).toBe("ZeroAmountNotPayable")
  })
})
