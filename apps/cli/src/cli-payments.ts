import { evoluJsonObjectFrom, ok, type Task } from "@evolu/common"
import type { DateDep, EvoluOwnerDep, FetchDep } from "@payky/core/deps"
import { createQuery } from "@payky/core/evolu/schema"
import type { YadioApiDep } from "@payky/core/integrations/yadio/yadio-client"
import { AccountId } from "@payky/core/modules/account/account-types"
import { BillId } from "@payky/core/modules/bill/bill-types"
import { DeviceId } from "@payky/core/modules/device/device-types"
import {
  deletePayment,
  loadPayment,
  updatePayment,
} from "@payky/core/modules/payment/payment-actions"
import { createPreparedPayment } from "@payky/core/modules/payment/payment-preparation-actions"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import {
  FiatCurrencySchema,
  NonEmptyStringSchema,
  NonNegativeIntegerFromStringSchema,
  PositiveNumberFromStringSchema,
  SpecificSymbolSchema,
  TimestampMsSchema,
  VariableSymbolSchema,
} from "@payky/core/modules/shared/schema"
import { TableId } from "@payky/core/modules/table/table-types"
import type { SparkWalletDep } from "@payky/core/spark/spark-wallet"
import { type Command, createCommand } from "commander"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"
import { printCliError } from "./cli-errors.ts"

const TimestampMsFromStringSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim()
  const timestamp = /^\d+$/u.test(trimmed)
    ? Number(trimmed)
    : Date.parse(trimmed)
  const parsed = TimestampMsSchema.safeParse(timestamp)

  if (!parsed.success) {
    ctx.addIssue({
      code: "custom",
      message: "Expected a timestamp in milliseconds or a valid date string.",
    })
    return z.NEVER
  }

  return parsed.data
})

const paymentsWithDetailsQuery = createQuery((db) =>
  db
    .selectFrom("payment")
    .select((eb) => [
      "payment.id",
      "payment.deviceId",
      "payment.billId",
      "payment.tableId",
      "payment.amount",
      "payment.currency",
      "payment.tipAmount",
      "payment.canceledAt",
      evoluJsonObjectFrom(
        eb
          .selectFrom("paymentCashRegister")
          .select(["paymentCashRegister.accountId"])
          .whereRef("paymentCashRegister.id", "=", "payment.id")
      ).as("cashRegister"),
      evoluJsonObjectFrom(
        eb
          .selectFrom("paymentBtc")
          .leftJoin("paymentBtcLightning", (join) =>
            join
              .onRef("paymentBtcLightning.id", "=", "paymentBtc.id")
              .on("paymentBtcLightning.isDeleted", "is not", 1)
          )
          .leftJoin("paymentBtcSpark", (join) =>
            join
              .onRef("paymentBtcSpark.id", "=", "paymentBtc.id")
              .on("paymentBtcSpark.isDeleted", "is not", 1)
          )
          .select([
            "paymentBtc.accountId",
            "paymentBtc.amountSats",
            "paymentBtc.exchangeRate",
            "paymentBtc.exchangeRateSource",
            "paymentBtc.exchangeRateFetchedAt",
            "paymentBtcLightning.lnInvoice",
            "paymentBtcLightning.lightningReceiveRequestId",
            "paymentBtcLightning.paymentHash",
            "paymentBtcLightning.paymentPreimage",
            "paymentBtcSpark.sparkInvoice",
          ])
          .whereRef("paymentBtc.id", "=", "payment.id")
      ).as("spark"),
      evoluJsonObjectFrom(
        eb
          .selectFrom("paymentIban")
          .select([
            "paymentIban.accountId",
            "paymentIban.variableSymbol",
            "paymentIban.specificSymbol",
          ])
          .whereRef("paymentIban.id", "=", "payment.id")
      ).as("iban"),
    ])
    .where("payment.amount", "is not", null)
    .where("payment.currency", "is not", null)
    .where("payment.tipAmount", "is not", null)
    .where("payment.isDeleted", "is", null)
    .orderBy("payment.createdAt", "desc")
)

const paymentWithDetailsByIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .select((eb) => [
        "payment.id",
        "payment.deviceId",
        "payment.billId",
        "payment.tableId",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.isDeleted",
        evoluJsonObjectFrom(
          eb
            .selectFrom("paymentCashRegister")
            .select(["paymentCashRegister.accountId"])
            .whereRef("paymentCashRegister.id", "=", "payment.id")
        ).as("cashRegister"),
        evoluJsonObjectFrom(
          eb
            .selectFrom("paymentBtc")
            .leftJoin("paymentBtcLightning", (join) =>
              join
                .onRef("paymentBtcLightning.id", "=", "paymentBtc.id")
                .on("paymentBtcLightning.isDeleted", "is not", 1)
            )
            .leftJoin("paymentBtcSpark", (join) =>
              join
                .onRef("paymentBtcSpark.id", "=", "paymentBtc.id")
                .on("paymentBtcSpark.isDeleted", "is not", 1)
            )
            .select([
              "paymentBtc.accountId",
              "paymentBtc.amountSats",
              "paymentBtc.exchangeRate",
              "paymentBtc.exchangeRateSource",
              "paymentBtc.exchangeRateFetchedAt",
              "paymentBtcLightning.lnInvoice",
              "paymentBtcLightning.lightningReceiveRequestId",
              "paymentBtcLightning.paymentHash",
              "paymentBtcLightning.paymentPreimage",
              "paymentBtcSpark.sparkInvoice",
            ])
            .whereRef("paymentBtc.id", "=", "payment.id")
        ).as("spark"),
        evoluJsonObjectFrom(
          eb
            .selectFrom("paymentIban")
            .select([
              "paymentIban.accountId",
              "paymentIban.variableSymbol",
              "paymentIban.specificSymbol",
            ])
            .whereRef("paymentIban.id", "=", "payment.id")
        ).as("iban"),
      ])
      .where("payment.id", "=", id)
  )

type IbanInputResult =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | {
      readonly kind: "value"
      readonly iban: {
        readonly accountId: AccountId
        readonly variableSymbol: z.output<typeof VariableSymbolSchema> | null
        readonly specificSymbol: z.output<typeof SpecificSymbolSchema> | null
      }
    }

const parseIbanInput = (options: {
  readonly ibanAccountId?: AccountId
  readonly variableSymbol?: z.output<typeof VariableSymbolSchema>
  readonly specificSymbol?: z.output<typeof SpecificSymbolSchema>
}): IbanInputResult => {
  const hasIbanInput =
    options.ibanAccountId !== undefined ||
    options.variableSymbol !== undefined ||
    options.specificSymbol !== undefined

  if (!hasIbanInput) return { kind: "absent" }
  if (options.ibanAccountId === undefined) return { kind: "invalid" }

  return {
    kind: "value",
    iban: {
      accountId: options.ibanAccountId,
      variableSymbol: options.variableSymbol ?? null,
      specificSymbol: options.specificSymbol ?? null,
    },
  }
}

export const registerPaymentsCommand =
  (
    program: Command
  ): Task<
    void,
    never,
    EvoluDep & EvoluOwnerDep & DateDep & FetchDep & SparkWalletDep & YadioApiDep
  > =>
  (run) => {
    const { evolu } = run.deps

    const paymentsCommand = createCommand("payments").description(
      "Manage payment requests and receipts."
    )

    paymentsCommand

      .addCommand(
        zodCommand({
          name: "list",
          description: "List active payments with payment method details.",
          args: {},
          opts: {},
          async action() {
            run.deps.console.log(
              JSON.stringify(
                await evolu.loadQuery(paymentsWithDetailsQuery),
                null,
                2
              )
            )

            console.table(await evolu.loadQuery(paymentsWithDetailsQuery))
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "get",
          description: "Show one payment by id.",
          args: {},
          opts: {
            id: PaymentId.describe("Payment id"),
          },
          async action(_, options) {
            console.table(
              await evolu.loadQuery(paymentWithDetailsByIdQuery(options.id))
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "create",
          description:
            "Create a payment with optional method-specific details.",
          args: {},
          opts: {
            amount:
              NonNegativeIntegerFromStringSchema.describe("a;Payment amount"),
            currency: FiatCurrencySchema.describe("c;Payment currency"),
            tipAmount:
              NonNegativeIntegerFromStringSchema.describe("t;Tip amount"),
            deviceId: DeviceId.optional().describe(
              "Device id that created the payment"
            ),
            billId: BillId.optional().describe("Related bill id"),
            tableId: TableId.optional().describe("Related table id"),
            canceledAt: TimestampMsFromStringSchema.optional().describe(
              "Cancellation timestamp, as milliseconds or a date string"
            ),
            cashRegisterAccountId: AccountId.optional().describe(
              "Cash register account id"
            ),
            sparkAccountId: AccountId.optional().describe("Spark account id"),
            ibanAccountId: AccountId.optional().describe("IBAN account id"),
            variableSymbol: VariableSymbolSchema.optional().describe(
              "IBAN variable symbol"
            ),
            specificSymbol: SpecificSymbolSchema.optional().describe(
              "IBAN specific symbol"
            ),
          },
          async action(_, options) {
            const ibanInput = parseIbanInput(options)

            if (ibanInput.kind === "invalid") {
              printCliError(
                run.deps.console,
                "IBAN payment requires --ibanAccountId."
              )
              return
            }

            const paymentId = await run.orThrow(
              createPreparedPayment({
                deviceId: options.deviceId ?? null,
                billId: options.billId ?? null,
                tableId: options.tableId ?? null,
                amount: options.amount,
                currency: options.currency,
                tipAmount: options.tipAmount,
                canceledAt: options.canceledAt ?? null,
                ...(options.cashRegisterAccountId === undefined
                  ? {}
                  : {
                      cashRegister: {
                        accountId: options.cashRegisterAccountId,
                      },
                    }),
                ...(options.sparkAccountId === undefined
                  ? {}
                  : {
                      spark: {
                        accountId: options.sparkAccountId,
                      },
                    }),
                ...(ibanInput.kind === "value" ? { iban: ibanInput.iban } : {}),
              })
            )

            run.deps.console.log(`Inserted payment ${paymentId}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "update",
          description: "Update a payment and optional method-specific details.",
          args: {},
          opts: {
            id: PaymentId.describe("Payment id"),
            amount:
              NonNegativeIntegerFromStringSchema.optional().describe(
                "a;Payment amount"
              ),
            currency:
              FiatCurrencySchema.optional().describe("c;Payment currency"),
            tipAmount:
              NonNegativeIntegerFromStringSchema.optional().describe(
                "t;Tip amount"
              ),
            deviceId: DeviceId.optional().describe(
              "Device id that updated the payment"
            ),
            // No --billId: `updatePayment` does not move a payment onto a
            // bill (payment/0012).
            tableId: TableId.optional().describe("Related table id"),
            canceledAt: TimestampMsFromStringSchema.optional().describe(
              "Cancellation timestamp, as milliseconds or a date string"
            ),
            cashRegisterAccountId: AccountId.optional().describe(
              "Cash register account id"
            ),
            sparkAccountId: AccountId.optional().describe("Spark account id"),
            amountSats: NonNegativeIntegerFromStringSchema.optional().describe(
              "Spark amount in satoshis"
            ),
            exchangeRate: PositiveNumberFromStringSchema.optional().describe(
              "Spark exchange rate"
            ),
            exchangeRateFetchedAt:
              TimestampMsFromStringSchema.optional().describe(
                "Exchange rate fetch time, as milliseconds or a date string"
              ),
            lnInvoice:
              NonEmptyStringSchema.optional().describe("Lightning invoice"),
            sparkInvoice:
              NonEmptyStringSchema.optional().describe("Spark invoice"),
            lightningReceiveRequestId: NonEmptyStringSchema.optional().describe(
              "Lightning receive request id"
            ),
            paymentHash: NonEmptyStringSchema.optional().describe(
              "Lightning payment hash"
            ),
            paymentPreimage: NonEmptyStringSchema.optional().describe(
              "Lightning payment preimage"
            ),
            ibanAccountId: AccountId.optional().describe("IBAN account id"),
            variableSymbol: VariableSymbolSchema.optional().describe(
              "IBAN variable symbol"
            ),
            specificSymbol: SpecificSymbolSchema.optional().describe(
              "IBAN specific symbol"
            ),
          },
          async action(_, options) {
            await run.orThrow(loadPayment(options.id))

            const hasSparkInput =
              options.sparkAccountId !== undefined ||
              options.amountSats !== undefined ||
              options.exchangeRate !== undefined ||
              options.exchangeRateFetchedAt !== undefined ||
              options.lnInvoice !== undefined ||
              options.sparkInvoice !== undefined ||
              options.lightningReceiveRequestId !== undefined ||
              options.paymentHash !== undefined ||
              options.paymentPreimage !== undefined
            const hasIbanInput =
              options.ibanAccountId !== undefined ||
              options.variableSymbol !== undefined ||
              options.specificSymbol !== undefined

            await run.ok(
              updatePayment({
                id: options.id,
                deviceId: options.deviceId,
                tableId: options.tableId,
                amount: options.amount,
                currency: options.currency,
                tipAmount: options.tipAmount,
                canceledAt: options.canceledAt,
                ...(options.cashRegisterAccountId === undefined
                  ? {}
                  : {
                      cashRegister: {
                        accountId: options.cashRegisterAccountId,
                      },
                    }),
                ...(hasSparkInput
                  ? {
                      spark: {
                        accountId: options.sparkAccountId,
                        amountSats: options.amountSats,
                        exchangeRate: options.exchangeRate,
                        exchangeRateSource: undefined,
                        exchangeRateFetchedAt: options.exchangeRateFetchedAt,
                        lightning:
                          options.lnInvoice === undefined
                            ? undefined
                            : {
                                lnInvoice: options.lnInvoice,
                                lightningReceiveRequestId:
                                  options.lightningReceiveRequestId,
                                paymentHash: options.paymentHash,
                                paymentPreimage: options.paymentPreimage,
                              },
                        sparkInvoice:
                          options.sparkInvoice === undefined
                            ? undefined
                            : {
                                sparkInvoice: options.sparkInvoice,
                              },
                      },
                    }
                  : {}),
                ...(hasIbanInput
                  ? {
                      iban: {
                        accountId: options.ibanAccountId,
                        variableSymbol: options.variableSymbol,
                        specificSymbol: options.specificSymbol,
                      },
                    }
                  : {}),
              })
            )

            run.deps.console.log(`Updated payment ${options.id}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "delete",
          description: "Soft delete a payment.",
          args: {},
          opts: {
            id: PaymentId.describe("Payment id"),
          },
          async action(_, options) {
            await run.ok(deletePayment(options.id))
            run.deps.console.log(`Deleted payment ${options.id}`)
          },
        })
      )

    program.addCommand(paymentsCommand)
    return ok(undefined)
  }
