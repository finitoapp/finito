import {
  type ConsoleDep,
  type LockManagerDep,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import type { EetCertificateFile } from "../../integrations/eet/eet-certificate.ts"
import {
  createEetApiDep,
  type EetApiDep,
} from "../../integrations/eet/eet-client.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep, type TestDateDep } from "../../testing/date-dep.ts"
import {
  createFakeEetResponder,
  type FakeEetResponder,
} from "../../testing/eet-fake-responder.ts"
import {
  createTestCertificate,
  type TestCertificate,
} from "../../testing/eet-test-certificates.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import { createAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import {
  createPayment,
  markPaymentPaidCash,
} from "../payment/payment-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { claimManualReconciliation } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { createRowId } from "../shared/evolu-utils.ts"
import { SparkSecret } from "../shared/key-derivation.ts"
import {
  type FiatCurrency,
  IbanSchema,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import {
  createEetSale,
  enableEet,
  saveEetEstablishmentId,
  selectEetEnvironment,
  storeEetCertificate,
} from "./eet-actions.ts"
import {
  type EetEic,
  type EetEnvironment,
  EetEstablishmentIdSchema,
} from "./eet-types.ts"

export const eetTestEic = "CZ1234567890" as EetEic

const eetTestNow = new Date("2026-06-05T12:00:00.000Z")

const testCertificateDescription = "generated test taxpayer"

const testCertificateValidity = {
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validTo: new Date("2027-12-31T00:00:00.000Z"),
}

let cashRegisterCertificate: Promise<TestCertificate> | undefined

export const getEetTestCertificateFile = async (
  eic: EetEic = eetTestEic
): Promise<EetCertificateFile> => {
  cashRegisterCertificate ??= createTestCertificate({
    subject: {
      commonName: eetTestEic,
      description: testCertificateDescription,
    },
    ...testCertificateValidity,
  })
  const { certificateDer, privateKeyPkcs8 } = await cashRegisterCertificate

  return {
    eic,
    description: testCertificateDescription,
    ...testCertificateValidity,
    certificateDer,
    privateKeyPkcs8,
  }
}

export type EetTestDeps = EvoluDep &
  EvoluOwnerDep &
  DateDep &
  FetchDep &
  LockManagerDep &
  ConsoleDep &
  EetApiDep

export interface EetTestContext extends AsyncDisposable {
  readonly deps: EetTestDeps
  readonly clock: TestDateDep
  readonly responder: FakeEetResponder
  readonly deviceId: DeviceId
  readonly cashRegisterAccountId: AccountId
  readonly withEetApi: (options: {
    readonly productionUrl?: string
  }) => EetTestDeps
}

export const createEetTestContext = async ({
  now = eetTestNow,
  productionUrl,
}: {
  readonly now?: Date
  readonly productionUrl?: string
} = {}): Promise<EetTestContext> => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const clock = createTestDateDep(now)
  const responder = await createFakeEetResponder({ now: clock.date.now })
  const baseDeps = {
    ...evoluTestDeps(evolu),
    date: clock.date,
    fetch: responder.fetch,
    lockManager: createInProcessLockManager(),
    console: testCreateConsole(),
  }
  const withEetApi = (options: { readonly productionUrl?: string }) => ({
    ...baseDeps,
    ...createEetApiDep(baseDeps, {
      productionUrl: options.productionUrl,
      timeoutMs: 200,
    }),
  })
  const deps = withEetApi({ productionUrl })

  await using run = testCreateRun(deps)
  const cashRegisterAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: { currency: "CZK" },
    })
  )

  return {
    deps,
    clock,
    responder,
    deviceId: createRowId<"Device">(),
    cashRegisterAccountId,
    withEetApi,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

export const configureEet = async (
  context: EetTestContext,
  {
    enabled = true,
    environment = "playground",
    isTestCertificate = false,
    establishmentId = "24",
  }: {
    readonly enabled?: boolean
    readonly environment?: EetEnvironment
    readonly isTestCertificate?: boolean
    readonly establishmentId?: string
  } = {}
): Promise<void> => {
  await using run = testCreateRun(context.deps)
  await run.ok(
    storeEetCertificate({
      certificate: await getEetTestCertificateFile(),
      isTestCertificate,
    })
  )
  await run.ok(
    saveEetEstablishmentId(EetEstablishmentIdSchema.decode(establishmentId))
  )
  await run.orThrow(selectEetEnvironment(environment))
  if (enabled) await run.orThrow(enableEet())
}

export const createTestPayment = async (
  context: EetTestContext,
  {
    deviceId = context.deviceId,
    amount = 25_000,
    tipAmount = 0,
    currency = "CZK",
    billId = null,
  }: {
    readonly deviceId?: DeviceId | null
    readonly amount?: number
    readonly tipAmount?: number
    readonly currency?: FiatCurrency
    readonly billId?: BillId | null
  } = {}
): Promise<PaymentId> => {
  await using run = testCreateRun(context.deps)
  return await run.orThrow(
    createPayment({
      deviceId,
      billId,
      tableId: null,
      amount: NonNegativeInteger(amount),
      currency,
      tipAmount: NonNegativeInteger(tipAmount),
      canceledAt: null,
      expiresAt: null,
    })
  )
}

export const settleInCash = async (
  context: EetTestContext,
  paymentId: PaymentId,
  {
    accountId = context.cashRegisterAccountId,
    deviceId = context.deviceId,
    receivedAmount,
  }: {
    readonly accountId?: AccountId
    readonly deviceId?: DeviceId | null
    readonly receivedAmount?: number
  } = {}
): Promise<void> => {
  await using run = testCreateRun(context.deps)
  await run.orThrow(
    markPaymentPaidCash({
      paymentId,
      accountId,
      deviceId,
      receivedAmount:
        receivedAmount === undefined
          ? undefined
          : NonNegativeInteger(receivedAmount),
    })
  )
}

export const settleWithLightning = async (
  context: EetTestContext,
  paymentId: PaymentId
): Promise<void> => {
  await using run = testCreateRun(context.deps)
  const sparkAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark wallet"),
      spark: { secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc") },
    })
  )
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId: sparkAccountId,
      amount: Integer(1_234),
      currency: "BTC",
      occurredAt: TimestampMs(context.clock.date.now().getTime()),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
      spark: {
        sparkTransferId: NonEmptyStringSchema.decode(`transfer-${paymentId}`),
        lightning: {
          lnInvoice: NonEmptyStringSchema.decode(`lnbc1${paymentId}`),
          preImage: null,
          paymentHash: null,
        },
      },
    })
  )
  await run.ok(
    claimManualReconciliation({
      paymentId,
      accountTransactionId,
      deviceId: null,
    })
  )
}

export const settleByTransfer = async (
  context: EetTestContext,
  paymentId: PaymentId,
  {
    amount = 25_000,
    deviceId = null,
  }: {
    readonly amount?: number
    readonly deviceId?: DeviceId | null
  } = {}
): Promise<AccountTransactionId> => {
  await using run = testCreateRun(context.deps)
  const bankAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )
  const accountTransactionId = await run.ok(
    createAccountTransaction({
      accountId: bankAccountId,
      amount: Integer(amount),
      currency: "CZK",
      occurredAt: TimestampMs(context.clock.date.now().getTime()),
      note: null,
      internalTransferGroupId: null,
      source: { deviceId: null, source: "auto" },
    })
  )
  await run.ok(
    claimManualReconciliation({ paymentId, accountTransactionId, deviceId })
  )
  return accountTransactionId
}

export const reportSaleOf = async (
  context: EetTestContext,
  {
    paymentId,
    billId = null,
    amount,
  }: {
    readonly paymentId: PaymentId
    readonly billId?: BillId | null
    readonly amount: number
  }
): Promise<void> => {
  await using run = testCreateRun(context.deps)
  await run.ok(
    createEetSale({
      payment: {
        id: paymentId,
        billId,
        amount: NonNegativeInteger(amount),
        tipAmount: NonNegativeInteger(0),
        cashReceivedAmount: null,
        currency: "CZK",
        method: "cashRegister",
        firstClaimedAt: TimestampMs(context.clock.date.now().getTime()),
        firstClaimTransactionId: createRowId<"AccountTransaction">(),
        firstSettlementValue: NonNegativeInteger(amount),
      },
      deviceId: context.deviceId,
    })
  )
}
