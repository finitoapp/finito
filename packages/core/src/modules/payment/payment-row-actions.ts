import type { InsertValues, MutationOptions, UpsertValues } from "@evolu/common"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { removeUndefinedValues } from "../shared/evolu-utils.ts"
import type { WithSparkDetails } from "../shared/spark-details.ts"
import type { SelfPayPointer } from "../table-self-pay/table-self-pay-reference-utils.ts"
import type {
  payment,
  paymentBtc,
  paymentBtcLightning,
  paymentBtcSpark,
  paymentIban,
} from "./payment.ts"
import type { PaymentId } from "./payment-types.ts"

export type PaymentBtcInput = WithSparkDetails<
  Omit<InsertValues<typeof paymentBtc>, "id">,
  Omit<InsertValues<typeof paymentBtcLightning>, "id">,
  Omit<InsertValues<typeof paymentBtcSpark>, "id">
>

/**
 * Writes a payment's Spark detail rows: the `paymentBtc` base row plus
 * whichever of `paymentBtcLightning`/`paymentBtcSpark` the quote produced.
 * Shared by `createPayment` and `preparePaymentMethod`, which must agree on
 * exactly this field set — a payment prepared through one path would
 * otherwise carry different Spark details than through the other.
 *
 * Upsert only. `updatePayment` writes the same three tables with `update`,
 * whose values are all-optional where `UpsertValues` requires every
 * non-nullable column, so folding both modes in here would mean widening this
 * to accept a partial `paymentBtc` — losing the guarantee that a created
 * payment has a complete Spark row.
 */
export const upsertPaymentSparkDetails = (
  evolu: EvoluDep["evolu"],
  id: PaymentId,
  spark: PaymentBtcInput,
  options: MutationOptions
): void => {
  evolu.upsert(
    "paymentBtc",
    removeUndefinedValues({
      accountId: spark.accountId,
      amountSats: spark.amountSats,
      exchangeRate: spark.exchangeRate,
      exchangeRateSource: spark.exchangeRateSource,
      exchangeRateFetchedAt: spark.exchangeRateFetchedAt,
      id,
    }),
    options
  )
  if (spark.lightning) {
    evolu.upsert(
      "paymentBtcLightning",
      removeUndefinedValues({ ...spark.lightning, id }),
      options
    )
  }
  if (spark.sparkInvoice) {
    evolu.upsert(
      "paymentBtcSpark",
      removeUndefinedValues({ ...spark.sparkInvoice, id }),
      options
    )
  }
}

export interface SelfPayPaymentRows {
  readonly payment: UpsertValues<typeof payment>
  readonly iban: Omit<UpsertValues<typeof paymentIban>, "id"> | null
  readonly spark: PaymentBtcInput | null
  readonly pointer: SelfPayPointer | null
}

export const upsertSelfPayPaymentRows = (
  evolu: EvoluDep["evolu"],
  { payment, iban, spark, pointer }: SelfPayPaymentRows,
  options: MutationOptions
): void => {
  evolu.upsert("payment", removeUndefinedValues(payment), options)
  if (iban !== null) {
    evolu.upsert(
      "paymentIban",
      removeUndefinedValues({ ...iban, id: payment.id }),
      options
    )
  }
  if (spark !== null) {
    upsertPaymentSparkDetails(evolu, payment.id, spark, options)
  }
  evolu.upsert("paymentSelfPay", { id: payment.id, pointer }, options)
}
