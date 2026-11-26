import type { AccountId } from "../modules/account/account-types.ts"
import type { PaymentId } from "../modules/payment/payment-types.ts"
import type {
  NonEmptyString,
  NonNegativeInteger,
} from "../modules/shared/schema.ts"

/**
 * A payment the payment wait screen is waiting for, with what the Spark sync
 * job matches an arriving transfer against. In memory only: nothing is
 * stored or synced.
 */
export interface AwaitedPayment {
  readonly paymentId: PaymentId
  readonly accountId: AccountId
  readonly amountSats: NonNegativeInteger
  readonly lnInvoice: NonEmptyString | null
  readonly sparkInvoice: NonEmptyString | null
}

/** What an arriving transfer is matched by. */
export interface AwaitedPaymentValues {
  readonly accountId: AccountId
  readonly amountSats: NonNegativeInteger
  readonly lnInvoice: NonEmptyString | null
  readonly sparkInvoice: NonEmptyString | null
}

export interface AwaitedPaymentsDep {
  readonly awaitedPayments: {
    /**
     * The screen: registers `payment`; `onRecorded` runs once the job has
     * queued its mutation. Disposing removes the registration.
     */
    readonly await: (
      payment: AwaitedPayment,
      onRecorded: () => void
    ) => Disposable
    /** The job: the registration matching a transfer's values, if any. */
    readonly find: (values: AwaitedPaymentValues) => AwaitedPayment | undefined
    /**
     * The job: the payment's mutation is queued. Runs its callback once and
     * removes the registration; a payment nobody awaits is ignored.
     */
    readonly recorded: (paymentId: PaymentId) => void
  }
}

/**
 * Whether `values` match `payment` exactly as
 * `sparkReconciliationCandidateByValuesQuery` matches them: the same account
 * and amount, and the same non-null Lightning or Spark invoice.
 */
export const matchesAwaitedPayment = (
  payment: AwaitedPayment,
  values: AwaitedPaymentValues
): boolean =>
  payment.accountId === values.accountId &&
  payment.amountSats === values.amountSats &&
  ((values.lnInvoice !== null && payment.lnInvoice === values.lnInvoice) ||
    (values.sparkInvoice !== null &&
      payment.sparkInvoice === values.sparkInvoice))

interface Registration {
  readonly payment: AwaitedPayment
  readonly onRecorded: () => void
}

export const createAwaitedPayments =
  (): AwaitedPaymentsDep["awaitedPayments"] => {
    // ponytail: linear scan, there is at most one waiting screen at a time.
    let registrations: ReadonlyArray<Registration> = []

    const remove = (registration: Registration) => {
      registrations = registrations.filter((other) => other !== registration)
    }

    return {
      await: (payment, onRecorded) => {
        const registration: Registration = { payment, onRecorded }
        registrations = [...registrations, registration]
        return { [Symbol.dispose]: () => remove(registration) }
      },
      find: (values) =>
        registrations.find(({ payment }) =>
          matchesAwaitedPayment(payment, values)
        )?.payment,
      recorded: (paymentId) => {
        for (const registration of registrations) {
          if (registration.payment.paymentId !== paymentId) continue
          remove(registration)
          try {
            registration.onRecorded()
          } catch {
            // A failing screen must not fail the job's record; the screen
            // still shows Paid from the data once the commit lands.
          }
        }
      },
    }
  }
