import {
  err,
  type LockManagerDep,
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { z } from "zod"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { EetCertificateFile } from "../../integrations/eet/eet-certificate.ts"
import type {
  EetApiDep,
  EetDeliveryOutcome,
  EetReceipt,
  EetSigningCertificate,
  EetSubmission,
} from "../../integrations/eet/eet-client.ts"
import type { AccountKind } from "../account/account-types.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import { deriveReceivedTipAmount } from "../payment/payment-cash-utils.ts"
import { calculatePaymentBaseAmount } from "../payment/payment-tip-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { isTipRefund } from "../refund/refund-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  removeUndefinedValues,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { minorUnitsToFixedDecimalString } from "../shared/money.ts"
import { getFirstOr } from "../shared/result.ts"
import {
  type FiatCurrency,
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import {
  eetReversalByIdQuery,
  eetReversalsByPaymentIdQuery,
  eetSaleByIdQuery,
  eetSalesByPaymentIdQuery,
  eetSettingsQuery,
  eetSigningCertificateQuery,
} from "./eet-queries.ts"
import {
  type EetBase64,
  type EetCertificateId,
  type EetConfigurationGap,
  type EetEnvironment,
  type EetEstablishmentId,
  type EetReversalId,
  type EetSaleId,
  EetSequenceNumberSchema,
  type EetTipOwner,
} from "./eet-types.ts"
import {
  bytesToEetBase64,
  createEetCertificateId,
  createEetExtraSaleId,
  createEetReversalId,
  createEetSaleId,
  deriveEetReversibleRefundAmount,
  type EetExtraSaleDue,
  EetWarningsJson,
  eetBase64ToBytes,
  eetSettingsId,
  findEetConfigurationGaps,
  formatEetDateTime,
  getEetReversalStartsAt,
  getEetUnsupportedReason,
  hasLostEetAnswer,
  isEetFirstSending,
  parseEetDateTime,
  resolveEetEnvironment,
  toEetCashRegisterId,
} from "./eet-utils.ts"

const createEetConfigurationIncompleteError = defineError(
  "EetConfigurationIncompleteError"
)<{ readonly missing: ReadonlyArray<EetConfigurationGap> }>()
export type EetConfigurationIncompleteError = ReturnType<
  typeof createEetConfigurationIncompleteError
>

const createEetProductionUnavailableError = defineError(
  "EetProductionUnavailableError"
)()
export type EetProductionUnavailableError = ReturnType<
  typeof createEetProductionUnavailableError
>

const createEetTestCertificateBlocksProductionError = defineError(
  "EetTestCertificateBlocksProductionError"
)()
export type EetTestCertificateBlocksProductionError = ReturnType<
  typeof createEetTestCertificateBlocksProductionError
>

const createEetTestSaleOutsidePlaygroundError = defineError(
  "EetTestSaleOutsidePlaygroundError"
)()
export type EetTestSaleOutsidePlaygroundError = ReturnType<
  typeof createEetTestSaleOutsidePlaygroundError
>

const createEetSaleNotFoundError = defineError("EetSaleNotFoundError")<{
  readonly id: EetSaleId | EetReversalId
}>()
export type EetSaleNotFoundError = ReturnType<typeof createEetSaleNotFoundError>

const createEetSaleAlreadyConfirmedError = defineError(
  "EetSaleAlreadyConfirmedError"
)<{ readonly id: EetSaleId | EetReversalId }>()
export type EetSaleAlreadyConfirmedError = ReturnType<
  typeof createEetSaleAlreadyConfirmedError
>

const createEetSaleUnsupportedError = defineError("EetSaleUnsupportedError")<{
  readonly id: EetSaleId | EetReversalId
}>()
export type EetSaleUnsupportedError = ReturnType<
  typeof createEetSaleUnsupportedError
>

const createEetSaleBusyError = defineError("EetSaleBusyError")<{
  readonly id: EetSaleId | EetReversalId
}>()
export type EetSaleBusyError = ReturnType<typeof createEetSaleBusyError>

const createEetSigningCertificateMissingError = defineError(
  "EetSigningCertificateMissingError"
)()
export type EetSigningCertificateMissingError = ReturnType<
  typeof createEetSigningCertificateMissingError
>

const createEetReversalWaitingForSaleError = defineError(
  "EetReversalWaitingForSaleError"
)<{ readonly id: EetReversalId }>()
export type EetReversalWaitingForSaleError = ReturnType<
  typeof createEetReversalWaitingForSaleError
>

export type DeliverEetSaleError =
  | EetSaleNotFoundError
  | EetSaleAlreadyConfirmedError
  | EetSaleUnsupportedError
  | EetSaleBusyError
  | EetSigningCertificateMissingError

export type DeliverEetReversalError =
  | DeliverEetSaleError
  | EetReversalWaitingForSaleError

const loadEetSettings = async (evolu: EvoluDep["evolu"]) => {
  const [settings] = await evolu.loadQuery(eetSettingsQuery)
  return settings
}

interface EetSettingsValues {
  readonly enabledAt?: TimestampMs | null
  readonly environment?: EetEnvironment
  readonly establishmentId?: EetEstablishmentId
  readonly certificateId?: EetCertificateId
  readonly tipOwner?: EetTipOwner
}

const upsertEetSettings = (
  run: { readonly deps: EvoluDep & EvoluOwnerDep },
  values: EetSettingsValues,
  options: MutationOptions
): void => {
  run.deps.evolu.upsert(
    "eetSettings",
    removeUndefinedValues({
      ...values,
      id: eetSettingsId,
      isDeleted: sqliteFalse,
    }),
    { ...options, owner: run.deps.evoluOwner }
  )
}

export const saveEetEstablishmentId =
  (
    establishmentId: EetEstablishmentId
  ): Task<EetEstablishmentId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      upsertEetSettings(run, { establishmentId }, options)
    )
    return ok(establishmentId)
  }

export const saveEetTipOwner =
  (tipOwner: EetTipOwner): Task<EetTipOwner, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      upsertEetSettings(run, { tipOwner }, options)
    )
    return ok(tipOwner)
  }

export const selectEetEnvironment =
  (
    environment: EetEnvironment
  ): Task<
    EetEnvironment,
    EetProductionUnavailableError | EetTestCertificateBlocksProductionError,
    EvoluDep & EvoluOwnerDep & EetApiDep
  > =>
  async (run) => {
    if (environment === "production") {
      if (!run.deps.eetApi.isProductionAvailable) {
        return err(createEetProductionUnavailableError())
      }
      const settings = await loadEetSettings(run.deps.evolu)
      if (settings?.isTestCertificate === sqliteTrue) {
        return err(createEetTestCertificateBlocksProductionError())
      }
    }

    await runMutationWithCompletion((options) =>
      upsertEetSettings(run, { environment }, options)
    )
    return ok(environment)
  }

export const storeEetCertificate =
  ({
    certificate,
    isTestCertificate,
  }: {
    readonly certificate: EetCertificateFile
    readonly isTestCertificate: boolean
  }): Task<EetCertificateId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const certificateDer = bytesToEetBase64(certificate.certificateDer)
    const id = createEetCertificateId(certificateDer)
    const previousId = (await loadEetSettings(evolu))?.certificateId ?? null

    await runMutationWithCompletion((options) => {
      evolu.upsert(
        "eetCertificate",
        {
          id,
          eic: certificate.eic,
          description:
            certificate.description === null
              ? null
              : NonEmptyString255(certificate.description),
          validFrom: TimestampMs(certificate.validFrom.getTime()),
          validTo: TimestampMs(certificate.validTo.getTime()),
          certificateDer,
          privateKeyPkcs8: bytesToEetBase64(certificate.privateKeyPkcs8),
          isTestCertificate: isTestCertificate ? sqliteTrue : sqliteFalse,
          isDeleted: sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
      if (previousId !== null && previousId !== id) {
        evolu.update(
          "eetCertificate",
          { id: previousId, isDeleted: sqliteTrue },
          { ...options, owner: evoluOwner }
        )
      }
      upsertEetSettings(run, { certificateId: id }, options)
    })

    return ok(id)
  }

export const enableEet =
  (): Task<
    TimestampMs,
    EetConfigurationIncompleteError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const now = run.deps.date.now()
    const settings = await loadEetSettings(run.deps.evolu)
    const missing = findEetConfigurationGaps({
      validTo: settings?.validTo ?? null,
      establishmentId: settings?.establishmentId ?? null,
      now,
    })
    if (missing.length > 0) {
      return err(createEetConfigurationIncompleteError({ missing }))
    }

    const enabledAt = TimestampMs(now.getTime())
    await runMutationWithCompletion((options) =>
      upsertEetSettings(run, { enabledAt }, options)
    )
    return ok(enabledAt)
  }

export const disableEet =
  (): Task<null, never, EvoluDep & EvoluOwnerDep> => async (run) => {
    await runMutationWithCompletion((options) =>
      upsertEetSettings(run, { enabledAt: null }, options)
    )
    return ok(null)
  }

const createEetSaleRecord =
  ({
    id,
    extraFrom,
    accountTransactionId,
    payment,
    method,
    settledAt,
    deviceId,
    sequenceNumber,
    receivedAmount,
    tipAmount,
  }: {
    readonly id: EetSaleId
    readonly extraFrom: NonNegativeInteger | null
    readonly accountTransactionId: AccountTransactionId | null
    readonly payment: {
      readonly id: PaymentId
      readonly billId: BillId | null
      readonly currency: FiatCurrency
    }
    readonly method: AccountKind
    readonly settledAt: TimestampMs
    readonly deviceId: DeviceId
    readonly sequenceNumber: string
    readonly receivedAmount: NonNegativeInteger
    readonly tipAmount: NonNegativeInteger
  }): Task<EetSaleId | null, never, EvoluDep & EvoluOwnerDep & EetApiDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [existing] = await evolu.loadQuery(eetSaleByIdQuery(id))
    if (existing !== undefined) return ok(id)

    const settings = await loadEetSettings(evolu)
    const eic = settings?.eic ?? null
    const establishmentId = settings?.establishmentId ?? null
    if (settings === undefined || eic === null || establishmentId === null) {
      return ok(null)
    }

    const reportedAmount =
      settings.tipOwner === "employees"
        ? calculatePaymentBaseAmount({ amount: receivedAmount, tipAmount })
        : receivedAmount
    const reportedTipAmount =
      settings.tipOwner === "employees" ? NonNegativeInteger(0) : tipAmount
    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "eetSale",
        {
          id,
          paymentId: payment.id,
          billId: payment.billId,
          accountTransactionId,
          deviceId,
          method,
          amount: reportedAmount,
          reportedTipAmount,
          currency: payment.currency,
          environment: resolveEetEnvironment({
            environment: settings.environment,
            isTestCertificate: settings.isTestCertificate === sqliteTrue,
            isProductionAvailable: run.deps.eetApi.isProductionAvailable,
          }),
          eic,
          establishmentId,
          cashRegisterId: toEetCashRegisterId(deviceId),
          sequenceNumber: EetSequenceNumberSchema.decode(sequenceNumber),
          saleAt: formatEetDateTime(new Date(settledAt)),
          unsupportedReason: getEetUnsupportedReason({
            amount: reportedAmount,
            currency: payment.currency,
          }),
          hadUnansweredAttempt: sqliteFalse,
          attemptStartedAt: null,
          lastAttemptAt: null,
          lastAttemptResult: null,
          lastErrorType: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastGlobalTransactionId: null,
          extraFrom,
          isDeleted: sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(id)
  }

export const createEetSale = ({
  payment,
  deviceId,
}: {
  readonly payment: {
    readonly id: PaymentId
    readonly billId: BillId | null
    readonly amount: NonNegativeInteger
    readonly tipAmount: NonNegativeInteger
    readonly cashReceivedAmount: NonNegativeInteger | null
    readonly currency: FiatCurrency
    readonly method: AccountKind
    readonly firstClaimedAt: TimestampMs
    readonly firstClaimTransactionId: AccountTransactionId
    readonly firstSettlementValue: NonNegativeInteger
  }
  readonly deviceId: DeviceId
}): Task<EetSaleId | null, never, EvoluDep & EvoluOwnerDep & EetApiDep> => {
  return createEetSaleRecord({
    id: createEetSaleId({
      paymentId: payment.id,
      accountTransactionId: payment.firstClaimTransactionId,
    }),
    extraFrom: null,
    accountTransactionId: payment.firstClaimTransactionId,
    payment,
    method: payment.method,
    settledAt: payment.firstClaimedAt,
    deviceId,
    sequenceNumber: payment.id,
    receivedAmount:
      payment.method === "cashRegister"
        ? (payment.cashReceivedAmount ?? payment.amount)
        : payment.firstSettlementValue,
    tipAmount:
      payment.method === "cashRegister"
        ? deriveReceivedTipAmount(payment)
        : payment.tipAmount,
  })
}

export const createEetExtraSale = ({
  payment,
  due,
  deviceId,
}: {
  readonly payment: {
    readonly id: PaymentId
    readonly billId: BillId | null
    readonly currency: FiatCurrency
  }
  readonly due: EetExtraSaleDue
  readonly deviceId: DeviceId
}): Task<EetSaleId | null, never, EvoluDep & EvoluOwnerDep & EetApiDep> => {
  const id = createEetExtraSaleId({
    paymentId: payment.id,
    extraFrom: due.extraFrom,
  })

  return createEetSaleRecord({
    id,
    extraFrom: due.extraFrom,
    accountTransactionId: null,
    payment,
    method: due.claim.method,
    settledAt: due.claim.claimedAt,
    deviceId,
    sequenceNumber: id,
    receivedAmount: due.amount,
    tipAmount: NonNegativeInteger(0),
  })
}

const toNonEmpty255 = (value: string | null) =>
  value === null || value.trim() === ""
    ? null
    : NonEmptyString255(value.trim().slice(0, 255))

const toNonEmpty = (value: string) =>
  value.trim() === "" ? null : NonEmptyStringSchema.decode(value)

const toEetAttemptValues = (
  outcome: EetDeliveryOutcome,
  attemptedAt: TimestampMs
) => {
  switch (outcome.type) {
    case "accepted":
    case "verified":
      return {
        attempt: {
          lastAttemptAt: attemptedAt,
          lastGlobalTransactionId: toNonEmpty255(outcome.globalTransactionId),
        },
        confirmation:
          outcome.type === "accepted"
            ? ({
                pok: NonEmptyString255(outcome.pok),
                receivedAt: formatEetDateTime(new Date(outcome.receivedAt)),
                isTest: outcome.isTest ? sqliteTrue : sqliteFalse,
                warningsJson: z.encode(EetWarningsJson, outcome.warnings),
                messageUuid: NonEmptyString255(outcome.messageUuid),
                globalTransactionId: toNonEmpty255(outcome.globalTransactionId),
                isDeleted: sqliteFalse,
              } as const)
            : null,
      }
    case "retry":
    case "rejected":
      return {
        attempt: removeUndefinedValues({
          lastAttemptAt: attemptedAt,
          lastAttemptResult: outcome.type,
          lastErrorType: toNonEmpty255(outcome.errorType),
          lastErrorCode: outcome.code === null ? null : Integer(outcome.code),
          lastErrorMessage: toNonEmpty(outcome.message),
          lastGlobalTransactionId: toNonEmpty255(outcome.globalTransactionId),
          hadUnansweredAttempt: outcome.unanswered ? sqliteTrue : undefined,
        }),
        confirmation: null,
      }
  }
}

const recordEetDeliveryOutcome = (
  run: { readonly deps: EvoluDep & EvoluOwnerDep },
  {
    id,
    outcome,
    attemptedAt,
  }: {
    readonly id: EetSaleId
    readonly outcome: EetDeliveryOutcome
    readonly attemptedAt: TimestampMs
  },
  options: MutationOptions
): void => {
  const { evolu, evoluOwner } = run.deps
  const mutationOptions = { ...options, owner: evoluOwner }
  const { attempt, confirmation } = toEetAttemptValues(outcome, attemptedAt)

  evolu.update("eetSale", { id, ...attempt }, mutationOptions)
  if (confirmation !== null) {
    evolu.upsert(
      "eetSaleConfirmation",
      { id, ...confirmation },
      mutationOptions
    )
  }
}

const recordEetReversalDeliveryOutcome = (
  run: { readonly deps: EvoluDep & EvoluOwnerDep },
  {
    id,
    outcome,
    attemptedAt,
  }: {
    readonly id: EetReversalId
    readonly outcome: EetDeliveryOutcome
    readonly attemptedAt: TimestampMs
  },
  options: MutationOptions
): void => {
  const { evolu, evoluOwner } = run.deps
  const mutationOptions = { ...options, owner: evoluOwner }
  const { attempt, confirmation } = toEetAttemptValues(outcome, attemptedAt)

  evolu.update("eetReversal", { id, ...attempt }, mutationOptions)
  if (confirmation !== null) {
    evolu.upsert(
      "eetReversalConfirmation",
      { id, ...confirmation },
      mutationOptions
    )
  }
}

const toEetAttemptStartValues = (
  attempts: {
    readonly attemptStartedAt: TimestampMs | null
    readonly lastAttemptAt: TimestampMs | null
  },
  attemptStartedAt: TimestampMs
) =>
  removeUndefinedValues({
    attemptStartedAt,
    hadUnansweredAttempt: hasLostEetAnswer(attempts) ? sqliteTrue : undefined,
  })

const toSigningCertificate = (certificate: {
  readonly certificateDer: EetBase64
  readonly privateKeyPkcs8: EetBase64
}): EetSigningCertificate => ({
  certificateDer: eetBase64ToBytes(certificate.certificateDer),
  privateKeyPkcs8: eetBase64ToBytes(certificate.privateKeyPkcs8),
})

export const deliverEetSale =
  ({
    id,
    deviceId,
  }: {
    readonly id: EetSaleId
    readonly deviceId: DeviceId
  }): Task<
    EetDeliveryOutcome,
    DeliverEetSaleError,
    EvoluDep & EvoluOwnerDep & DateDep & EetApiDep & LockManagerDep
  > =>
  async (run) =>
    await run.deps.lockManager.request(
      `eet-sale-${id}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock === null) return err(createEetSaleBusyError({ id }))

        const { evolu, evoluOwner } = run.deps
        const saleResult = getFirstOr(
          await evolu.loadQuery(eetSaleByIdQuery(id)),
          createEetSaleNotFoundError({ id })
        )
        if (!saleResult.ok) return saleResult
        const sale = saleResult.value
        if (sale.pok !== null) {
          return err(createEetSaleAlreadyConfirmedError({ id }))
        }
        if (sale.unsupportedReason !== null) {
          return err(createEetSaleUnsupportedError({ id }))
        }

        const certificateResult = getFirstOr(
          await evolu.loadQuery(eetSigningCertificateQuery),
          createEetSigningCertificateMissingError()
        )
        if (!certificateResult.ok) return certificateResult
        const certificate = certificateResult.value

        const now = run.deps.date.now()
        const attemptedAt = TimestampMs(now.getTime())
        const firstSubmission = isEetFirstSending({
          attempts: sale,
          recordingDeviceId: sale.deviceId,
          deviceId,
          startsAt: parseEetDateTime(sale.saleAt),
          now,
        })
        await runMutationWithCompletion((options) =>
          evolu.update(
            "eetSale",
            { id, ...toEetAttemptStartValues(sale, attemptedAt) },
            { ...options, owner: evoluOwner }
          )
        )
        const { outcome } = await run.deps.eetApi.submit({
          environment: sale.environment,
          certificate: toSigningCertificate(certificate),
          receipt: {
            eic: sale.eic,
            establishmentId: sale.establishmentId,
            cashRegisterId: sale.cashRegisterId,
            sequenceNumber: sale.sequenceNumber,
            saleAt: sale.saleAt,
            totalAmount: minorUnitsToFixedDecimalString({
              value: sale.amount,
              currency: sale.currency,
            }),
          },
          firstSubmission,
          verification: false,
        })

        await runMutationWithCompletion((options) =>
          recordEetDeliveryOutcome(run, { id, outcome, attemptedAt }, options)
        )
        return ok(outcome)
      }
    )

export const retryEetSale =
  ({
    id,
    deviceId,
  }: {
    readonly id: EetSaleId
    readonly deviceId: DeviceId
  }): Task<
    EetDeliveryOutcome,
    DeliverEetSaleError,
    EvoluDep & EvoluOwnerDep & DateDep & EetApiDep & LockManagerDep
  > =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const saleResult = getFirstOr(
      await evolu.loadQuery(eetSaleByIdQuery(id)),
      createEetSaleNotFoundError({ id })
    )
    if (!saleResult.ok) return saleResult
    const sale = saleResult.value

    const settings = await loadEetSettings(evolu)
    const eic = settings?.eic ?? null
    const establishmentId = settings?.establishmentId ?? null
    const everyAttemptWasRejected =
      sale.lastAttemptResult === "rejected" &&
      sale.hadUnansweredAttempt !== sqliteTrue &&
      !hasLostEetAnswer(sale) &&
      sale.pok === null
    const hasChangedTaxpayerDetails =
      eic !== null &&
      establishmentId !== null &&
      (eic !== sale.eic || establishmentId !== sale.establishmentId)
    if (everyAttemptWasRejected && hasChangedTaxpayerDetails) {
      await runMutationWithCompletion((options) =>
        evolu.update(
          "eetSale",
          { id, eic, establishmentId },
          { ...options, owner: evoluOwner }
        )
      )
    }

    return await run(deliverEetSale({ id, deviceId }))
  }

export const createEetReversal =
  ({
    refund,
    deviceId,
  }: {
    readonly refund: {
      readonly id: RefundId
      readonly paymentId: PaymentId
      readonly amount: NonNegativeInteger
      /** The cash handed out of the register, `null` for any other refund. */
      readonly cashHandedAmount: NonNegativeInteger | null
      readonly isTip: typeof sqliteTrue | null
      readonly refundedAt: TimestampMs
      readonly saleId: EetSaleId
    }
    readonly deviceId: DeviceId
  }): Task<EetReversalId | null, never, EvoluDep & EvoluOwnerDep & EetApiDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const id = createEetReversalId(refund.id)
    const [existing] = await evolu.loadQuery(eetReversalByIdQuery(id))
    if (existing !== undefined) return ok(id)

    const [sale] = await evolu.loadQuery(eetSaleByIdQuery(refund.saleId))
    if (sale === undefined || sale.unsupportedReason !== null) return ok(null)
    const reversals = await evolu.loadQuery(
      eetReversalsByPaymentIdQuery(refund.paymentId)
    )
    const reversedAmount = reversals
      .filter(({ unsupportedReason }) => unsupportedReason === null)
      .reduce((sum, reversal) => sum + reversal.amount, 0)
    const sales = await evolu.loadQuery(
      eetSalesByPaymentIdQuery(refund.paymentId)
    )
    const reportedAmount = sales
      .filter(({ unsupportedReason }) => unsupportedReason === null)
      .reduce((sum, paymentSale) => sum + paymentSale.amount, 0)
    const reversibleAmount = deriveEetReversibleRefundAmount({
      amount: refund.amount,
      cashHandedAmount: refund.cashHandedAmount,
      isTip: isTipRefund(refund),
      reportedTipAmount: sale.reportedTipAmount,
    })
    const amount = Math.min(reversibleAmount, reportedAmount - reversedAmount)
    if (amount <= 0) return ok(null)

    const settings = await loadEetSettings(evolu)
    const eic = settings?.eic ?? null
    const establishmentId = settings?.establishmentId ?? null
    const environment =
      settings === undefined
        ? sale.environment
        : resolveEetEnvironment({
            environment: settings.environment,
            isTestCertificate: settings.isTestCertificate === sqliteTrue,
            isProductionAvailable: run.deps.eetApi.isProductionAvailable,
          })
    const unsupportedReason =
      (settings?.enabledAt ?? null) === null ||
      eic === null ||
      establishmentId === null
        ? "disabled"
        : environment !== sale.environment
          ? "environment"
          : eic !== sale.eic
            ? "taxpayer"
            : null

    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "eetReversal",
        {
          id,
          refundId: refund.id,
          saleId: sale.id,
          paymentId: refund.paymentId,
          deviceId,
          amount: NonNegativeInteger(amount),
          currency: sale.currency,
          environment,
          eic: eic ?? sale.eic,
          establishmentId: establishmentId ?? sale.establishmentId,
          cashRegisterId: toEetCashRegisterId(deviceId),
          sequenceNumber: EetSequenceNumberSchema.decode(refund.id),
          saleAt: formatEetDateTime(new Date(refund.refundedAt)),
          unsupportedReason,
          hadUnansweredAttempt: sqliteFalse,
          attemptStartedAt: null,
          lastAttemptAt: null,
          lastAttemptResult: null,
          lastErrorType: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastGlobalTransactionId: null,
          isDeleted: sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok(id)
  }

export const deliverEetReversal =
  ({
    id,
    deviceId,
  }: {
    readonly id: EetReversalId
    readonly deviceId: DeviceId
  }): Task<
    EetDeliveryOutcome,
    DeliverEetReversalError,
    EvoluDep & EvoluOwnerDep & DateDep & EetApiDep & LockManagerDep
  > =>
  async (run) =>
    await run.deps.lockManager.request(
      `eet-reversal-${id}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock === null) return err(createEetSaleBusyError({ id }))

        const { evolu, evoluOwner } = run.deps
        const reversalResult = getFirstOr(
          await evolu.loadQuery(eetReversalByIdQuery(id)),
          createEetSaleNotFoundError({ id })
        )
        if (!reversalResult.ok) return reversalResult
        const reversal = reversalResult.value
        if (reversal.pok !== null) {
          return err(createEetSaleAlreadyConfirmedError({ id }))
        }
        if (reversal.unsupportedReason !== null) {
          return err(createEetSaleUnsupportedError({ id }))
        }
        if (reversal.saleConfirmedAt === null) {
          return err(createEetReversalWaitingForSaleError({ id }))
        }

        const certificateResult = getFirstOr(
          await evolu.loadQuery(eetSigningCertificateQuery),
          createEetSigningCertificateMissingError()
        )
        if (!certificateResult.ok) return certificateResult
        const certificate = certificateResult.value

        const now = run.deps.date.now()
        const attemptedAt = TimestampMs(now.getTime())
        const firstSubmission = isEetFirstSending({
          attempts: reversal,
          recordingDeviceId: reversal.deviceId,
          deviceId,
          startsAt: getEetReversalStartsAt({
            refundedAt: parseEetDateTime(reversal.saleAt),
            saleConfirmedAt: reversal.saleConfirmedAt,
          }),
          now,
        })
        await runMutationWithCompletion((options) =>
          evolu.update(
            "eetReversal",
            { id, ...toEetAttemptStartValues(reversal, attemptedAt) },
            { ...options, owner: evoluOwner }
          )
        )
        const { outcome } = await run.deps.eetApi.submit({
          environment: reversal.environment,
          certificate: toSigningCertificate(certificate),
          receipt: {
            eic: reversal.eic,
            establishmentId: reversal.establishmentId,
            cashRegisterId: reversal.cashRegisterId,
            sequenceNumber: reversal.sequenceNumber,
            saleAt: reversal.saleAt,
            totalAmount: minorUnitsToFixedDecimalString({
              value: Integer(-reversal.amount),
              currency: reversal.currency,
            }),
          },
          firstSubmission,
          verification: false,
        })

        await runMutationWithCompletion((options) =>
          recordEetReversalDeliveryOutcome(
            run,
            { id, outcome, attemptedAt },
            options
          )
        )
        return ok(outcome)
      }
    )

export const sendEetTestMessage =
  ({
    kind,
    deviceId,
  }: {
    readonly kind: "verification" | "sale"
    readonly deviceId: DeviceId
  }): Task<
    EetSubmission,
    EetConfigurationIncompleteError | EetTestSaleOutsidePlaygroundError,
    EvoluDep & DateDep & EetApiDep
  > =>
  async (run) => {
    const { evolu, eetApi } = run.deps
    const now = run.deps.date.now()
    const settings = await loadEetSettings(evolu)
    const [certificate] = await evolu.loadQuery(eetSigningCertificateQuery)
    const establishmentId = settings?.establishmentId ?? null
    const missing = findEetConfigurationGaps({
      validTo: settings?.validTo ?? null,
      establishmentId,
      now,
    })
    if (
      missing.length > 0 ||
      certificate === undefined ||
      establishmentId === null
    ) {
      return err(createEetConfigurationIncompleteError({ missing }))
    }

    const environment = resolveEetEnvironment({
      environment: settings?.environment ?? null,
      isTestCertificate: certificate.isTestCertificate === sqliteTrue,
      isProductionAvailable: eetApi.isProductionAvailable,
    })
    if (kind === "sale" && environment !== "playground") {
      return err(createEetTestSaleOutsidePlaygroundError())
    }

    const receipt: EetReceipt = {
      eic: certificate.eic,
      establishmentId,
      cashRegisterId: toEetCashRegisterId(deviceId),
      sequenceNumber: `test-${now.getTime()}`,
      saleAt: formatEetDateTime(now),
      totalAmount: "1.00",
    }

    return ok(
      await eetApi.submit({
        environment,
        certificate: toSigningCertificate(certificate),
        receipt,
        firstSubmission: true,
        verification: kind === "verification",
      })
    )
  }
