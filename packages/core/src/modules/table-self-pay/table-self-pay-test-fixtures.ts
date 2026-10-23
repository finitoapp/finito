import { sqliteTrue, testCreateConsole, testCreateRun } from "@evolu/common"
import { createQuery } from "../../evolu/schema.ts"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createFakeNostrRelay } from "../../integrations/nostr/nostr-relay-test-fixtures.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { testNotificationsDep } from "../../testing/background-jobs.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { createAccount } from "../account/account-actions.ts"
import { createAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import { addManualAmountToBill, createBill } from "../bill/bill-actions.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import { reconcileAccountTransaction } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  deriveSelfPayRateKey,
  deriveSelfPaySelectionKey,
  deriveTableSelfPayRoot,
  MasterKey,
  SparkSecret,
} from "../shared/key-derivation.ts"
import { createTestInvoice } from "../shared/lightning-invoice-test-fixtures.ts"
import {
  type FiatCurrency,
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  type SpecificSymbol,
  type TimestampMs,
  VariableSymbol,
  WssUrl,
} from "../shared/schema.ts"
import { createTableAtEnd } from "../table/table-actions.ts"
import type { TableId } from "../table/table-types.ts"
import {
  loadTableSelfPayView,
  saveTableSelfPayViewSnapshot,
  upsertBillSelfPayReferences,
} from "./table-self-pay-actions.ts"
import {
  createSelfPaySelectionEvent,
  createSelfPayShareSelectionText,
} from "./table-self-pay-pointer-utils.ts"
import { selfPayTablesQuery } from "./table-self-pay-queries.ts"
import {
  createSelfPayRate,
  signSelfPayRate,
} from "./table-self-pay-rate-utils.ts"
import {
  deriveBillSelfPayReference,
  type SelfPayMemoRate,
  type SelfPayReference,
} from "./table-self-pay-reference-utils.ts"
import type {
  SelfPayShareBill,
  SelfPaySplit,
} from "./table-self-pay-share-utils.ts"

export const selfPayTestMasterKey = MasterKey(
  "000102030405060708090a0b0c0d0e0f"
)

export const selfPayTestRoot = deriveTableSelfPayRoot(selfPayTestMasterKey)

const selfPayTestNow = new Date("2026-06-05T12:00:00.000Z")

export const createSelfPayTestContext = async ({
  now = selfPayTestNow,
}: {
  readonly now?: Date
} = {}) => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep(now)
  const relay = createFakeNostrRelay()
  const deps = {
    evolu,
    evoluOwner: evolu.appOwner,
    date: clock.date,
    tableSelfPayRoot: selfPayTestRoot,
    selfPayDefaultRelays: [WssUrl("wss://relay.test")],
    nostrRelayClient: createNostrRelayClient({
      createSocket: relay.createSocket,
    }),
    console: testCreateConsole(),
    lockManager: createInProcessLockManager(),
    ...testNotificationsDep(),
    sparkWallet: {
      create: async () => {
        throw new Error("Spark is unreachable.")
      },
    },
  }
  const deviceId = createRowId<"Device">()

  await using run = testCreateRun(deps)
  const ibanAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bistro account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )
  const sparkAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bistro wallet"),
      spark: { secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc") },
    })
  )
  const tableId = await run.ok(
    createTableAtEnd({
      deviceId,
      name: NonEmptyString255("Table 3"),
      seatCount: PositiveInteger(4),
      selfPayEnabled: 1,
    })
  )

  return {
    deps,
    clock,
    relay,
    deviceId,
    ibanAccountId,
    sparkAccountId,
    tableId,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

export type SelfPayTestContext = Awaited<
  ReturnType<typeof createSelfPayTestContext>
>

export const openSelfPayBill = async (
  context: SelfPayTestContext,
  {
    lines,
    tableId = context.tableId,
    deviceId = context.deviceId,
    currency = "CZK",
  }: {
    readonly lines: ReadonlyArray<{
      readonly name: string
      readonly amount: number
    }>
    readonly tableId?: TableId
    readonly deviceId?: DeviceId | null
    readonly currency?: FiatCurrency
  }
): Promise<{
  readonly billId: BillId
  readonly reference: SelfPayReference
}> => {
  await using run = testCreateRun(context.deps)
  const billId = await run.ok(
    createBill({
      deviceId,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId,
      currency,
    })
  )
  for (const { name, amount } of lines) {
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId,
        totalAmount: NonNegativeInteger(amount),
        name: NonEmptyString255(name),
        currency,
      })
    )
  }
  const reference = deriveBillSelfPayReference(billId)
  await runMutationWithCompletion((options) =>
    upsertBillSelfPayReferences(context.deps.evolu, [{ billId, reference }], {
      ...options,
      owner: context.deps.evoluOwner,
    })
  )
  return { billId, reference }
}

export const loadSelfPayTestView = async (
  context: SelfPayTestContext,
  tableId: TableId = context.tableId
) => {
  const tables = await context.deps.evolu.loadQuery(selfPayTablesQuery)
  const table = tables.find(({ id }) => id === tableId)
  if (table === undefined) throw new Error("Expected the self-pay table.")
  await using run = testCreateRun(context.deps)
  return await run.ok(loadTableSelfPayView(table))
}

export const publishSelfPayTestView = async (
  context: SelfPayTestContext,
  tableId: TableId = context.tableId
) => {
  const snapshot = await loadSelfPayTestView(context, tableId)
  await using run = testCreateRun(context.deps)
  await run.ok(saveTableSelfPayViewSnapshot(snapshot))
  return snapshot
}

export const createSelfPayTestSelection = (
  context: SelfPayTestContext,
  bill: SelfPayShareBill & { readonly reference: SelfPayReference },
  split: SelfPaySplit = { kind: "remainder" }
) =>
  createSelfPaySelectionEvent({
    selectionText: createSelfPayShareSelectionText({ bill, split }),
    selectionKey: deriveSelfPaySelectionKey(context.deps.tableSelfPayRoot),
    createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
  })

export const publishSelfPayTestSelection = async (
  context: SelfPayTestContext,
  bill: SelfPayShareBill & { readonly reference: SelfPayReference },
  split: SelfPaySplit = { kind: "remainder" }
) => {
  const { pointer, event } = createSelfPayTestSelection(context, bill, split)
  await context.deps.nostrRelayClient.publish(
    context.deps.selfPayDefaultRelays,
    event
  )
  return pointer
}

export const selectSelfPayTestShare = async (
  context: SelfPayTestContext,
  reference: SelfPayReference,
  split: SelfPaySplit = { kind: "remainder" }
) => {
  const { view } = await publishSelfPayTestView(context)
  const bill = view.bills.find((candidate) => candidate.reference === reference)
  if (bill === undefined) throw new Error("Expected the bill in the view.")
  return {
    bill,
    pointer: await publishSelfPayTestSelection(context, bill, split),
  }
}

export const receiveBankTransfer = async (
  context: SelfPayTestContext,
  {
    amount,
    variableSymbol,
    specificSymbol = null,
    recipientMessage = null,
    bankReference = createRowId<"Transfer">(),
    occurredAt = context.clock.date.now().getTime(),
  }: {
    readonly amount: number
    readonly variableSymbol: string
    readonly specificSymbol?: SpecificSymbol | null
    readonly recipientMessage?: string | null
    readonly bankReference?: string
    readonly occurredAt?: TimestampMs
  }
) => {
  await using run = testCreateRun(context.deps)
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId: context.ibanAccountId,
      amount: Integer(amount),
      currency: "CZK",
      occurredAt,
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
      iban: {
        variableSymbol: VariableSymbol(variableSymbol),
        constantSymbol: null,
        specificSymbol,
        bankReference: NonEmptyString255(bankReference),
        recipientMessage:
          recipientMessage === null
            ? null
            : NonEmptyStringSchema.decode(recipientMessage),
      },
    })
  )
  const paymentId = await run.ok(
    reconcileAccountTransaction(accountTransactionId)
  )
  return { accountTransactionId, paymentId }
}

export const createTestLightningInvoice = ({
  amountSats,
  memo,
  createdAt,
}: {
  readonly amountSats: number
  readonly memo: string
  readonly createdAt: number
}): string =>
  createTestInvoice({
    hrp: `lnbc${amountSats * 10}n`,
    timestamp: createdAt,
    description: memo,
  })

export const signTestSelfPayRate = (
  now: Date,
  currency: FiatCurrency = "CZK"
): SelfPayMemoRate =>
  signSelfPayRate(
    deriveSelfPayRateKey(deriveTableSelfPayRoot(selfPayTestMasterKey)),
    createSelfPayRate({ currency, exchangeRate: 2_500_000, now })
  )

export const receiveLightningPayment = async (
  context: SelfPayTestContext,
  {
    amountSats,
    lnInvoice,
    occurredAt = context.clock.date.now().getTime(),
  }: {
    readonly amountSats: number
    readonly lnInvoice: string
    readonly occurredAt?: TimestampMs
  }
) => {
  await using run = testCreateRun(context.deps)
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId: context.sparkAccountId,
      amount: Integer(amountSats),
      currency: "BTC",
      occurredAt,
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
      spark: {
        sparkTransferId: NonEmptyStringSchema.decode(createRowId<"Transfer">()),
        lightning: {
          lnInvoice: NonEmptyStringSchema.decode(lnInvoice),
          preImage: null,
          paymentHash: null,
        },
      },
    })
  )
  const paymentId = await run.ok(
    reconcileAccountTransaction(accountTransactionId)
  )
  return { accountTransactionId, paymentId }
}

export const selfPayPointersByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentSelfPay")
      .innerJoin("payment", "payment.id", "paymentSelfPay.id")
      .select(["paymentSelfPay.pointer"])
      .where("payment.billId", "=", billId)
      .where("paymentSelfPay.isDeleted", "is not", sqliteTrue)
  )
