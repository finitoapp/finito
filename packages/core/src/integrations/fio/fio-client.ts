import { err, ok, type Result, type Task } from "@evolu/common"
import type { JsonValue } from "type-fest"
import { z } from "zod"

import {
  appFetchAsJson,
  type DateDep,
  type FetchDep,
  type FetchError,
  type FetchJsonError,
  validateJsonResponse,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import { signedDecimalAmountToMinorUnits } from "../../modules/shared/money.ts"
import {
  ConstantSymbolSchema,
  type DateString,
  DateStringSchema,
  type FiatCurrency,
  FiatCurrencySchema,
  type Iban,
  IbanSchema,
  SpecificSymbolSchema,
  VariableSymbolSchema,
} from "../../modules/shared/schema.ts"

const FIO_BASE_URL = "https://fioapi.fio.cz"

export interface FioApiOptions {
  readonly tokens: readonly [string, ...string[]]
  readonly baseUrl?: string
  readonly restingUntilByToken?: Map<string, number>
}

const FIO_TOKEN_REST_MS = 30 * 1000

export interface FioApiDep {
  readonly fioApi: {
    readonly baseUrl: string
    readonly takeToken: (now: Date) => Result<string, FioAllTokensRestingError>
    readonly restToken: (token: string, usedAt: Date) => void
  }
}

export const createFioApiDep = ({
  tokens,
  baseUrl = FIO_BASE_URL,
  restingUntilByToken = new Map(),
}: FioApiOptions): FioApiDep => {
  let tokenIndex = 0

  return {
    fioApi: {
      baseUrl,
      takeToken: (now) => {
        for (let offset = 0; offset < tokens.length; offset++) {
          const index = (tokenIndex + offset) % tokens.length
          const token = tokens[index] ?? tokens[0]
          const restingUntil = restingUntilByToken.get(token) ?? 0
          if (restingUntil <= now.getTime()) {
            tokenIndex = (index + 1) % tokens.length
            restingUntilByToken.set(token, now.getTime() + FIO_TOKEN_REST_MS)
            return ok(token)
          }
        }

        return err(
          createFioAllTokensRestingError({
            retryAt: Math.min(
              ...tokens.map((token) => restingUntilByToken.get(token) ?? 0)
            ),
          })
        )
      },
      restToken: (token, usedAt) => {
        restingUntilByToken.set(
          token,
          Math.max(
            restingUntilByToken.get(token) ?? 0,
            usedAt.getTime() + FIO_TOKEN_REST_MS
          )
        )
      },
    },
  }
}

const createFioAllTokensRestingError = defineError("FioAllTokensRestingError")<{
  readonly retryAt: number
}>()
export type FioAllTokensRestingError = ReturnType<
  typeof createFioAllTokensRestingError
>

const createFioApiError = defineError("FioApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause: unknown
}>()
export type FioApiError = ReturnType<typeof createFioApiError>

const createFioHttpError = defineError("FioHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type FioHttpError = ReturnType<typeof createFioHttpError>

const createFioRateLimitError = defineError("FioRateLimitError")<{
  readonly message: string
  readonly status: 409
  readonly responseBody: string
}>()
export type FioRateLimitError = ReturnType<typeof createFioRateLimitError>

const createFioStrongAuthorizationRequiredError = defineError(
  "FioStrongAuthorizationRequiredError"
)<{
  readonly message: string
  readonly status: 422
  readonly responseBody: string
}>()
export type FioStrongAuthorizationRequiredError = ReturnType<
  typeof createFioStrongAuthorizationRequiredError
>

const FioValueSchema = z.union([z.string(), z.number()])

const FioRawTransactionSchema = z
  .record(
    z.string(),
    z
      .object({
        value: FioValueSchema,
        name: z.string(),
      })
      .nullable()
  )
  .transform((columns): Readonly<Record<string, string | number>> => {
    const normalized: Record<string, string | number> = {}

    for (const column of Object.values(columns)) {
      if (column === null) continue
      normalized[column.name] = column.value
    }

    return normalized
  })

const FioDateSchema = z.string().transform((value, ctx): DateString => {
  const date = value.slice(0, 10)
  const parsed = DateStringSchema.safeParse(date)

  if (!parsed.success) {
    ctx.issues.push({
      code: "custom",
      message: "Invalid FIO transaction date.",
      input: value,
    })
    return z.NEVER
  }

  return parsed.data
})

const FioOptionalSymbolSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) return null

    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  })

const FioOptionalStringSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) return null

    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  })

const nullableParse =
  <TSchema extends z.ZodType>(schema: TSchema) =>
  (value: string | null): z.output<TSchema> | null => {
    if (value === null) return null

    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : null
  }

const FioTransactionSchema = z
  .looseObject({
    "ID pohybu": FioValueSchema.transform((value) => String(value)),
    Datum: FioDateSchema,
    Objem: FioValueSchema,
    Měna: FiatCurrencySchema,
    Protiúčet: FioOptionalStringSchema,
    "Název protiúčtu": FioOptionalStringSchema,
    "Kód banky": FioOptionalStringSchema,
    "Název banky": FioOptionalStringSchema,
    KS: FioOptionalSymbolSchema,
    VS: FioOptionalSymbolSchema,
    SS: FioOptionalSymbolSchema,
    "Uživatelská identifikace": FioOptionalStringSchema,
    "Zpráva pro příjemce": FioOptionalStringSchema,
    Typ: FioOptionalStringSchema,
    "ID pokynu": FioOptionalStringSchema,
  })
  .transform((transaction, ctx) => {
    const amountMinor = signedDecimalAmountToMinorUnits({
      currency: transaction.Měna,
      value: transaction.Objem,
    })
    if (amountMinor === null) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid FIO amount: ${String(transaction.Objem)}`,
        input: transaction.Objem,
      })
      return z.NEVER
    }

    return {
      id: transaction["ID pohybu"],
      bookedDate: transaction.Datum,
      amountMinor,
      currency: transaction.Měna,
      counterAccountNumber: transaction.Protiúčet,
      counterAccountName: transaction["Název protiúčtu"],
      counterBankCode: transaction["Kód banky"],
      counterBankName: transaction["Název banky"],
      constantSymbol: nullableParse(ConstantSymbolSchema)(transaction.KS),
      variableSymbol: nullableParse(VariableSymbolSchema)(transaction.VS),
      specificSymbol: nullableParse(SpecificSymbolSchema)(transaction.SS),
      userIdentification: transaction["Uživatelská identifikace"],
      recipientMessage: transaction["Zpráva pro příjemce"],
      type: transaction.Typ,
      instructionId: transaction["ID pokynu"],
      raw: transaction,
    }
  })

const FioTransactionListSchema = z.object({
  transaction: z
    .union([FioRawTransactionSchema, FioRawTransactionSchema.array()])
    .optional()
    .transform((transactions, ctx): ReadonlyArray<FioTransaction> => {
      const rawTransactions =
        transactions === undefined
          ? []
          : Array.isArray(transactions)
            ? transactions
            : [transactions]
      const parsed = FioTransactionSchema.array().safeParse(rawTransactions)

      if (!parsed.success) {
        ctx.issues.push({
          code: "custom",
          message: "Invalid FIO transaction list.",
          input: transactions,
        })
        return z.NEVER
      }

      return parsed.data
    }),
})

const FioAccountStatementSchema = z.object({
  accountStatement: z.object({
    info: z.looseObject({
      iban: IbanSchema,
      currency: FiatCurrencySchema.optional(),
    }),
    transactionList: FioTransactionListSchema,
  }),
})

export type FioTransaction = z.output<typeof FioTransactionSchema>

export interface FioAccountStatement {
  readonly iban: Iban
  readonly currency: FiatCurrency | null
  readonly transactions: ReadonlyArray<FioTransaction>
}

type FioTask<TResult> = Task<
  TResult,
  | FioAllTokensRestingError
  | FioApiError
  | FioHttpError
  | FioRateLimitError
  | FioStrongAuthorizationRequiredError
  | FetchError,
  FioApiDep & FetchDep & DateDep
>

export const fetchFioLastTransactions = (): FioTask<FioAccountStatement> =>
  getFioStatement((token) => `/v1/rest/last/${token}/transactions.json`)

export const fetchFioTransactionsByPeriod = ({
  from,
  to,
}: {
  readonly from: DateString
  readonly to: DateString
}): FioTask<FioAccountStatement> =>
  getFioStatement(
    (token) => `/v1/rest/periods/${token}/${from}/${to}/transactions.json`
  )

export const setFioLastDate =
  ({ date }: { readonly date: DateString }): FioTask<string> =>
  async (run) => {
    const response = await run(
      fetchFioApi((token) => `/v1/rest/set-last-date/${token}/${date}/`)
    )
    if (!response.ok) return response
    if (!response.value.ok) {
      return err(
        toFioHttpError({
          status: response.value.status,
          responseBody: response.value.text,
        })
      )
    }

    return ok(response.value.text)
  }

const getFioStatement =
  (
    createPath: (encodedToken: string) => string
  ): FioTask<FioAccountStatement> =>
  async (run) => {
    const response = await run(fetchFioApi(createPath))
    if (!response.ok) return response

    const parsed = validateJsonResponse(response.value, {
      schema: FioAccountStatementSchema,
      onHttpError: toFioHttpError,
      onResponseError: ({ status, responseBody, cause }) =>
        createFioApiError({
          message: "Invalid FIO account statement response.",
          status,
          responseBody,
          cause,
        }),
    })
    if (!parsed.ok) return parsed

    const statement = parsed.value.accountStatement

    return ok({
      iban: statement.info.iban,
      currency: statement.info.currency ?? null,
      transactions: statement.transactionList.transaction,
    })
  }

const fetchFioApi =
  (
    createPath: (encodedToken: string) => string
  ): Task<
    Pick<Response, "ok" | "status"> & {
      readonly text: string
      readonly json: Result<JsonValue, FetchJsonError>
    },
    FioAllTokensRestingError | FetchError,
    FioApiDep & FetchDep & DateDep
  > =>
  async (run) => {
    const token = run.deps.fioApi.takeToken(run.deps.date.now())
    if (!token.ok) return token

    const encodedToken = encodeURIComponent(token.value)
    const response = await run(
      appFetchAsJson(
        new URL(createPath(encodedToken), run.deps.fioApi.baseUrl),
        {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain",
          },
        }
      )
    )
    return response.ok
      ? response
      : err({
          ...response.error,
          error: String(response.error.error)
            .replaceAll(encodedToken, "<token>")
            .replaceAll(token.value, "<token>"),
        })
  }

/** FIO's failed HTTP responses, two of which it explains in its own way. */
const toFioHttpError = ({
  status,
  responseBody,
}: {
  readonly status: number
  readonly responseBody: string
}): FioHttpError | FioRateLimitError | FioStrongAuthorizationRequiredError => {
  if (isFioStrongAuthorizationRequiredResponse(status, responseBody)) {
    return createFioStrongAuthorizationRequiredError({
      message:
        "FIO API requires strong authorization to provide the requested data.",
      status: 422,
      responseBody,
    })
  }
  if (status === 409) {
    return createFioRateLimitError({
      message:
        "FIO API request failed because the interval between requests was not respected.",
      status: 409,
      responseBody,
    })
  }

  return createFioHttpError({
    message: `FIO API request failed with HTTP ${status}.`,
    status,
    responseBody,
  })
}

const isFioStrongAuthorizationRequiredResponse = (
  responseStatus: number,
  responseBody: string
): boolean =>
  responseStatus === 422 &&
  responseBody.includes("Data není možné poskytnout bez silné autorizace")
