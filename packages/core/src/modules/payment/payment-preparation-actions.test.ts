import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import {
  createYadioApiDep,
  type YadioApiDep,
} from "../../integrations/yadio/yadio-client.ts"
import type { SparkWalletDep } from "../../spark/spark-wallet.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { NonNegativeInteger, VariableSymbol } from "../shared/schema.ts"
import { createPayment, updatePayment } from "./payment-actions.ts"
import {
  createPreparedPayment,
  preparePaymentMethod,
} from "./payment-preparation-actions.ts"
import { paymentByIdQuery } from "./payment-queries.ts"
import { DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS } from "./payment-status-utils.ts"
import {
  createPaymentAccounts,
  paymentWithDetailsByIdQuery,
} from "./payment-test-fixtures.ts"
import type { PaymentId } from "./payment-types.ts"

describe("payment preparation actions", () => {
  test("creates a prepared payment by generating spark payment details", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: "lightning-request-1",
              invoice: {
                encodedInvoice: "lnbc8600n1prepared",
                paymentHash: "payment-hash-1",
              },
              paymentPreimage: "payment-preimage-1",
              sparkInvoice: "spark-invoice-1",
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, sparkAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const idResult = await run(
      createPreparedPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(1_000),
        canceledAt: null,
        cashRegister: {
          accountId: cashRegisterAccountId,
        },
        spark: {
          accountId: sparkAccountId,
          memo: "Payment 129 CZK",
          expirySeconds: 900,
        },
        iban: {
          accountId: ibanAccountId,
          variableSymbol: VariableSymbol("1234567890"),
          specificSymbol: null,
        },
      })
    )

    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    const id = idResult.value
    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          amount: 12_900,
          currency: "CZK",
          tipAmount: 1_000,
          expiresAt: testFixedDate.getTime() + 900_000,
          cashRegister: {
            id,
            accountId: cashRegisterAccountId,
          },
          spark: {
            id,
            accountId: sparkAccountId,
            amountSats: 8_600,
            exchangeRate: 1_500_000,
            exchangeRateSource: "yadio",
            exchangeRateFetchedAt: 1_700_000_000_000,
            lnInvoice: "lnbc8600n1prepared",
            sparkInvoice: "spark-invoice-1",
            lightningReceiveRequestId: "lightning-request-1",
            paymentHash: "payment-hash-1",
            paymentPreimage: "payment-preimage-1",
          },
          iban: {
            id,
            accountId: ibanAccountId,
            variableSymbol: "1234567890",
            specificSymbol: null,
          },
        },
      ])
  }, 15_000)

  test("prepares payment method details lazily for an existing payment", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: "lightning-request-1",
              invoice: {
                encodedInvoice: "lnbc8600n1lazy",
                paymentHash: "payment-hash-1",
              },
              paymentPreimage: "payment-preimage-1",
              sparkInvoice: "spark-invoice-1",
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
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
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          cashRegister: {
            accountId: cashRegisterAccountId,
          },
          bank: {
            accountId: ibanAccountId,
          },
          spark: {
            accountId: sparkAccountId,
            expirySeconds: 1_800,
          },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          // Cash and IBAN never expire, so a payment offering them stays
          // payable however long the Lightning invoice has been dead —
          // `expiresAt` describes the whole payment, not one method of it.
          // See docs/bill-payment-states.md.
          expiresAt: null,
          cashRegister: {
            id,
            accountId: cashRegisterAccountId,
          },
          iban: {
            id,
            accountId: ibanAccountId,
            variableSymbol: "1",
            specificSymbol: "260605",
          },
          spark: {
            id,
            accountId: sparkAccountId,
            amountSats: 8_600,
            exchangeRate: 1_500_000,
            exchangeRateSource: "yadio",
            exchangeRateFetchedAt: 1_700_000_000_000,
            lnInvoice: "lnbc8600n1lazy",
            sparkInvoice: "spark-invoice-1",
          },
        },
      ])
  }, 15_000)

  test("refuses a Lightning invoice for a zero amount, and rounds the smallest chargeable one up to a sat", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const requestedAmountsSats: Array<number | undefined> = []
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({ BTC: 1_500_000, timestamp: 1_700_000_000_000 })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async (input: {
              readonly amountSats?: number
            }) => {
              requestedAmountsSats.push(input.amountSats)
              return {
                id: "lightning-request-1",
                invoice: {
                  encodedInvoice: "lnbc1zero",
                  paymentHash: "payment-hash-1",
                },
                paymentPreimage: "payment-preimage-1",
                sparkInvoice: "spark-invoice-1",
              }
            },
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { sparkAccountId } = await createPaymentAccounts(deps)

    const paymentFor = (amount: number) =>
      run.orThrow(
        createPayment({
          deviceId: null,
          billId: null,
          tableId: null,
          amount: NonNegativeInteger(amount),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )

    // A zero-sat Lightning invoice is an *amountless* one — the payer picks
    // the sum — which on a terminal showing 0 is not something to hand out.
    // `createPayment` creates no payment of nothing (payment/0012), so this
    // is the second line of defence, for one changed afterwards
    // (`updatePayment`) or written by an older app.
    const zeroPaymentId = await paymentFor(100)
    await run.ok(
      updatePayment({ id: zeroPaymentId, amount: NonNegativeInteger(0) })
    )
    await expect(
      run(
        preparePaymentMethod({
          paymentId: zeroPaymentId,
          spark: { accountId: sparkAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "ZeroAmountNotPayable", amount: 0 },
    })
    expect(requestedAmountsSats).toEqual([])

    // One minor unit converts to a fraction of a sat at this rate, and is
    // charged as one sat rather than rounded away to an amountless invoice.
    const smallestPaymentId = await paymentFor(1)
    await expect(
      run(
        preparePaymentMethod({
          paymentId: smallestPaymentId,
          spark: { accountId: sparkAccountId },
        })
      )
    ).resolves.toEqual({ ok: true, value: smallestPaymentId })
    expect(requestedAmountsSats).toEqual([1])
  }, 15_000)

  test("keeps a Lightning payment's expiry in step with the invoice, even when the caller omits expirySeconds", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({ BTC: 1_500_000, timestamp: 1_700_000_000_000 })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: "lightning-request-1",
              invoice: {
                encodedInvoice: "lnbc8600n1expiry",
                paymentHash: "payment-hash-1",
              },
              paymentPreimage: "payment-preimage-1",
              sparkInvoice: "spark-invoice-1",
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { sparkAccountId } = await createPaymentAccounts(deps)

    const expiresAtOf = async (paymentId: PaymentId) =>
      (await evolu.loadQuery(paymentByIdQuery(paymentId)))[0]?.expiresAt

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

    // An explicit, deliberately short window first.
    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          spark: { accountId: sparkAccountId, expirySeconds: 60 },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })
    await expect
      .poll(() => expiresAtOf(id))
      .toBe(testFixedDate.getTime() + 60_000)

    // Re-prepared with no `expirySeconds`: the invoice gets a fresh window
    // regardless, so leaving the old 60-second stamp behind would report a
    // live payment as expired and release the bill's editing lock.
    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          spark: { accountId: sparkAccountId },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })
    await expect
      .poll(() => expiresAtOf(id))
      .toBe(
        testFixedDate.getTime() +
          DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS * 1_000
      )

    // Same for a payment created straight through `createPreparedPayment`
    // without one — the shape `bin/cli-payments.ts` uses. A null `expiresAt`
    // there means the payment never reads as expired and the bill stays
    // locked for good.
    const preparedId = await run.orThrow(
      createPreparedPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        spark: { accountId: sparkAccountId },
      })
    )
    await expect
      .poll(() => expiresAtOf(preparedId))
      .toBe(
        testFixedDate.getTime() +
          DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS * 1_000
      )
  }, 15_000)

  test("preparing cash after Lightning clears the payment's expiry", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: "lightning-request-1",
              invoice: {
                encodedInvoice: "lnbc8600n1switch",
                paymentHash: "payment-hash-1",
              },
              paymentPreimage: "payment-preimage-1",
              sparkInvoice: "spark-invoice-1",
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, sparkAccountId } =
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
      })
    )

    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          spark: { accountId: sparkAccountId, expirySeconds: 900 },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([{ id, expiresAt: testFixedDate.getTime() + 900_000 }])

    // Switching the same payment to cash must not leave the dead invoice's
    // expiry behind: `derivePaymentStatus` would call this live cash payment
    // Expired 15 minutes later and silently release its bill's editing lock.
    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          cashRegister: { accountId: cashRegisterAccountId },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          expiresAt: null,
          cashRegister: { id, accountId: cashRegisterAccountId },
        },
      ])
  }, 15_000)

  test("preparing Lightning after cash leaves the payment unexpiring", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: "lightning-request-1",
              invoice: {
                encodedInvoice: "lnbc8600n1alongside",
                paymentHash: "payment-hash-1",
              },
              paymentPreimage: "payment-preimage-1",
              sparkInvoice: "spark-invoice-1",
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, sparkAccountId } =
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
      })
    )

    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          cashRegister: { accountId: cashRegisterAccountId },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    // The other direction from "preparing cash after Lightning": the cash
    // drawer is already persisted and this call does not mention it, so the
    // invoice's window is the only one in this call's hands — and it must
    // still not become the payment's, because the drawer stays payable after
    // the invoice dies. This is the one branch where the answer comes purely
    // from `paymentNonExpiringMethodsByIdQuery`, the already-stored methods,
    // rather than from what the caller just prepared.
    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          spark: { accountId: sparkAccountId, expirySeconds: 900 },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          expiresAt: null,
          cashRegister: { id, accountId: cashRegisterAccountId },
          spark: { id, lnInvoice: "lnbc8600n1alongside" },
        },
      ])
  }, 15_000)

  test("prepares Spark payment method when optional Spark SDK fields are null", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => ({
              id: null,
              invoice: {
                encodedInvoice: "lnbc8600n1nullable",
                paymentHash: null,
              },
              paymentPreimage: null,
              sparkInvoice: null,
            }),
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { sparkAccountId } = await createPaymentAccounts(deps)
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

    await expect(
      run(
        preparePaymentMethod({
          paymentId: id,
          spark: {
            accountId: sparkAccountId,
          },
        })
      )
    ).resolves.toEqual({ ok: true, value: id })

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(id)))
      .toMatchObject([
        {
          id,
          spark: {
            id,
            accountId: sparkAccountId,
            lnInvoice: "lnbc8600n1nullable",
            sparkInvoice: null,
            lightningReceiveRequestId: null,
            paymentHash: null,
            paymentPreimage: null,
          },
        },
      ])
  }, 15_000)

  test("preparePaymentMethod refuses each method against a missing or wrong-currency account", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      // Spark and Yadio are wired up but never reached: every case below
      // fails its account check first.
      fetch: async () =>
        new Response(
          JSON.stringify({ BTC: 1_500_000, timestamp: 1_700_000_000_000 })
        ),
      sparkWallet: { create: async () => createFakeSparkWallet({}) },
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      SparkWalletDep &
      FetchDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, ibanAccountId, sparkAccountId } =
      await createPaymentAccounts(deps)

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

    // Each method reports its own not-found error for an account of the wrong
    // kind, and its own `accountKind` on a currency mismatch. These are the
    // branches `preparePaymentMethod` propagates out of three concurrent
    // preparations, so they are worth pinning before that plumbing moves.
    await expect(
      run(
        preparePaymentMethod({
          paymentId: czkPaymentId,
          bank: { accountId: cashRegisterAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "IbanAccountNotFound", id: cashRegisterAccountId },
    })
    await expect(
      run(
        preparePaymentMethod({
          paymentId: czkPaymentId,
          cashRegister: { accountId: ibanAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "CashRegisterAccountNotFound", id: ibanAccountId },
    })
    await expect(
      run(
        preparePaymentMethod({
          paymentId: eurPaymentId,
          bank: { accountId: ibanAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "AccountCurrencyMismatch", accountKind: "iban" },
    })
    await expect(
      run(
        preparePaymentMethod({
          paymentId: eurPaymentId,
          cashRegister: { accountId: cashRegisterAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "AccountCurrencyMismatch", accountKind: "cashRegister" },
    })
    await expect(
      run(
        preparePaymentMethod({
          paymentId: czkPaymentId,
          spark: { accountId: cashRegisterAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "AccountSparkNotFound", id: cashRegisterAccountId },
    })

    // Requesting no method at all is a no-op success, not a failure.
    await expect(
      run(preparePaymentMethod({ paymentId: czkPaymentId }))
    ).resolves.toEqual({ ok: true, value: czkPaymentId })

    // A refusal writes nothing: the spark account is real, so this proves the
    // failures above short-circuited before the mutation batch.
    expect(sparkAccountId).toBeDefined()
    await expect(
      evolu.loadQuery(
        createQuery((db) => db.selectFrom("paymentIban").select(["id"]))
      )
    ).resolves.toEqual([])
    await expect(
      evolu.loadQuery(
        createQuery((db) => db.selectFrom("paymentCashRegister").select(["id"]))
      )
    ).resolves.toEqual([])
  }, 15_000)

  test("preparePaymentMethod refuses a bank method for a payment whose number hasn't synced", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      // `preparePaymentMethod` declares these even for a bank-only call.
      fetch: async () => new Response("{}"),
      sparkWallet: { create: async () => createFakeSparkWallet({}) },
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      SparkWalletDep &
      FetchDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { ibanAccountId } = await createPaymentAccounts(deps)

    // Written directly rather than through `createPayment`, which always
    // writes the `paymentNumber` in the same batch: this is the CRDT shape
    // where the payment row arrived from another device before its number
    // did. The IBAN method needs that number for the variable symbol.
    const orphanPaymentId = createRowId<"Payment">()
    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "payment",
        {
          id: orphanPaymentId,
          deviceId: null,
          billId: null,
          tableId: null,
          amount: NonNegativeInteger(1_000),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          confirmedPaidAt: null,
          excessAcknowledgedAt: null,
          expiresAt: null,
        },
        { ...options, owner: evolu.appOwner }
      )
    )

    await expect(
      run(
        preparePaymentMethod({
          paymentId: orphanPaymentId,
          bank: { accountId: ibanAccountId },
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "PaymentNumberNotFound", paymentId: orphanPaymentId },
    })
  }, 15_000)

  test("createPreparedPayment leaves expiresAt null when no spark method is involved", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      evolu,
      fetch: async () =>
        new Response(
          JSON.stringify({
            BTC: 1_500_000,
            timestamp: 1_700_000_000_000,
          })
        ),
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async () => {
              throw new Error("Should not be called without a spark method")
            },
          }),
      },
      evoluOwner: evolu.appOwner,
      ...createTestDateDep(),
      ...createYadioApiDep(),
    } satisfies EvoluDep &
      EvoluOwnerDep &
      DateDep &
      FetchDep &
      SparkWalletDep &
      YadioApiDep
    await using run = testCreateRun(deps)
    const { cashRegisterAccountId, ibanAccountId } =
      await createPaymentAccounts(deps)

    const idResult = await run(
      createPreparedPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        cashRegister: { accountId: cashRegisterAccountId },
        iban: {
          accountId: ibanAccountId,
          variableSymbol: VariableSymbol("1234567890"),
          specificSymbol: null,
        },
      })
    )
    expect(idResult.ok).toBe(true)
    if (!idResult.ok) return

    await expect
      .poll(() => evolu.loadQuery(paymentWithDetailsByIdQuery(idResult.value)))
      .toMatchObject([{ id: idResult.value, expiresAt: null }])
  }, 15_000)
})
