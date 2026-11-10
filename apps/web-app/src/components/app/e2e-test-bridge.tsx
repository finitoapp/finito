import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { accountListQuery } from "@payky/core/evolu/device-account"
import { createNostrRelayClient } from "@payky/core/integrations/nostr/nostr-relay-client"
import { ACCOUNT_SHARE_REQUEST_LIFETIME_MS } from "@payky/core/integrations/payky-app/account-share-protocol"
import {
  saveCashRegisterAccount,
  saveFiatBankAccount,
  saveSparkAccount,
} from "@payky/core/modules/account/account-actions"
import {
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "@payky/core/modules/account/account-queries"
import {
  createCashRegisterAccountId,
  legacyFiatBankAccountId,
} from "@payky/core/modules/account/account-utils"
import { createAccountTransaction } from "@payky/core/modules/account-transaction/account-transaction-actions"
import {
  completeOnboarding,
  markRecoveryPhraseVerified,
  setMenuOrdering,
  setSelfPayBillsHidden,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  getFiatCurrency,
  PaymentMethodOrderJson,
} from "@payky/core/modules/app-settings/app-settings-utils"
import {
  addManualAmountToBill,
  cancelBill,
} from "@payky/core/modules/bill/bill-actions"
import { billByIdQuery } from "@payky/core/modules/bill/bill-queries"
import { BillId } from "@payky/core/modules/bill/bill-types"
import {
  insertBillLineRows,
  loadCalculatedBillLineSummaries,
} from "@payky/core/modules/bill-line/bill-line-actions"
import { deriveBillSummaryTotal } from "@payky/core/modules/bill-line/bill-line-utils"
import {
  createCatalogItemAtEnd,
  setCatalogItemInMenu,
} from "@payky/core/modules/catalog-item/catalog-item-actions"
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
import { fiatBankAccountFioPluginQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { upsertItemSnapshot } from "@payky/core/modules/item/item-actions"
import { createStandaloneItemSnapshot } from "@payky/core/modules/item/item-utils"
import {
  loadSelfPayMenu,
  saveSelfPayMenuVersion,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { createSelfPayOrderSelectionText } from "@payky/core/modules/menu-order/menu-order-utils"
import {
  createPayment,
  markPaymentPaidCash,
} from "@payky/core/modules/payment/payment-actions"
import {
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
  deriveSelfPaySelectionKey,
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
  type MasterKey,
} from "@payky/core/modules/shared/key-derivation"
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
import { createSelfPaySelectionEvent } from "@payky/core/modules/table-self-pay/table-self-pay-pointer-utils"
import { selfPayTablesQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  deriveOrderSelfPayReference,
  formatSelfPayBankMessage,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { jsonCodec } from "@payky/core/zod-utils"
import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { z } from "zod"
import { accountAtom } from "@/atoms/account.ts"
import {
  accountShareSessionAtom,
  createAccountShareSession,
} from "@/atoms/account-share.ts"
import { jotaiStore } from "@/atoms/store.ts"
import { appEnv } from "@/core/app-env.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { router } from "@/router.tsx"

declare global {
  interface Window {
    __e2eSeedOnboarding?: (options?: {
      readonly spark?: boolean
      readonly fiatCurrency?: FiatCurrency
      readonly unverifiedBackup?: boolean
    }) => Promise<void>
    __e2eMarkSparkPaid?: (paymentId: string) => Promise<void>
    __e2eMarkIbanPaid?: (paymentId: string) => Promise<void>
    __e2eSimulateCancelAfterClaim?: (paymentId: string) => Promise<void>
    __e2eSimulateDuplicateSettlement?: (paymentId: string) => Promise<void>
    __e2eSimulateBillModifiedDuringPayment?: (
      billId: string,
      mode: "add" | "removeAll"
    ) => Promise<void>
    __e2eCreateAndPaySecondPayment?: (billId: string) => Promise<void>
    __e2eCancelBill?: (billId: string) => Promise<void>
    __e2eSeedEetSaleFromAnotherDevice?: (
      paymentId: string,
      minutesAgo: number
    ) => Promise<string>
    __e2eSeedLegacyFioPlugin?: () => Promise<void>
    __e2eSeedDevice?: (options: {
      readonly name: string
      readonly blocked: boolean
    }) => Promise<string>
    __e2eReadDevice?: (
      id: string
    ) => Promise<{ readonly pinUnblockToken: string | null } | null>
    __e2eUnblockThisDevice?: () => Promise<void>
    __e2eDeviceAccountIds?: () => Promise<ReadonlyArray<string>>
    __e2eSimulateAccountShareRequest?: (options: {
      readonly callerLabel: string
      readonly requesterName: string | null
      readonly code: string
    }) => Promise<void>
    __e2eAccountShareAnswers?: () => ReadonlyArray<E2eAccountShareAnswer>
    __e2eSeedActiveFioPlugin?: () => Promise<void>
    __e2eReadFioPlugin?: () => Promise<{ readonly isActive: boolean } | null>
    __e2eReceiveBankTransfer?: (transfer: {
      readonly amount: number
      readonly currency: FiatCurrency
      readonly variableSymbol: string
      readonly recipientMessage: string
    }) => Promise<void>
    __e2eReceiveLightningPayment?: (payment: {
      readonly lnInvoice: string
      readonly amountSats: number
    }) => Promise<void>
    __e2eAddBillLines?: (
      billId: string,
      lines: ReadonlyArray<{ readonly name: string; readonly amount: number }>
    ) => Promise<void>
    __e2eSeedMenu?: (menu: {
      readonly items: ReadonlyArray<{
        readonly name: string
        readonly internalName?: string
        readonly amount: number
      }>
      readonly billsHidden?: boolean
    }) => Promise<void>
    __e2eReceiveMenuOrder?: (order: {
      readonly table: string
      readonly items: ReadonlyArray<{
        readonly name: string
        readonly quantity: number
      }>
      readonly note?: string
      readonly amount: number
    }) => Promise<void>
  }
}

const E2eShareAnswerJson = jsonCodec(
  z.object({ payload: z.object({ accountName: z.string() }) })
)

/** What the simulated requester received; the account by its name only. */
interface E2eAccountShareAnswer {
  readonly approved: boolean
  readonly error: string | null
  readonly accountName: string | null
}

const selfPayArrivalDeps = (masterKey: MasterKey, deviceId: DeviceId) => ({
  deviceId,
  tableSelfPayRoot: deriveTableSelfPayRoot(masterKey),
  nostrRelayClient: createNostrRelayClient(),
  selfPayDefaultRelays: appEnv.VITE_PAYKY_SELF_PAY_RELAYS,
})

/**
 * Exposes `window.__e2eSeedOnboarding`, which writes the same account/settings
 * rows the onboarding UI would (cash + IBAN enabled, USD, tips on defaults;
 * pass `{ spark: true }` to also enable Spark, `{ fiatCurrency }` to seed a
 * different currency), so e2e specs can skip clicking through onboarding.
 * It also marks the recovery phrase verified, so the backup reminder
 * (account/0007) does not cover home after a wallet payment; pass
 * `{ unverifiedBackup: true }` for a spec that tests the reminder.
 *
 * Also exposes `window.__e2eMarkSparkPaid`/`window.__e2eMarkIbanPaid`, which
 * simulate an incoming Spark transfer/bank transaction settling a prepared
 * payment: each mirrors what its real sync job does
 * (`spark-account-transaction-sync-job.ts`'s `recordTransfer` /
 * `fio-account-transaction-sync-job.ts`'s `recordTransaction` —
 * `createAccountTransaction` + `reconcileAccountTransaction`) without
 * touching the Spark wallet SDK or a real bank, since there is no
 * counterparty to actually pay/transfer in a test run.
 *
 * Also exposes `window.__e2eSimulateCancelAfterClaim`, which writes
 * `payment.canceledAt` directly (bypassing `cancelPayment`'s guard) on a
 * payment that already has an active claim — simulating the CRDT merge race
 * documented in docs/bill-payment-states.md (one device cancels while
 * another records a claim), the same way `payment-actions.test.ts`'s "a
 * payment canceled after being claimed" test does via a direct
 * `evolu.update` call. Used to exercise the canceled+claimed collision UI
 * (the payment-detail/payment-history warning and
 * `confirmPaymentPaidDespiteCancellation`) without a real second device.
 *
 * Also exposes `window.__e2eSimulateDuplicateSettlement`, which simulates a
 * second offline device independently settling the *same* (already-claimed)
 * payment through its other prepared method — a real account transaction
 * for the payment's IBAN details, claimed via `claimManualReconciliation`
 * rather than `reconcileAccountTransaction`, since the automatic matcher
 * itself excludes a payment that already has a claim (see
 * `ibanReconciliationCandidateByAccountTransactionIdQuery`'s `reconciliationClaim.id
 * is null` guard). A genuine CRDT merge race bypasses that same exclusion
 * for the same reason `__e2eSimulateCancelAfterClaim` does: each device only
 * sees its own writes until sync. Used to exercise the duplicate-settlement
 * collision UI (the payment-detail warning) without two real devices.
 *
 * Also exposes `window.__e2eSimulateBillModifiedDuringPayment`, which edits
 * a bill's line items directly (bypassing `requireEditableBill`'s lock —
 * the guard only prevents this on the *same* device the pending payment is
 * visible on) — `mode: "add"` appends a manual-amount line, `mode:
 * "removeAll"` inserts a matching "remove" counter-line for every existing
 * one. Simulates the CRDT merge race docs/bill-payment-states.md's "Bill
 * payment coverage" section describes: one device starts a payment against
 * the bill's total at that moment, while another, still offline, edits the
 * bill's lines — once synced, the payment's already-fixed `amount` no
 * longer matches the bill's new total. Used to exercise the underpaid/
 * overpaid coverage note on the payment detail page without two real
 * devices.
 *
 * Also exposes `window.__e2eCreateAndPaySecondPayment`, which creates a
 * *second*, independent payment for `billId` (for its current line-item
 * total, cash) and marks it paid immediately — the real `createPayment`/
 * `markPaymentPaidCash` actions, not a bypass of anything, since split
 * payments are an intended capability (see docs/bill-payment-states.md's
 * "Editing lock" section: creating a new payment deliberately does not
 * check the lock). Used to reach the "two paid payments on one bill, each
 * fully covering it" overpaid case through the bill page's own UI has no
 * way to trigger, since its own "Charge" button disappears once the bill's
 * derived status is no longer `open`.
 *
 * Also exposes `window.__e2eCancelBill`, which calls the real `cancelBill`
 * action directly — the bill-level mirror of the above, letting a test
 * discard a bill while its payment is still pending (a transition the
 * domain guard allows, per docs/bill-payment-states.md, but the bill page's
 * own UI hides the cart's discard button behind the "locked" message once a
 * payment is pending, making it hard to trigger by clicking through the
 * UI). Confirming that same payment afterward produces the canceled+funded
 * bill collision `confirmBillClosedDespiteCancellation` resolves.
 *
 * Also exposes `window.__e2eSeedLegacyFioPlugin`, which writes the row shape
 * the versions before the Fio plugin became a singleton left behind: a
 * `fioPlugin` at a generated id (rather than the fixed `fioPluginId`), with a
 * token keyed to that same id. Written directly rather than through
 * `saveFioPlugin`/`addFioPluginToken`, because those two now only ever write
 * the fixed id — reproducing the old shape is the whole point. Gives
 * `fioPluginFixedIdMigration` something to migrate, which is what
 * `e2e/migrations.spec.ts` needs before the migration popup will appear at
 * all.
 *
 * Also exposes `window.__e2eSeedDevice`, `window.__e2eReadDevice` and
 * `window.__e2eUnblockThisDevice` for access control (access/0006): a second
 * device of the account, and the unblock another device would sync to this
 * one — e2e runs without a relay, so a second device cannot sync for real.
 * And `window.__e2eDeviceAccountIds`, the ids a typed `/restore-account` URL
 * must not be able to remove (account/0005).
 *
 * `window.__e2eSimulateAccountShareRequest` opens the approval page for an
 * account request as if another app had sent one (account/0008), with a
 * requester that records its answers in `window.__e2eAccountShareAnswers`;
 * Playwright cannot send an Android intent.
 *
 * All of them are dead code in any real production build: kept alive only in
 * dev (`import.meta.env.DEV`) and in the one production build
 * `bun run test:e2e:build` produces via the `PAYKY_E2E_BUILD`-gated
 * `__E2E_TEST_BUILD__` define (see vite.config.ts) — `import.meta.env.DEV`
 * alone is false in every `vite build` output regardless of how it's later
 * served, so it can't gate this for that case.
 */
export function E2eTestBridge() {
  const appRun = useAppRun()
  const deviceId = useAtomValue(accountAtom).device.id

  useEffect(() => {
    if (!import.meta.env.DEV && !__E2E_TEST_BUILD__) return

    window.__e2eSeedOnboarding = async (options) => {
      const sparkEnabled = options?.spark ?? false
      const fiatCurrency = options?.fiatCurrency ?? FiatCurrency.USD
      await using run = appRun()

      await run.ok(
        saveCashRegisterAccount({ enabled: true, currency: fiatCurrency })
      )
      await run.ok(saveSparkAccount({ enabled: sparkEnabled }))
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
            sparkEnabled
              ? ["spark", "iban", "cashRegister"]
              : ["iban", "cashRegister"]
          ),
        })
      )
      if (!options?.unverifiedBackup) {
        await run.ok(markRecoveryPhraseVerified())
      }
    }

    window.__e2eSeedLegacyFioPlugin = async () => {
      await using run = appRun()
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
    }

    window.__e2eSeedActiveFioPlugin = async () => {
      await using run = appRun()
      const [bankAccount] = await run.deps.evolu.loadQuery(fiatBankAccountQuery)
      if (bankAccount === undefined) throw new Error("No bank account seeded.")
      await run.ok(
        saveFioPlugin({
          accountId: bankAccount.id,
          numberOfSecondsBetweenChecks: PositiveInteger(300),
          isActive: sqliteTrue,
        })
      )
    }

    window.__e2eReadFioPlugin = async () => {
      await using run = appRun()
      const [plugin] = await run.deps.evolu.loadQuery(
        fiatBankAccountFioPluginQuery
      )
      return plugin === undefined
        ? null
        : { isActive: plugin.isActive === sqliteTrue }
    }

    window.__e2eReceiveBankTransfer = async (transfer) => {
      await using run = appRun()
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
        ...selfPayArrivalDeps(run.deps.masterKey, deviceId),
      })
      await selfPayRun.ok(reconcileAccountTransaction(accountTransactionId))
    }

    window.__e2eReceiveLightningPayment = async ({ lnInvoice, amountSats }) => {
      await using run = appRun()
      const [sparkAccount] = await run.deps.evolu.loadQuery(sparkAccountQuery)
      if (sparkAccount === undefined)
        throw new Error("No Spark account seeded.")
      const accountTransactionId = await run.ok(
        createAccountTransaction({
          accountId: sparkAccount.id,
          amount: Integer(amountSats),
          currency: "BTC",
          occurredAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
          note: null,
          internalTransferGroupId: null,
          source: { deviceId: null, source: "auto" },
          spark: {
            sparkTransferId: NonEmptyStringSchema.decode(
              `e2e:${createRowId<"Transfer">()}`
            ),
            lightning: {
              lnInvoice: NonEmptyStringSchema.decode(lnInvoice),
              preImage: null,
              paymentHash: null,
            },
          },
        })
      )

      await using selfPayRun = run.create({
        ...run.deps,
        ...selfPayArrivalDeps(run.deps.masterKey, deviceId),
      })
      await selfPayRun.ok(reconcileAccountTransaction(accountTransactionId))
    }

    window.__e2eSeedMenu = async ({ items, billsHidden = false }) => {
      await using run = appRun()
      const [settings] = await run.deps.evolu.loadQuery(settingsQuery)
      await run.ok(setMenuOrdering({ on: true, deviceId }))
      await run.ok(setSelfPayBillsHidden(billsHidden))
      for (const { name, internalName, amount } of items) {
        const id = await run.ok(
          createCatalogItemAtEnd({
            deviceId: null,
            categoryId: null,
            name: NonEmptyString255(name),
            description: null,
            internalName:
              internalName === undefined
                ? null
                : NonEmptyString255(internalName),
            internalDescription: null,
            sku: null,
            currency: getFiatCurrency(settings),
            unitAmount: NonNegativeInteger(amount),
            scanCode: null,
            taxRateId: null,
          })
        )
        await run.ok(setCatalogItemInMenu({ id, inMenu: true }))
      }
    }

    window.__e2eReceiveMenuOrder = async ({ table, items, note, amount }) => {
      await using run = appRun()
      const root = deriveTableSelfPayRoot(run.deps.masterKey)
      const [{ menu }, tables] = await Promise.all([
        run.ok(loadSelfPayMenu()),
        run.deps.evolu.loadQuery(selfPayTablesQuery),
      ])
      await run.ok(saveSelfPayMenuVersion(menu))
      const tableRow = tables.find(({ name }) => name === table)
      if (tableRow === undefined) throw new Error(`Table ${table} not found.`)
      const menuItems = menu.categories.flatMap((category) => category.items)
      const { pointer, event } = createSelfPaySelectionEvent({
        selectionText: createSelfPayOrderSelectionText({
          tablePublicKey: bytesToHex(
            deriveTableSelfPayKeys(
              root,
              tableRow.id,
              tableRow.selfPayEpoch ?? 0
            ).publicKey
          ),
          menu,
          items: items.map(({ name, quantity }) => {
            const item = menuItems.find((candidate) => candidate.name === name)
            if (item === undefined)
              throw new Error(`${name} is not in the menu.`)
            return { key: item.key, quantity }
          }),
          note: note ?? null,
        }),
        selectionKey: deriveSelfPaySelectionKey(root),
        createdAt: Math.floor(Date.now() / 1000),
      })
      await createNostrRelayClient().publish(
        appEnv.VITE_PAYKY_SELF_PAY_RELAYS,
        event
      )
      await window.__e2eReceiveBankTransfer?.({
        amount,
        currency: menu.currency,
        variableSymbol: deriveOrderSelfPayReference(pointer),
        recipientMessage: formatSelfPayBankMessage({ pointer }),
      })
    }

    window.__e2eAddBillLines = async (billIdValue, lines) => {
      const parsedBillId = BillId.parse(billIdValue)
      await using run = appRun()
      const [billRow] = await run.deps.evolu.loadQuery(
        billByIdQuery(parsedBillId)
      )
      if (billRow === undefined)
        throw new Error(`Bill ${billIdValue} not found.`)
      for (const { name, amount } of lines) {
        await run.orThrow(
          addManualAmountToBill({
            billId: parsedBillId,
            deviceId,
            totalAmount: NonNegativeInteger(amount),
            name: NonEmptyString255(name),
            currency: billRow.currency,
          })
        )
      }
    }

    window.__e2eMarkSparkPaid = async (paymentIdValue) => {
      const parsedPaymentId = PaymentId.parse(paymentIdValue)
      await using run = appRun()

      const [sparkDetails] = await run.deps.evolu.loadQuery(
        paymentSparkDetailsByIdQuery(parsedPaymentId)
      )
      if (!sparkDetails) {
        throw new Error(
          `No prepared Spark payment found for payment ${parsedPaymentId}.`
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
            sparkTransferId: NonEmptyStringSchema.decode(
              `e2e:${parsedPaymentId}`
            ),
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
    }

    window.__e2eMarkIbanPaid = async (paymentIdValue) => {
      const parsedPaymentId = PaymentId.parse(paymentIdValue)
      await using run = appRun()

      const [ibanDetails] = await run.deps.evolu.loadQuery(
        paymentIbanDetailsByIdQuery(parsedPaymentId)
      )
      if (!ibanDetails) {
        throw new Error(
          `No prepared IBAN payment found for payment ${parsedPaymentId}.`
        )
      }

      const accountTransactionId = await run.ok(
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
            bankReference: NonEmptyString255Schema.decode(
              `e2e:${parsedPaymentId}`
            ),
          },
        })
      )

      await run.ok(reconcileAccountTransaction(accountTransactionId))
    }

    window.__e2eSimulateCancelAfterClaim = async (paymentIdValue) => {
      const parsedPaymentId = PaymentId.parse(paymentIdValue)
      await using run = appRun()
      const { evoluOwner } = run.deps

      await runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "payment",
          {
            id: parsedPaymentId,
            canceledAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
          },
          { ...options, owner: evoluOwner }
        )
      )
    }

    window.__e2eSimulateDuplicateSettlement = async (paymentIdValue) => {
      const parsedPaymentId = PaymentId.parse(paymentIdValue)
      await using run = appRun()

      const [ibanDetails] = await run.deps.evolu.loadQuery(
        paymentIbanDetailsByIdQuery(parsedPaymentId)
      )
      if (!ibanDetails) {
        throw new Error(
          `No prepared IBAN payment found for payment ${parsedPaymentId}.`
        )
      }

      const accountTransactionId = await run.ok(
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
            bankReference: NonEmptyString255Schema.decode(
              `e2e:duplicate:${parsedPaymentId}`
            ),
          },
        })
      )

      await run.ok(
        claimManualReconciliation({
          paymentId: parsedPaymentId,
          accountTransactionId,
          deviceId: null,
        })
      )
    }

    window.__e2eSimulateBillModifiedDuringPayment = async (
      billIdValue,
      mode
    ) => {
      const parsedBillId = BillId.parse(billIdValue)
      await using run = appRun()
      const { evoluOwner } = run.deps

      if (mode === "add") {
        const [billRow] = await run.deps.evolu.loadQuery(
          billByIdQuery(parsedBillId)
        )
        if (!billRow) {
          throw new Error(`Bill ${parsedBillId} not found.`)
        }

        const snapshot = createStandaloneItemSnapshot({
          catalogItemId: null,
          name: NonEmptyString255Schema.decode("e2e: concurrent addition"),
          description: null,
          currency: billRow.currency,
          unitAmount: NonNegativeInteger(300),
          taxRateId: null,
        })

        await runMutationWithCompletion((options) => {
          upsertItemSnapshot(run.deps.evolu, snapshot, {
            ...options,
            owner: evoluOwner,
          })
          insertBillLineRows(
            run.deps.evolu,
            [
              {
                billId: parsedBillId,
                deviceId: null,
                catalogItemId: null,
                itemId: snapshot.id,
                type: "manualAmount",
                kind: "add",
                quantity: PositiveNumber(1),
                totalAmount: NonNegativeInteger(300),
              },
            ],
            { ...options, owner: evoluOwner }
          )
        })
        return
      }

      const summaries = await run.ok(
        loadCalculatedBillLineSummaries(parsedBillId)
      )
      await runMutationWithCompletion((options) => {
        insertBillLineRows(
          run.deps.evolu,
          summaries.map((summary) => ({
            billId: parsedBillId,
            deviceId: null,
            catalogItemId: summary.catalogItemId,
            itemId: summary.itemId,
            type: summary.type,
            kind: "remove" as const,
            quantity: summary.quantity,
            totalAmount: summary.totalAmount,
          })),
          { ...options, owner: evoluOwner }
        )
      })
    }

    window.__e2eCreateAndPaySecondPayment = async (billIdValue) => {
      const parsedBillId = BillId.parse(billIdValue)
      await using run = appRun()

      const [billRow] = await run.deps.evolu.loadQuery(
        billByIdQuery(parsedBillId)
      )
      if (!billRow) {
        throw new Error(`Bill ${parsedBillId} not found.`)
      }

      const summaries = await run.ok(
        loadCalculatedBillLineSummaries(parsedBillId)
      )
      const totalAmount = deriveBillSummaryTotal(summaries)
      // The cash register `__e2eSeedOnboarding` enabled, in the bill's currency.
      const cashRegisterAccountId = createCashRegisterAccountId(
        billRow.currency
      )

      const paymentResult = await run(
        createPayment({
          deviceId,
          billId: parsedBillId,
          tableId: null,
          amount: totalAmount,
          currency: billRow.currency,
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
          cashRegister: { accountId: cashRegisterAccountId },
        })
      )
      if (!paymentResult.ok) {
        throw new Error(
          `Failed to create a second payment for bill ${parsedBillId}: ${paymentResult.error.type}`
        )
      }

      const payResult = await run(
        markPaymentPaidCash({
          paymentId: paymentResult.value,
          accountId: cashRegisterAccountId,
        })
      )
      if (!payResult.ok) {
        throw new Error(
          `Failed to pay the second payment for bill ${parsedBillId}: ${payResult.error.type}`
        )
      }
    }

    window.__e2eCancelBill = async (billIdValue) => {
      const parsedBillId = BillId.parse(billIdValue)
      await using run = appRun()

      const result = await run(cancelBill(parsedBillId))
      if (!result.ok) {
        throw new Error(
          `Failed to cancel bill ${parsedBillId}: ${result.error.type}`
        )
      }
    }

    window.__e2eSeedEetSaleFromAnotherDevice = async (
      paymentIdValue,
      minutesAgo
    ) => {
      const parsedPaymentId = PaymentId.parse(paymentIdValue)
      await using run = appRun()

      const [payment] = await run.deps.evolu.loadQuery(
        paymentDetailQuery(parsedPaymentId)
      )
      if (!payment) {
        throw new Error(`Payment ${parsedPaymentId} not found.`)
      }

      const otherDeviceId = createRowId<"Device">()
      const saleId = await run.ok(
        createEetSale({
          payment: {
            id: parsedPaymentId,
            billId: payment.billId,
            amount: payment.amount,
            tipAmount: payment.tipAmount,
            cashReceivedAmount: null,
            currency: payment.currency,
            method: "cashRegister",
            firstClaimedAt: TimestampMsSchema.decode(
              run.deps.date.now().getTime() - minutesAgo * 60_000
            ),
            firstClaimTransactionId: createRowId<"AccountTransaction">(),
            firstSettlementValue: payment.amount,
          },
          deviceId: otherDeviceId,
        })
      )
      if (saleId === null) {
        throw new Error("EET is not set up, so no sale was created.")
      }
      return toEetCashRegisterId(otherDeviceId)
    }

    window.__e2eSeedDevice = async ({ name, blocked }) => {
      const id = createRowId<"Device">()
      await using run = appRun()
      await run.ok(
        registerDevice({
          id,
          name: NonEmptyString255(name),
          deviceType: NonEmptyString255("tablet"),
          browserName: null,
          osName: NonEmptyString255("Android"),
        })
      )
      if (blocked) await run.ok(setDevicePinBlocked({ id, blocked: true }))
      return id
    }

    window.__e2eReadDevice = async (id) => {
      await using run = appRun()
      const [row] = await run.deps.evolu.loadQuery(
        deviceByIdQuery(DeviceId.parse(id))
      )
      return row === undefined ? null : { pinUnblockToken: row.pinUnblockToken }
    }

    window.__e2eDeviceAccountIds = async () => {
      await using run = appRun()
      const accounts = await run.deps.deviceEvolu.loadQuery(accountListQuery)
      return accounts.map((account) => account.id)
    }

    window.__e2eUnblockThisDevice = async () => {
      await using run = appRun()
      await run.ok(unblockDevice(deviceId))
    }

    const accountShareAnswers: E2eAccountShareAnswer[] = []
    window.__e2eAccountShareAnswers = () => [...accountShareAnswers]
    window.__e2eSimulateAccountShareRequest = async ({
      callerLabel,
      requesterName,
      code,
    }) => {
      const receivedAt = Date.now()
      const request = {
        v: 1 as const,
        requestId: Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
          (byte) => byte.toString(16).padStart(2, "0")
        ).join(""),
        code,
        requesterName,
        callerPackage: "fit.finito.e2e",
        callerLabel,
        callerIcon: null,
        receivedAt,
        expiresAt: receivedAt + ACCOUNT_SHARE_REQUEST_LIFETIME_MS,
      }
      jotaiStore.set(
        accountShareSessionAtom,
        createAccountShareSession(request, async (answer) => {
          const decoded = answer.approved
            ? z.safeDecode(E2eShareAnswerJson, answer.account)
            : null
          accountShareAnswers.push({
            approved: answer.approved,
            error: answer.approved ? null : answer.error,
            accountName: decoded?.success
              ? decoded.data.payload.accountName
              : null,
          })
          return true
        })
      )
      await router.navigate({ to: "/settings/accounts/share" })
    }

    return () => {
      delete window.__e2eSimulateAccountShareRequest
      delete window.__e2eAccountShareAnswers
      delete window.__e2eSeedDevice
      delete window.__e2eDeviceAccountIds
      delete window.__e2eReadDevice
      delete window.__e2eUnblockThisDevice
      delete window.__e2eSeedOnboarding
      delete window.__e2eMarkSparkPaid
      delete window.__e2eMarkIbanPaid
      delete window.__e2eSimulateCancelAfterClaim
      delete window.__e2eSimulateDuplicateSettlement
      delete window.__e2eSimulateBillModifiedDuringPayment
      delete window.__e2eCreateAndPaySecondPayment
      delete window.__e2eCancelBill
      delete window.__e2eSeedEetSaleFromAnotherDevice
      delete window.__e2eSeedActiveFioPlugin
      delete window.__e2eReadFioPlugin
      delete window.__e2eReceiveBankTransfer
      delete window.__e2eReceiveLightningPayment
      delete window.__e2eAddBillLines
      delete window.__e2eSeedMenu
      delete window.__e2eReceiveMenuOrder
    }
  }, [appRun, deviceId])

  return null
}
