import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { accessLastActivityAtom } from "@payky/app-shared/access-state"
import {
  accountListQuery,
  updateDeviceSettings,
} from "@payky/core/evolu/device-account"
import { getDeviceLocaleForLanguage } from "@payky/core/evolu/device-client"
import { createNostrRelayClient } from "@payky/core/integrations/nostr/nostr-relay-client"
import {
  saveCashRegisterAccount,
  saveFiatBankAccount,
  saveSparkAccount,
} from "@payky/core/modules/account/account-actions"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  createCashRegisterAccountId,
  legacyFiatBankAccountId,
} from "@payky/core/modules/account/account-utils"
import { createAccountTransaction } from "@payky/core/modules/account-transaction/account-transaction-actions"
import {
  completeOnboarding,
  markRecoveryPhraseVerified,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { PaymentMethodOrderJson } from "@payky/core/modules/app-settings/app-settings-utils"
import { cancelBill } from "@payky/core/modules/bill/bill-actions"
import {
  billByIdQuery,
  latestBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import { BillId, createRandomBillId } from "@payky/core/modules/bill/bill-types"
import {
  insertBillLineRows,
  loadCalculatedBillLineSummaries,
} from "@payky/core/modules/bill-line/bill-line-actions"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import {
  registerDevice,
  setDevicePinBlocked,
  unblockDevice,
} from "@payky/core/modules/device/device-actions"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import { DeviceId } from "@payky/core/modules/device/device-types"
import { createEetSale } from "@payky/core/modules/eet/eet-actions"
import { toEetCashRegisterId } from "@payky/core/modules/eet/eet-utils"
import { saveFioPlugin } from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import { upsertItemSnapshot } from "@payky/core/modules/item/item-actions"
import { createStandaloneItemSnapshot } from "@payky/core/modules/item/item-utils"
import {
  createPayment,
  markPaymentPaidCash,
} from "@payky/core/modules/payment/payment-actions"
import {
  latestPaymentsQuery,
  paymentDetailQuery,
  paymentIbanDetailsByIdQuery,
  paymentSparkDetailsByIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  claimManualReconciliation,
  reconcileAccountTransaction,
} from "@payky/core/modules/reconciliation-claim/reconciliation-claim-actions"
import {
  createRowId,
  runMutationWithCompletion,
} from "@payky/core/modules/shared/evolu-utils"
import {
  createMasterKey,
  deriveTableSelfPayRoot,
  masterKeyToMnemonic,
} from "@payky/core/modules/shared/key-derivation"
import { createTestInvoice } from "@payky/core/modules/shared/lightning-invoice-test-fixtures"
import {
  BankAccountInputIbanSchema,
  FiatCurrency,
  Integer,
  NonEmptyString255,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMsSchema,
  VariableSymbol,
} from "@payky/core/modules/shared/schema"
import { formatSelfPayBankMessage } from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { router } from "expo-router"
import type { createStore } from "jotai"
import type { SetStateAction } from "react"
import { z } from "zod"
import { nativeEnv } from "../core/native-env.ts"
import type { NativeAppRun } from "../hooks/use-app-run.ts"
import { payE2eCashuQuotes, setE2eCashu } from "./e2e-cashu-mint.ts"
import {
  holdE2eMigrations,
  releaseE2eMigrations,
} from "./e2e-hold-migration.ts"
import { setE2eOffline } from "./e2e-network.ts"
import { selectSelfPayShare } from "./e2e-self-pay-guest.ts"
import { e2eSparkPresetNames, setE2eSparkPreset } from "./e2e-spark-presets.ts"

/**
 * What a flow opens `/e2e/<action>?<params>` for: the native twin of web's
 * `window.__e2e*` functions (`e2e-test-bridge.tsx`), since Maestro cannot call
 * into the app. An action reads its params with zod, throws on failure, and
 * may return a value the bridge page prints for `assertVisible`. `context`
 * is what only a component can read (the active device).
 */
export interface E2eContext {
  readonly deviceId: DeviceId
  readonly store: ReturnType<typeof createStore>
}

type E2eAction = (
  run: NativeAppRun,
  params: Readonly<Record<string, string>>,
  context: E2eContext
) => Promise<string | undefined>

const SeedOnboardingParams = z.object({
  spark: z.stringbool().default(false),
  fiatCurrency: z.enum(FiatCurrency).default(FiatCurrency.USD),
  unverifiedBackup: z.stringbool().default(false),
})

const FakeParams = z.object({
  spark: z.enum(e2eSparkPresetNames).optional(),
  cashu: z.enum(["manual", "autopay", "off"]).optional(),
})

const PositiveIntegerParam = z
  .string()
  .regex(/^[1-9]\d*$/u)
  .transform(Number)

const GuestLineShareParam = z
  .string()
  .transform((share) => share.split(/[:/]/u))
  .pipe(
    z.tuple([z.string().min(1), PositiveIntegerParam, PositiveIntegerParam])
  )
  .transform(([name, numerator, denominator]) => ({
    name,
    numerator,
    denominator,
  }))

const GuestBankTransferParams = z.object({
  billId: BillId,
  lines: z
    .string()
    .transform((lines) => lines.split(","))
    .pipe(z.array(GuestLineShareParam))
    .optional(),
  people: z.coerce.number().int().min(2).optional(),
  amount: z.coerce.number().int().positive().optional(),
  message: z.string().min(1).optional(),
})

export const e2eActions: Readonly<Record<string, E2eAction>> = {
  ping: async () => undefined,

  /**
   * `__e2eSeedOnboarding`: the rows the onboarding UI writes (cash + IBAN,
   * USD, tips on defaults; `spark=true` adds Spark, `fiatCurrency=` another
   * currency), plus English, so no flow depends on the device locale. It
   * marks the recovery phrase verified, as web's does, so the backup reminder
   * (account/0007) does not cover the screen after the first payment;
   * `unverifiedBackup=true` keeps it for a flow that tests the reminder.
   */
  seedOnboarding: async (run, params) => {
    const { spark, fiatCurrency, unverifiedBackup } =
      SeedOnboardingParams.parse(params)
    updateDeviceSettings(run.deps.deviceEvolu, {
      language: "en",
      locale: getDeviceLocaleForLanguage("en"),
    })
    await run.ok(
      saveCashRegisterAccount({ enabled: true, currency: fiatCurrency })
    )
    await run.ok(saveSparkAccount({ enabled: spark }))
    await run.ok(
      saveFiatBankAccount({
        enabled: true,
        iban: BankAccountInputIbanSchema.parse("CZ6508000000192000145399"),
        currency: fiatCurrency,
      })
    )
    await run.orThrow(
      completeOnboarding({
        fiatCurrency,
        defaultPaymentMethod: "cashRegister",
        paymentMethodOrderJson: z.encode(
          PaymentMethodOrderJson,
          spark ? ["spark", "iban", "cashRegister"] : ["iban", "cashRegister"]
        ),
      })
    )
    if (!unverifiedBackup) await run.ok(markRecoveryPhraseVerified())
    return undefined
  },

  /**
   * Swaps in a named fake for an outside service (`spark=funded`,
   * `cashu=manual|autopay`), standing in for web's `page.addInitScript` that sets
   * `window.__e2eSparkWallet` / `__e2eCashuMint`. Do it before the Cashu
   * wallet starts (enable Cashu afterwards).
   * It lasts until the app restarts, so on web pass `next=` to move on
   * in-app instead of opening another link.
   */
  fake: async (_run, params) => {
    const { spark, cashu } = FakeParams.parse(params)
    if (spark !== undefined) setE2eSparkPreset(spark)
    if (cashu !== undefined) setE2eCashu(cashu === "off" ? null : cashu)
    return undefined
  },

  /**
   * `__e2eSeedLegacyFioPlugin`: writes the row shape the versions before the
   * Fio plugin became a singleton left behind — a `fioPlugin` at a generated
   * id (rather than the fixed `fioPluginId`), with a token keyed to that same
   * id. Written directly rather than through `saveFioPlugin`/
   * `addFioPluginToken`, because those two now only ever write the fixed id —
   * reproducing the old shape is the whole point. Gives
   * `fioPluginFixedIdMigration` something to migrate at the next start, which
   * the migration popup needs before it appears at all.
   */
  seedLegacyFioPlugin: async (run) => {
    const { evoluOwner } = run.deps
    const legacyPluginId = createRowId<"FioPlugin">()
    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      run.deps.evolu.upsert(
        "fioPlugin",
        {
          id: legacyPluginId,
          accountId: legacyFiatBankAccountId,
          numberOfSecondsBetweenChecks: PositiveInteger(300),
          syncLookbackDays: PositiveInteger(3),
          isActive: sqliteFalse,
          isDeleted: sqliteFalse,
        },
        mutationOptions
      )
      run.deps.evolu.upsert(
        "fioPluginToken",
        {
          id: createRowId<"FioPluginToken">(),
          fioPluginId: legacyPluginId,
          token: NonEmptyString255Schema.decode("e2e-legacy-fio-token-1234"),
          isDeleted: sqliteFalse,
        },
        mutationOptions
      )
    })
    return undefined
  },

  seedActiveFioPlugin: async (run) => {
    const [bankAccount] = await run.deps.evolu.loadQuery(fiatBankAccountQuery)
    if (bankAccount === undefined) throw new Error("No bank account seeded.")
    await run.ok(
      saveFioPlugin({
        accountId: bankAccount.id,
        numberOfSecondsBetweenChecks: PositiveInteger(300),
        isActive: sqliteTrue,
      })
    )
    return undefined
  },

  /**
   * Web's `context.setOffline(true)` for the restore sync screen
   * (e2e-network.ts). Lasts until the app restarts: pass `next=`.
   */
  offline: async () => {
    setE2eOffline(true)
    return undefined
  },

  /**
   * Web's `holdMigrations`: arms the `e2e-hold` migration for every later
   * start, so the popup's running state can be caught (the real migrations
   * finish in milliseconds). Persisted, so restart the app after it (web's
   * `page.reload()`); `releaseMigrations` disarms it again.
   */
  holdMigrations: async () => {
    holdE2eMigrations()
    return undefined
  },

  /**
   * Web's `releaseMigrations` and `stopHoldingMigrations` in one: lets the
   * held migration finish and disarms the hold for later starts. The popup
   * stays over the bridge page, so a flow waits for its success, not for
   * `E2E OK`.
   */
  releaseMigrations: async () => {
    releaseE2eMigrations()
    return undefined
  },

  /**
   * `__e2eCashuPayQuotes`: the customer pays every open mint quote of the
   * fake mint; prints how many it paid.
   */
  cashuPayQuotes: async () => String(payE2eCashuQuotes()),

  /**
   * web's `createUnregisteredMnemonic`: a fresh recovery phrase no relay
   * knows, printed for `subflows/restore-offline.yaml` to copy.
   */
  unregisteredMnemonic: async () => masterKeyToMnemonic(createMasterKey()),

  /**
   * One warning through the run's console (a release build keeps warnings and
   * up), so the debug console has an entry: web's spec reads the ones
   * onboarding logged, which the seed's relaunch clears on native.
   */
  log: async (run) => {
    run.deps.console.warn("e2e log")
    return undefined
  },

  /**
   * The ids web's specs read off the URL (`/bill?billId=`, `/payment/<id>`),
   * which a flow cannot: the newest bill's and payment's, printed as
   * `bill=<id> payment=<id>` (`-` for none). `subflows/read-ids.yaml` keeps
   * them as `output.billId` and `output.paymentId`.
   */
  lastIds: async (run) => {
    const [bill] = await run.deps.evolu.loadQuery(latestBillsQuery(1))
    const [payment] = await run.deps.evolu.loadQuery(latestPaymentsQuery(1))
    return `bill=${bill?.id ?? "-"} payment=${payment?.id ?? "-"}`
  },

  /**
   * `__e2eInjectScanCode`: the bill's camera decoding `code`, without a
   * camera. The camera's callback only exists while scan mode is on, and on
   * web a link reloads the page and loses that state, so this goes through
   * the hand-off the home screen uses for a hardware scan: it opens `/bill`
   * with `scan=<code>` on the newest unfinished bill (a fresh cart has no row
   * yet, so a new id then), and the page handles the code as any scan. It
   * moves on by itself, so there is no `E2E OK` to wait for: flows wait for
   * the bill's outcome.
   */
  injectScanCode: async (run, params) => {
    const code = NonEmptyStringSchema.parse(params.code)
    const [bill] = await run.deps.evolu.loadQuery(latestBillsQuery(1))
    const open = bill && bill.closedAt === null && bill.canceledAt === null
    router.replace({
      pathname: "/bill",
      params: { billId: open ? bill.id : createRandomBillId(), scan: code },
    })
    return undefined
  },

  /**
   * `__e2eMarkSparkPaid`: settles `paymentId`'s prepared Spark invoice the way
   * the sync job would, without a real wallet.
   */
  markSparkPaid: async (run, params) => {
    const paymentId = PaymentId.parse(params.paymentId)
    const [sparkDetails] = await run.deps.evolu.loadQuery(
      paymentSparkDetailsByIdQuery(paymentId)
    )
    if (!sparkDetails) {
      throw new Error(
        `No prepared Spark payment found for payment ${paymentId}.`
      )
    }
    const accountTransactionId = await run.ok(
      createAccountTransaction({
        accountId: sparkDetails.accountId,
        amount: sparkDetails.amountSats,
        currency: "BTC",
        occurredAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId: null, source: "auto" },
        spark: {
          sparkTransferId: NonEmptyStringSchema.decode(`e2e:${paymentId}`),
          ...(sparkDetails.lnInvoice === null
            ? {}
            : {
                lightning: {
                  lnInvoice: NonEmptyStringSchema.decode(
                    sparkDetails.lnInvoice
                  ),
                  preImage: null,
                  paymentHash: null,
                },
              }),
          ...(sparkDetails.sparkInvoice === null
            ? {}
            : {
                sparkInvoice: {
                  sparkInvoice: NonEmptyStringSchema.decode(
                    sparkDetails.sparkInvoice
                  ),
                },
              }),
        },
      })
    )
    await run.ok(reconcileAccountTransaction(accountTransactionId))
    return undefined
  },

  /** `__e2eMarkIbanPaid`: the bank transfer arrives for `paymentId`. */
  markIbanPaid: async (run, params) => {
    const paymentId = PaymentId.parse(params.paymentId)
    const accountTransactionId = await createIbanTransaction(
      run,
      paymentId,
      `e2e:${paymentId}`
    )
    await run.ok(reconcileAccountTransaction(accountTransactionId))
    return undefined
  },

  receiveGuestBankTransfer: async (run, params) => {
    const { billId, amount, message, ...pick } =
      GuestBankTransferParams.parse(params)
    const selection = await selectSelfPayShare(run, billId, pick)
    await receiveBankTransfer(run, {
      amount: amount ?? selection.amount,
      currency: selection.bill.currency,
      variableSymbol: selection.bill.reference,
      recipientMessage:
        message ?? formatSelfPayBankMessage({ pointer: selection.pointer }),
    })
    return undefined
  },

  /**
   * `__e2eSimulateCancelAfterClaim`: a CRDT merge race cancels the
   * already-claimed `paymentId` directly, bypassing `cancelPayment`'s guard,
   * so it ends up canceled+claimed.
   */
  simulateCancelAfterClaim: async (run, params) => {
    const paymentId = PaymentId.parse(params.paymentId)
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "payment",
        {
          id: paymentId,
          canceledAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return undefined
  },

  /**
   * `__e2eSimulateDuplicateSettlement`: a second offline device settles the
   * cash-claimed `paymentId` again through its prepared IBAN details, so it
   * is claimed for more than its own amount.
   */
  simulateDuplicateSettlement: async (run, params) => {
    const paymentId = PaymentId.parse(params.paymentId)
    const accountTransactionId = await createIbanTransaction(
      run,
      paymentId,
      `e2e:duplicate:${paymentId}`
    )
    await run.ok(
      claimManualReconciliation({
        paymentId,
        accountTransactionId,
        deviceId: null,
      })
    )
    return undefined
  },

  /**
   * `__e2eSimulateBillModifiedDuringPayment`: another, still-offline device
   * edits `billId`'s lines while a payment is in flight. `mode=add` grows the
   * total past the payment's fixed amount (underpaid once claimed),
   * `mode=removeAll` shrinks it below (overpaid).
   */
  simulateBillModifiedDuringPayment: async (run, params) => {
    const billId = BillId.parse(params.billId)
    const owner = { owner: run.deps.evoluOwner }
    if (params.mode === "add") {
      const [billRow] = await run.deps.evolu.loadQuery(billByIdQuery(billId))
      if (!billRow) throw new Error(`Bill ${billId} not found.`)
      const snapshot = createStandaloneItemSnapshot({
        catalogItemId: null,
        name: NonEmptyString255Schema.decode("e2e: concurrent addition"),
        description: null,
        currency: billRow.currency,
        unitAmount: NonNegativeInteger(300),
        taxRateId: null,
      })
      await runMutationWithCompletion((options) => {
        upsertItemSnapshot(run.deps.evolu, snapshot, { ...options, ...owner })
        insertBillLineRows(
          run.deps.evolu,
          [
            {
              billId,
              deviceId: null,
              catalogItemId: null,
              itemId: snapshot.id,
              type: "manualAmount",
              kind: "add",
              quantity: PositiveNumber(1),
              totalAmount: NonNegativeInteger(300),
            },
          ],
          { ...options, ...owner }
        )
      })
      return undefined
    }
    const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
    await runMutationWithCompletion((options) => {
      insertBillLineRows(
        run.deps.evolu,
        summaries.map((summary) => ({
          billId,
          deviceId: null,
          catalogItemId: summary.catalogItemId,
          itemId: summary.itemId,
          type: summary.type,
          kind: "remove" as const,
          quantity: summary.quantity,
          totalAmount: summary.totalAmount,
        })),
        { ...options, ...owner }
      )
    })
    return undefined
  },

  /**
   * `__e2eCreateAndPaySecondPayment`: a second, independent cash payment for
   * `billId`, created and paid with the real actions — what a concurrent
   * device could do before either claim arrives.
   */
  createAndPaySecondPayment: async (run, params, { deviceId }) => {
    const billId = BillId.parse(params.billId)
    const [billRow] = await run.deps.evolu.loadQuery(billByIdQuery(billId))
    if (!billRow) throw new Error(`Bill ${billId} not found.`)
    const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
    // The cash register `seedOnboarding` enabled, in the bill's currency.
    const accountId = createCashRegisterAccountId(billRow.currency)
    const paymentId = await run.orThrow(
      createPayment({
        deviceId,
        billId,
        tableId: null,
        amount: deriveBillSummaryTotal(summaries),
        currency: billRow.currency,
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    return undefined
  },

  /**
   * `__e2eSeedDevice`: a second device that synced in (`name=`, `blocked=`),
   * printed as `id=<id>`.
   */
  seedDevice: async (run, params) => {
    const id = createRowId<"Device">()
    await run.ok(
      registerDevice({
        id,
        name: NonEmptyString255(params.name ?? "Kitchen tablet"),
        deviceType: NonEmptyString255("tablet"),
        browserName: null,
        osName: NonEmptyString255("Android"),
      })
    )
    if (params.blocked === "true") {
      await run.ok(setDevicePinBlocked({ id, blocked: true }))
    }
    return `id=${id}`
  },

  /**
   * `__e2eReadDevice`: whether `id` carries an unblock token, printed as
   * `token=yes` or `token=no` (the token itself is not for a screen).
   */
  readDevice: async (run, params) => {
    const [row] = await run.deps.evolu.loadQuery(
      deviceByIdQuery(DeviceId.parse(params.id))
    )
    return `token=${row?.pinUnblockToken ? "yes" : "no"}`
  },

  /**
   * `__e2eDeviceAccountIds`: the device's account ids, oldest first, printed
   * as `count=<n> first=<id>`.
   */
  deviceAccountIds: async (run) => {
    const accounts = await run.deps.deviceEvolu.loadQuery(accountListQuery)
    return `count=${accounts.length} first=${accounts[0]?.id ?? "-"}`
  },

  /** `__e2eUnblockThisDevice`: another device's unblock reaching this one. */
  unblockThisDevice: async (run, _params, { deviceId }) => {
    await run.ok(unblockDevice(deviceId))
    return undefined
  },

  /**
   * Stands in for web's `page.clock.fastForward("05:10")` (native-e2e.md 4.5):
   * the PIN session's last activity moves back six minutes, so the watcher's
   * next tick (5 s) ends it. Needs the session to survive the link, which web
   * does not (every link reloads the page): Android only.
   */
  idleSession: async (_run, _params, { store }) => {
    const now: number = Date.now()
    store.set<number, [SetStateAction<number>], void>(
      accessLastActivityAtom,
      now - 6 * 60 * 1000
    )
    return undefined
  },

  /**
   * withdraw.spec's `invoiceIssuedAt(Date.now())`: a 1 000-sat mainnet
   * invoice issued now, valid for an hour, printed as `invoice=<bolt11>`
   * because a flow cannot build one (`subflows/read-invoice.yaml` keeps it).
   * `expiry` (seconds) shortens its validity: Maestro has no fake clock, so a
   * flow lets an invoice expire for real where web fast-forwards the clock.
   */
  lightningInvoice: async (run, params) =>
    `invoice=${createTestInvoice({
      hrp: "lnbc10u",
      timestamp: Math.floor(run.deps.date.now().getTime() / 1000),
      expirySeconds: z.coerce
        .number()
        .int()
        .positive()
        .default(3600)
        .parse(params.expiry),
    })}`,

  /**
   * `__e2eCancelBill`: the real `cancelBill`, called directly because the
   * bill page hides the discard button while a payment is pending, which the
   * domain guard allows.
   */
  cancelBill: async (run, params) => {
    await run.orThrow(cancelBill(BillId.parse(params.billId)))
    return undefined
  },

  /**
   * `__e2eSeedEetSaleFromAnotherDevice`: the EET sale a second device took
   * `minutes` ago for `paymentId` (a cash payment paid before EET was on, so
   * this device has no sale of its own), with the real `createEetSale` under
   * a device id that is not this one. Prints the other device's cash register
   * as `pokl=<id>`, the `id_pokl` its repeat must carry.
   */
  seedEetSaleFromAnotherDevice: async (run, params) => {
    const paymentId = PaymentId.parse(params.paymentId)
    const minutes = z.coerce.number().parse(params.minutes)
    const [payment] = await run.deps.evolu.loadQuery(
      paymentDetailQuery(paymentId)
    )
    if (!payment) throw new Error(`Payment ${paymentId} not found.`)
    const otherDeviceId = createRowId<"Device">()
    const saleId = await run.ok(
      createEetSale({
        payment: {
          id: paymentId,
          billId: payment.billId,
          amount: payment.amount,
          tipAmount: payment.tipAmount,
          cashReceivedAmount: null,
          currency: payment.currency,
          method: "cashRegister",
          firstClaimedAt: TimestampMsSchema.decode(
            run.deps.date.now().getTime() - minutes * 60_000
          ),
          firstClaimTransactionId: createRowId<"AccountTransaction">(),
          firstSettlementValue: payment.amount,
        },
        deviceId: otherDeviceId,
      })
    )
    if (saleId === null)
      throw new Error("EET is not set up, so no sale was created.")
    return `pokl=${toEetCashRegisterId(otherDeviceId)}`
  },
}

/** An IBAN account transaction matching `paymentId`'s prepared details. */
async function createIbanTransaction(
  run: NativeAppRun,
  paymentId: PaymentId,
  bankReference: string
) {
  const [ibanDetails] = await run.deps.evolu.loadQuery(
    paymentIbanDetailsByIdQuery(paymentId)
  )
  if (!ibanDetails) {
    throw new Error(`No prepared IBAN payment found for payment ${paymentId}.`)
  }
  return run.ok(
    createAccountTransaction({
      accountId: ibanDetails.accountId,
      amount: ibanDetails.amount,
      currency: ibanDetails.currency,
      occurredAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
      iban: {
        variableSymbol: ibanDetails.variableSymbol,
        constantSymbol: null,
        specificSymbol: ibanDetails.specificSymbol,
        bankReference: NonEmptyString255Schema.decode(bankReference),
      },
    })
  )
}

async function receiveBankTransfer(
  run: NativeAppRun,
  transfer: {
    readonly amount: number
    readonly currency: FiatCurrency
    readonly variableSymbol: string
    readonly recipientMessage: string
  }
) {
  const [bankAccount] = await run.deps.evolu.loadQuery(fiatBankAccountQuery)
  if (bankAccount === undefined) throw new Error("No bank account seeded.")
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId: bankAccount.id,
      amount: Integer(transfer.amount),
      currency: transfer.currency,
      occurredAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
      iban: {
        variableSymbol: VariableSymbol(transfer.variableSymbol),
        constantSymbol: null,
        specificSymbol: null,
        bankReference: NonEmptyString255Schema.decode(
          `e2e:${createRowId<"Transfer">()}`
        ),
        recipientMessage: NonEmptyStringSchema.decode(
          transfer.recipientMessage
        ),
      },
    })
  )
  await using selfPayRun = run.create({
    ...run.deps,
    tableSelfPayRoot: deriveTableSelfPayRoot(run.deps.masterKey),
    nostrRelayClient: createNostrRelayClient(),
    selfPayDefaultRelays: nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS,
  })
  await selfPayRun.ok(reconcileAccountTransaction(accountTransactionId))
}
