import {
  type ConsoleDep,
  type LockManagerDep,
  ok,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { addDays, addMinutes, format, startOfDay, subDays } from "date-fns"
import { z } from "zod"
import { bookCashuOperations } from "../cashu/cashu-booking.ts"
import { MAIN_MINT_URL, writeCashuDefaultMint } from "../cashu/cashu-mints.ts"
import type { CashuShardStoreDep } from "../cashu/cashu-shard-store.ts"
import { claimCashuTopup } from "../cashu/cashu-topup.ts"
import {
  type CashuWalletDep,
  createCashuWalletDep,
} from "../cashu/cashu-wallet.ts"
import { createFakeCashuMint } from "../cashu/fake-cashu-mint.ts"
import type { EvoluOwnerDep, MasterKeyDep, UuidDep } from "../deps.ts"
import type { DeviceLanguage } from "../evolu/device-client.ts"
import { createFakeLightningAddressWallet } from "../integrations/lnurl/fake-lightning-address-wallet.ts"
import {
  createQerkoApiDep,
  type QerkoApiDep,
} from "../integrations/qerko/qerko-client.ts"
import type { YadioApiDep } from "../integrations/yadio/yadio-client.ts"
import {
  saveCardSwitchioAccount,
  saveCashRegisterAccount,
  saveCashuAccount,
  saveFiatBankAccount,
  saveLightningAddressAccount,
  saveQerkoTerminalAccount,
  saveSparkAccount,
} from "../modules/account/account-actions.ts"
import { createAccountTransaction } from "../modules/account-transaction/account-transaction-actions.ts"
import {
  completeOnboarding,
  updateSettings,
} from "../modules/app-settings/app-settings-actions.ts"
import { PaymentMethodOrderJson } from "../modules/app-settings/app-settings-utils.ts"
import {
  addCatalogItemToBill,
  createBill,
} from "../modules/bill/bill-actions.ts"
import type { BillId } from "../modules/bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../modules/bill-line/bill-line-actions.ts"
import { deriveBillSummaryTotal } from "../modules/bill-line/bill-line-utils.ts"
import { createCatalogCategoryAtEnd } from "../modules/catalog-category/catalog-category-actions.ts"
import { createCatalogItemAtEnd } from "../modules/catalog-item/catalog-item-actions.ts"
import type { CatalogItemId } from "../modules/catalog-item/catalog-item-types.ts"
import { registerDevice } from "../modules/device/device-actions.ts"
import type { DeviceId } from "../modules/device/device-types.ts"
import { setLegalEntity } from "../modules/legal-entity/legal-entity-actions.ts"
import {
  cancelPayment,
  markPaymentPaidCash,
  markPaymentPaidIban,
  payPaymentWithSwitchioCard,
} from "../modules/payment/payment-actions.ts"
import { roundCashAmount } from "../modules/payment/payment-cash-utils.ts"
import { syncLightningAddressPayment } from "../modules/payment/payment-lightning-address-actions.ts"
import {
  createPreparedPayment,
  prepareCashuPaymentMethod,
  preparePaymentMethod,
} from "../modules/payment/payment-preparation-actions.ts"
import { startQerkoTerminalPayment } from "../modules/payment/payment-qerko-actions.ts"
import {
  paymentLightningAddressByIdQuery,
  paymentSparkDetailsByIdQuery,
} from "../modules/payment/payment-queries.ts"
import type { PaymentId } from "../modules/payment/payment-types.ts"
import { saveQerkoPlugin } from "../modules/qerko-plugin/qerko-plugin-actions.ts"
import { reconcileAccountTransaction } from "../modules/reconciliation-claim/reconciliation-claim-actions.ts"
import { refundPayment } from "../modules/refund/refund-actions.ts"
import type { DeviceEvoluDep, EvoluDep } from "../modules/shared/evolu-deps.ts"
import { createRowId } from "../modules/shared/evolu-utils.ts"
import {
  BankAccountInputIbanSchema,
  type FiatCurrency,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMsSchema,
} from "../modules/shared/schema.ts"
import { createTableAtEnd } from "../modules/table/table-actions.ts"
import type { TableId } from "../modules/table/table-types.ts"
import { seedTaxRatesForCountry } from "../modules/tax-rate/tax-rate-actions.ts"
import type { TaxRateId } from "../modules/tax-rate/tax-rate-types.ts"
import type { SparkWalletDep } from "../spark/spark-wallet.ts"
import { createFakeSparkWallet } from "../spark/spark-wallet-test-fixtures.ts"
import type { SwitchioTerminalDep } from "../switchio.ts"
import {
  type DemoCategory,
  demoCategories,
  demoDeviceNames,
  demoTables,
} from "./demo-data-content.ts"

/**
 * Fills a demo account with a café's last `days` days (demo-data/0001):
 * catalog, tables, devices, every payment method, tips, cancellations,
 * refunds, and the bills still open right now. EET stays off: a demo account
 * has no business reporting sales, not even to the playground.
 *
 * Every write goes through the same domain Tasks the UI uses, at a simulated
 * time: `evolu.setMutationBackdate` (an Evolu patch) stamps `createdAt` in
 * the past and the fake `date` dep agrees with it, so the history reads like
 * one the app recorded itself. The outside services those Tasks call — the
 * exchange rate, the Spark wallet, the card terminal — are fakes that
 * answer from here, so nothing leaves the device.
 */

const currency: FiatCurrency = "CZK"
/** A sample IBAN the e2e tests use too; it belongs to no real customer. */
const demoIban = BankAccountInputIbanSchema.parse("CZ6508000000192000145399")

const minute = 60_000
const second = 1000

/** Mulberry32: a small seeded PRNG, so a seed reproduces a whole history. */
const createRandom = (seed: number) => {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1))
  const chance = (probability: number) => next() < probability
  const weighted = <T>(
    entries: ReadonlyArray<T>,
    weight: (entry: T) => number
  ): T => {
    const total = entries.reduce((sum, entry) => sum + weight(entry), 0)
    let threshold = next() * total
    for (const entry of entries) {
      threshold -= weight(entry)
      if (threshold < 0) return entry
    }
    const last = entries.at(-1)
    if (last === undefined) throw new Error("Nothing to pick from.")
    return last
  }
  /** Box–Muller, for arrival times bunched around the rush hours. */
  const normal = (mean: number, deviation: number) =>
    mean +
    deviation *
      Math.sqrt(-2 * Math.log(1 - next())) *
      Math.cos(2 * Math.PI * next())
  const hex = (length: number) =>
    Array.from({ length }, () => int(0, 15).toString(16)).join("")

  return { next, int, chance, weighted, normal, hex }
}

/** Relative traffic, Monday first, as `Date#getDay` is shifted below. */
const weekdayTraffic = [0.7, 0.85, 0.9, 1, 1.2, 1.35, 1.1] as const

/** Minutes after midnight: rush hours as a mixture of normal distributions. */
const rushHours = [
  { mean: 9 * 60, deviation: 70, weight: 0.35 },
  { mean: 12 * 60 + 30, deviation: 60, weight: 0.35 },
  { mean: 17 * 60 + 30, deviation: 100, weight: 0.3 },
] as const
const openingMinute = 7 * 60 + 30
const closingMinute = 21 * 60 + 30

const dayPartOf = (minuteOfDay: number) =>
  minuteOfDay < 11 * 60 ? "morning" : minuteOfDay < 15 * 60 ? "noon" : "evening"

type PaymentMethod =
  | "cash"
  | "card"
  | "qerko"
  | "iban"
  | "spark"
  | "cashu"
  | "lightningAddress"

const paymentMethodWeights = {
  cash: 0.43,
  card: 0.2,
  qerko: 0.15,
  iban: 0.1,
  spark: 0.06,
  cashu: 0.04,
  lightningAddress: 0.02,
} satisfies Record<PaymentMethod, number>

/** The café's own wallet: `wallet.example` is a reserved, unreachable domain. */
const demoLightningAddress = NonEmptyString255("cafe@wallet.example")

interface CatalogEntry {
  readonly id: CatalogItemId
  readonly category: DemoCategory
  readonly popularity: number
}

interface PlannedGuest {
  /** Minutes after midnight, which decide what the guest orders. */
  readonly arrival: number
  readonly at: number
  readonly kind: "table" | "counter" | "keypad"
  readonly table: { readonly id: TableId; readonly patio: boolean } | null
  readonly duration: number
  readonly groupSize: number
  readonly secondRound: boolean
  readonly keypadAmount: number
  /** How long after paying the guest comes back for a refund, if ever. */
  readonly refundAfter: number | null
  readonly billNumber: number | null
}

interface Step {
  readonly at: number
  readonly run: () => Promise<void>
}

export type DemoDataDeps = EvoluDep &
  EvoluOwnerDep &
  MasterKeyDep &
  ConsoleDep &
  DeviceEvoluDep &
  LockManagerDep &
  CashuShardStoreDep &
  CashuWalletDep

export const generateDemoData =
  ({
    language,
    now,
    days = 90,
    customersPerDay = 50,
    seed = Date.now(),
    onProgress,
    shouldStop,
  }: {
    readonly language: DeviceLanguage
    /** History ends a quarter of an hour before this. */
    readonly now: Date
    readonly days?: number
    readonly customersPerDay?: number
    readonly seed?: number
    /** First called with `done` 0 once the account is set up and onboarded. */
    readonly onProgress?: (done: number, total: number) => void
    /** Asked after each day; `true` ends the history there. */
    readonly shouldStop?: () => boolean
  }): Task<
    { readonly payments: number; readonly days: number },
    never,
    DemoDataDeps
  > =>
  async (run) => {
    const random = createRandom(seed)
    const { evolu, console } = run.deps
    const historyEnd = now.getTime() - 15 * minute
    const firstDay = startOfDay(subDays(now, days - 1))

    // Widened: `Date#getTime` is branded `TimestampMs` here.
    let simulatedNow: number = addMinutes(firstDay, 7 * 60).getTime()
    /** Never back within a day: a step that ran long delays the next one. */
    const setTime = (at: number) => {
      simulatedNow = Math.max(simulatedNow, at)
      evolu.setMutationBackdate(simulatedNow)
    }
    const advance = (milliseconds: number) => {
      setTime(simulatedNow + milliseconds)
    }

    // A random walk around a plausible CZK price of one bitcoin.
    const btcRateByDay: Array<number> = []
    for (let day = 0, rate = 2_300_000; day < days; day++) {
      btcRateByDay.push(Math.round(rate))
      rate *= 1 + (random.next() - 0.5) * 0.04
    }
    const btcRate = () =>
      btcRateByDay[
        Math.min(
          days - 1,
          Math.max(
            0,
            Math.floor((simulatedNow - firstDay.getTime()) / (24 * 60 * minute))
          )
        )
      ] ?? 2_300_000

    // `Response.json` is missing from React Native's `Response`.
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      })

    const demoWallet = createFakeLightningAddressWallet({
      address: demoLightningAddress,
      now: () => simulatedNow,
    })

    const fakeServices: SparkWalletDep &
      YadioApiDep &
      QerkoApiDep &
      UuidDep &
      SwitchioTerminalDep & { readonly fetch: typeof globalThis.fetch } = {
      fetch: async (input, init) => {
        const url =
          input instanceof Request ? input.url : new URL(String(input)).href
        if (url.includes("/exrates/")) {
          return jsonResponse({ BTC: btcRate(), timestamp: simulatedNow })
        }
        const walletResponse = await demoWallet.fetch(url)
        if (walletResponse !== null) return walletResponse
        // The Qerko terminal approves every payment for the amount asked.
        if (url.endsWith("/create-terminal-payment")) {
          const body = JSON.parse(String(init?.body)) as {
            readonly transactionId: string
            readonly amount: string
          }
          return jsonResponse({
            type: "started",
            payment: {
              status: "approved",
              transactionId: body.transactionId,
              currency,
              amount: body.amount,
              chargedAmount: body.amount,
              chargedTipAmount: "0",
              authorizationCode: String(random.int(100_000, 999_999)),
              card: {
                brand: random.weighted(["VISA", "MASTERCARD"], () => 1),
                maskedPan: `************${random.int(1000, 9999)}`,
                entryMode: "contactless",
              },
              receipt: {
                merchantId: "DEMO",
                terminalId: "PAYKY002",
                sequenceNumber: String(random.int(1000, 9999)),
                terminalDateTime: format(simulatedNow, "yyyy-MM-dd'T'HH:mm:ss"),
                refundId: crypto.randomUUID(),
              },
            },
          })
        }
        throw new Error(`Demo data reaches no network: ${url}`)
      },
      yadioApi: { baseUrl: "https://api.yadio.io" },
      ...createQerkoApiDep({ posId: "demo" }),
      uuid: { create: () => crypto.randomUUID() },
      sparkWallet: {
        create: async () =>
          createFakeSparkWallet({
            createLightningInvoice: async ({ amountSats }) => ({
              id: crypto.randomUUID(),
              invoice: {
                encodedInvoice: `lnbc${amountSats}n1p${random.hex(180)}`,
                paymentHash: random.hex(64),
              },
              sparkInvoice: null,
            }),
          }),
      },
      switchioTerminal: {
        pay: async () =>
          ok({
            responseCode: "00",
            authCode: String(random.int(100_000, 999_999)),
            sequenceNumber: String(random.int(1000, 9999)),
            maskedPan: `${random.weighted(["4", "5"], () => 1)}${random.int(10_000, 99_999)}******${random.int(1000, 9999)}`,
            cardLabel: random.weighted(
              ["VISA", "MASTERCARD", "MAESTRO"],
              () => 1
            ),
            terminalId: "PAYKY001",
            terminalDateTime: format(simulatedNow, "yyyy-MM-dd'T'HH:mm:ss"),
            // 18 digits, as a referral refund wants it.
            refundId: `${random.int(100_000_000, 999_999_999)}${random.int(100_000_000, 999_999_999)}`,
          }),
      },
    }

    // The demo's mint: the same keys as the one a demo account gets at
    // runtime (`cashuWalletDepAtom`), so its proofs stay valid there.
    const demoMint = createFakeCashuMint({
      url: MAIN_MINT_URL,
      now: () => simulatedNow,
    })

    await using demoRun = run.create({
      ...run.deps,
      ...fakeServices,
      ...createCashuWalletDep({
        seed: run.deps.cashuWallet.seed,
        deviceAccountId: run.deps.cashuWallet.deviceAccountId,
        fetch: demoMint.fetch,
      }),
      date: { now: () => new Date(simulatedNow) },
    })

    const required = <T>(value: T | null, what: string): T => {
      if (value === null) throw new Error(`Demo data could not create ${what}.`)
      return value
    }

    try {
      setTime(simulatedNow)

      // The café as it was set up on the first day.
      const devices: Array<DeviceId> = []
      for (const name of demoDeviceNames) {
        const id = createRowId<"Device">()
        await demoRun.ok(
          registerDevice({
            id,
            name: NonEmptyString255(name[language]),
            deviceType: null,
            browserName: null,
            osName: null,
          })
        )
        devices.push(id)
        advance(random.int(20, 90) * second)
      }
      const [counterDevice, floorDevice, patioDevice] = devices
      if (
        counterDevice === undefined ||
        floorDevice === undefined ||
        patioDevice === undefined
      ) {
        throw new Error("Demo data needs three devices.")
      }

      await demoRun.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
      const [standardRate, reducedRate] = await demoRun.ok(
        seedTaxRatesForCountry("CZ")
      )
      const taxRateIds = {
        standard: required(standardRate ?? null, "the standard tax rate"),
        reduced: required(reducedRate ?? null, "the reduced tax rate"),
      } satisfies Record<DemoCategory["taxRate"], TaxRateId>

      const cashAccount = required(
        await demoRun.ok(saveCashRegisterAccount({ enabled: true, currency })),
        "the cash register"
      )
      const bankAccount = required(
        await demoRun.ok(
          saveFiatBankAccount({ enabled: true, iban: demoIban, currency })
        ),
        "the bank account"
      )
      const sparkAccount = required(
        await demoRun.ok(saveSparkAccount({ enabled: true })),
        "the Spark account"
      )
      const cardAccount = required(
        await demoRun.ok(saveCardSwitchioAccount({ enabled: true, currency })),
        "the card terminal account"
      )
      // Paired with a fictional company, so the terminal method is on.
      await demoRun.ok(
        saveQerkoPlugin({
          role: "terminalPayments",
          environment: "sandbox",
          apiKey: NonEmptyStringSchema.decode("demo-key"),
          apiKeyName: NonEmptyString255("Payky"),
          legalEntityName: NonEmptyString255("Demo Café"),
          identificationNumber: NonEmptyString255("12345678"),
          country: "CZ",
        })
      )
      const qerkoAccount = required(
        await demoRun.ok(saveQerkoTerminalAccount({ enabled: true, currency })),
        "the Qerko terminal account"
      )
      const cashuAccount = required(
        await demoRun.ok(saveCashuAccount({ enabled: true })),
        "the Cashu account"
      )
      await writeCashuDefaultMint(run.deps.cashuShardStore, MAIN_MINT_URL)
      const lightningAddressAccount = required(
        await demoRun.ok(
          saveLightningAddressAccount({
            enabled: true,
            address: demoLightningAddress,
          })
        ),
        "the Lightning address account"
      )
      await demoRun.orThrow(
        completeOnboarding({
          fiatCurrency: currency,
          defaultPaymentMethod: "cashRegister",
          paymentMethodOrderJson: z.encode(PaymentMethodOrderJson, [
            "cashRegister",
            "cardSwitchio",
            "qerkoTerminal",
            "iban",
            "spark",
            "cashu",
            "lightningAddress",
          ]),
        })
      )
      await demoRun.ok(updateSettings({ tipsEnabled: sqliteTrue }))
      advance(4 * minute)

      const catalog: Array<CatalogEntry> = []
      for (const category of demoCategories) {
        const categoryId = await demoRun.ok(
          createCatalogCategoryAtEnd({
            deviceId: counterDevice,
            name: NonEmptyString255(category.name[language]),
          })
        )
        for (const entry of category.items) {
          const id = await demoRun.ok(
            createCatalogItemAtEnd({
              deviceId: counterDevice,
              categoryId,
              name: NonEmptyString255(entry.name[language]),
              description: null,
              internalName: null,
              internalDescription: null,
              sku: null,
              currency,
              unitAmount: NonNegativeInteger(entry.price * 100),
              scanCode: null,
              taxRateId: taxRateIds[category.taxRate],
            })
          )
          catalog.push({ id, category, popularity: entry.popularity })
          advance(random.int(15, 60) * second)
        }
      }

      const tables: Array<{ readonly id: TableId; readonly patio: boolean }> =
        []
      for (const [index, table] of demoTables.entries()) {
        const id = await demoRun.ok(
          createTableAtEnd({
            deviceId: counterDevice,
            name: NonEmptyString255(table.name[language]),
            seatCount: PositiveInteger(table.seatCount),
          })
        )
        tables.push({ id, patio: index >= demoTables.length - 2 })
        advance(random.int(10, 30) * second)
      }

      const pickItem = (minuteOfDay: number) => {
        const part = dayPartOf(minuteOfDay)
        const category = random.weighted(
          demoCategories,
          (entry) => entry.dayParts[part]
        )
        return random.weighted(
          catalog.filter((entry) => entry.category === category),
          (entry) => entry.popularity
        )
      }

      const addItems = async (
        billId: BillId,
        deviceId: DeviceId,
        count: number,
        minuteOfDay: number
      ) => {
        for (let index = 0; index < count; index++) {
          await demoRun.orThrow(
            addCatalogItemToBill({
              billId,
              deviceId,
              catalogItemId: pickItem(minuteOfDay).id,
              quantity: PositiveNumber(random.chance(0.15) ? 2 : 1),
            })
          )
          advance(random.int(3, 12) * second)
        }
      }

      const settle = async (
        paymentId: PaymentId,
        method: PaymentMethod,
        amount: NonNegativeInteger,
        deviceId: DeviceId
      ) => {
        switch (method) {
          // Cash and card skip `preparePaymentMethod`: marking a payment
          // paid writes the same method row, and every write batch is an
          // OPFS commit of about 20 ms, which is what generation waits on.
          case "cash": {
            advance(random.int(20, 70) * second)
            const least = roundCashAmount({ amount, currency })
            const note = random.weighted(
              [10_000, 20_000, 50_000, 100_000],
              () => 1
            )
            await demoRun.orThrow(
              markPaymentPaidCash({
                paymentId,
                accountId: cashAccount,
                deviceId,
                receivedAmount: random.chance(0.6)
                  ? least
                  : NonNegativeInteger(Math.ceil(least / note) * note),
              })
            )
            return
          }
          case "card": {
            advance(random.int(25, 55) * second)
            await demoRun.orThrow(
              payPaymentWithSwitchioCard({
                paymentId,
                accountId: cardAccount,
                deviceId,
              })
            )
            return
          }
          case "qerko": {
            await demoRun.orThrow(
              preparePaymentMethod({
                paymentId,
                qerkoTerminal: { accountId: qerkoAccount },
              })
            )
            advance(random.int(25, 55) * second)
            await demoRun.orThrow(
              startQerkoTerminalPayment({
                paymentId,
                accountId: qerkoAccount,
                terminalId: NonEmptyString255("demo-terminal"),
                deviceId,
              })
            )
            return
          }
          case "iban": {
            await demoRun.orThrow(
              preparePaymentMethod({
                paymentId,
                bank: { accountId: bankAccount },
              })
            )
            advance(random.int(60, 240) * second)
            await demoRun.orThrow(
              markPaymentPaidIban({
                paymentId,
                accountId: bankAccount,
                deviceId,
              })
            )
            return
          }
          case "spark": {
            await settleSpark(paymentId)
            return
          }
          case "cashu": {
            await settleCashu(paymentId)
            return
          }
          case "lightningAddress": {
            await settleLightningAddress(paymentId, deviceId)
            return
          }
        }
      }

      /** The customer pays the café's wallet; the verify poll's half follows. */
      const settleLightningAddress = async (
        paymentId: PaymentId,
        deviceId: DeviceId
      ) => {
        await demoRun.orThrow(
          preparePaymentMethod({
            paymentId,
            lightningAddress: { accountId: lightningAddressAccount },
          })
        )
        advance(random.int(15, 45) * second)
        const [detail] = await evolu.loadQuery(
          paymentLightningAddressByIdQuery(paymentId)
        )
        if (detail === undefined || !demoWallet.pay(detail.lnInvoice)) {
          throw new Error(
            `Demo Lightning address payment ${paymentId} was not prepared.`
          )
        }
        await demoRun.orThrow(
          syncLightningAddressPayment({ paymentId, deviceId })
        )
      }

      /** The customer pays the mint's invoice; the Cashu job's half follows. */
      const settleCashu = async (paymentId: PaymentId) => {
        await demoRun.orThrow(
          prepareCashuPaymentMethod({ paymentId, accountId: cashuAccount })
        )
        advance(random.int(15, 45) * second)
        const pending = (
          await run.deps.cashuShardStore.loadOperations()
        ).filter(
          (operation) =>
            operation.kind === "topup" && operation.status === "pending"
        )
        for (const operation of pending) {
          if (operation.quoteId === null) continue
          demoMint.payMintQuote(operation.quoteId)
          await demoRun.orThrow(claimCashuTopup(operation.id))
        }
        await demoRun.ok(bookCashuOperations)
      }

      const prepareSpark = async (paymentId: PaymentId) =>
        await demoRun.orThrow(
          preparePaymentMethod({
            paymentId,
            spark: { accountId: sparkAccount },
          })
        )

      /** The wallet sync job's half: the transfer arrives and is matched. */
      const settleSpark = async (paymentId: PaymentId) => {
        await prepareSpark(paymentId)
        advance(random.int(15, 45) * second)
        const [details] = await evolu.loadQuery(
          paymentSparkDetailsByIdQuery(paymentId)
        )
        if (details === undefined) {
          throw new Error(`Demo Spark payment ${paymentId} was not prepared.`)
        }
        const transactionId = await demoRun.ok(
          createAccountTransaction({
            accountId: sparkAccount,
            amount: details.amountSats,
            currency: "BTC",
            occurredAt: TimestampMsSchema.decode(simulatedNow),
            note: null,
            internalTransferGroupId: null,
            source: { deviceId: null, source: "auto" },
            spark: {
              sparkTransferId: NonEmptyStringSchema.decode(crypto.randomUUID()),
              ...(details.lnInvoice === null
                ? {}
                : {
                    lightning: {
                      lnInvoice: NonEmptyStringSchema.decode(details.lnInvoice),
                      preImage: null,
                      paymentHash: null,
                    },
                  }),
            },
          })
        )
        await demoRun.ok(reconcileAccountTransaction(transactionId))
      }

      let payments = 0

      const pay = async ({
        billId,
        deviceId,
        keypadAmount,
        tipChance,
      }: {
        readonly billId: BillId | null
        readonly deviceId: DeviceId
        readonly keypadAmount: number
        readonly tipChance: number
      }): Promise<{
        readonly paymentId: PaymentId
        readonly method: PaymentMethod
        readonly amount: NonNegativeInteger
        readonly tipAmount: NonNegativeInteger
      }> => {
        const total =
          billId === null
            ? keypadAmount
            : deriveBillSummaryTotal(
                await demoRun.ok(loadCalculatedBillLineSummaries(billId))
              )
        // A tip rounds the bill up to the next fifty or hundred crowns.
        const roundTo = random.chance(0.5) ? 5000 : 10_000
        const tipAmount = NonNegativeInteger(
          random.chance(tipChance)
            ? Math.ceil((total + 1) / roundTo) * roundTo - total
            : 0
        )
        const amount = NonNegativeInteger(total + tipAmount)
        const create = async () =>
          await demoRun.orThrow(
            createPreparedPayment({
              deviceId,
              billId,
              tableId: null,
              amount,
              currency,
              tipAmount,
              canceledAt: null,
            })
          )

        let method = random.weighted(
          Object.keys(paymentMethodWeights) as Array<PaymentMethod>,
          (key) => paymentMethodWeights[key]
        )
        // Now and then the guest wanted to pay in bitcoin, gave up, and paid
        // by card instead: a canceled payment next to the paid one.
        if (random.chance(0.02)) {
          const abandoned = await create()
          await prepareSpark(abandoned)
          advance(random.int(40, 120) * second)
          await demoRun.orThrow(cancelPayment(abandoned))
          advance(random.int(5, 20) * second)
          method = "card"
        }

        const paymentId = await create()
        advance(random.int(3, 10) * second)
        await settle(paymentId, method, amount, deviceId)
        payments += 1

        return { paymentId, method, amount, tipAmount }
      }

      const refundLater = (
        steps: Array<Step>,
        at: number,
        payment: () => Awaited<ReturnType<typeof pay>> | null,
        deviceId: DeviceId
      ) => {
        steps.push({
          at,
          run: async () => {
            const paid = payment()
            if (paid === null) return
            const result = await demoRun(
              refundPayment({
                paymentId: paid.paymentId,
                method: paid.method === "cash" ? "cashRegister" : "outside",
                deviceId,
                // The tip stays with the staff; a refund returns the sale.
                amount: NonNegativeInteger(
                  Math.round(
                    (paid.amount - paid.tipAmount) *
                      (random.chance(0.5) ? 1 : 0.3)
                  )
                ),
              })
            )
            if (!result.ok) {
              console.warn("Demo refund skipped.", result.error)
            }
          },
        })
      }

      // Every day is planned up front, oldest first, so bills can be numbered
      // in the order they were opened even though they are written newest
      // first: stopped after a week, the oldest bill written carries the
      // number a café that has used the app for a while would be at.
      let nextBillNumber = 1
      const plans = Array.from({ length: days }, (_, dayIndex) => {
        const dayStart = addDays(firstDay, dayIndex).getTime()
        const weekday = (addDays(firstDay, dayIndex).getDay() + 6) % 7
        const growth = 1 + (0.2 * dayIndex) / days
        const customers = Math.round(
          customersPerDay *
            (weekdayTraffic[weekday] ?? 1) *
            growth *
            (0.85 + random.next() * 0.3)
        )
        const busyUntil = new Map<TableId, number>()

        const guests = Array.from({ length: customers }, () => {
          const rush = random.weighted(rushHours, (entry) => entry.weight)
          return Math.min(
            closingMinute - 20,
            Math.max(
              openingMinute,
              Math.round(random.normal(rush.mean, rush.deviation))
            )
          )
        })
          .sort((a, b) => a - b)
          .map((arrival): PlannedGuest => {
            const at = dayStart + arrival * minute + random.int(0, 59) * second
            const kind = random.weighted(
              ["table", "counter", "keypad"] as const,
              (entry) => ({ table: 0.55, counter: 0.35, keypad: 0.1 })[entry]
            )
            const table =
              kind === "table"
                ? (tables.find(
                    (entry) => (busyUntil.get(entry.id) ?? 0) < at
                  ) ?? null)
                : null
            const duration =
              table === null
                ? random.int(2, 6) * minute
                : random.int(25, 90) * minute
            if (table !== null)
              busyUntil.set(table.id, at + duration + 5 * minute)

            return {
              arrival,
              at,
              kind:
                kind === "keypad"
                  ? "keypad"
                  : table === null
                    ? "counter"
                    : "table",
              table,
              duration,
              groupSize: table === null ? 1 : random.int(1, 4),
              secondRound: table !== null && random.chance(0.5),
              keypadAmount: random.int(5, 60) * 1000,
              refundAfter: random.chance(0.012)
                ? random.int(10, 120) * minute
                : null,
              billNumber: kind === "keypad" ? null : nextBillNumber++,
            }
          })

        return { dayStart, guests }
      })

      const stepsOf = (guest: PlannedGuest): ReadonlyArray<Step> => {
        const { at, table } = guest
        if (guest.kind === "keypad" || guest.billNumber === null) {
          let paid: Awaited<ReturnType<typeof pay>> | null = null
          const steps: Array<Step> = [
            {
              at,
              run: async () => {
                paid = await pay({
                  billId: null,
                  deviceId: counterDevice,
                  keypadAmount: guest.keypadAmount,
                  tipChance: 0,
                })
              },
            },
          ]
          if (guest.refundAfter !== null) {
            refundLater(
              steps,
              at + guest.refundAfter,
              () => paid,
              counterDevice
            )
          }
          return steps
        }

        const displayNumber = PositiveInteger(guest.billNumber)
        const deviceId =
          table === null
            ? counterDevice
            : table.patio
              ? patioDevice
              : floorDevice
        let billId: BillId | null = null
        let paid: Awaited<ReturnType<typeof pay>> | null = null
        const steps: Array<Step> = [
          {
            at,
            run: async () => {
              const id = await demoRun.ok(
                createBill({
                  deviceId,
                  displayNumber,
                  label: null,
                  tableId: table?.id ?? null,
                  currency,
                })
              )
              billId = id
              await addItems(
                id,
                deviceId,
                guest.groupSize + random.int(0, 1),
                guest.arrival
              )
            },
          },
          {
            at: at + guest.duration,
            run: async () => {
              if (billId === null) return
              paid = await pay({
                billId,
                deviceId,
                keypadAmount: 0,
                tipChance: table === null ? 0.05 : 0.25,
              })
            },
          },
        ]
        if (guest.secondRound) {
          steps.push({
            at: at + Math.round(guest.duration * 0.55),
            run: async () => {
              if (billId === null) return
              await addItems(
                billId,
                deviceId,
                random.int(1, guest.groupSize),
                guest.arrival + Math.round(guest.duration / minute / 2)
              )
            },
          })
        }
        if (guest.refundAfter !== null) {
          refundLater(
            steps,
            at + guest.duration + guest.refundAfter,
            () => paid,
            deviceId
          )
        }
        return steps
      }

      // Today first, then back a day at a time: whenever generating stops,
      // the history it leaves runs unbroken up to now.
      onProgress?.(0, days)
      let generatedDays = 0
      for (const plan of plans.toReversed()) {
        // Steps past the end of history never happened: a table seated in
        // the last hour is still open, which is exactly what "now" looks like.
        const dayEnd = plan.dayStart + closingMinute * minute + 30 * minute
        const due = plan.guests
          .flatMap(stepsOf)
          .filter((step) => step.at < Math.min(historyEnd, dayEnd))
          .sort((a, b) => a.at - b.at)

        // Back to the morning of an earlier, still empty day.
        simulatedNow = plan.dayStart
        for (const step of due) {
          setTime(step.at)
          await step.run()
        }

        generatedDays += 1
        onProgress?.(generatedDays, days)
        if (shouldStop?.() === true) break
      }

      return ok({ payments, days: generatedDays })
    } finally {
      evolu.setMutationBackdate(null)
    }
  }
