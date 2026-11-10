import { ok, type Result, type Task } from "@evolu/common"
import type { JsonValue } from "type-fest"
import { z } from "zod"

import {
  appFetchAsJson,
  type FetchDep,
  type FetchError,
  type FetchJsonError,
  validateJsonResponse,
} from "../../deps.ts"
import { defineError } from "../../error.ts"
import { signedDecimalAmountToMinorUnits } from "../../modules/shared/money.ts"
import {
  type ConstantSymbol,
  ConstantSymbolSchema,
  type DateString,
  DateStringSchema,
  type FiatCurrency,
  FiatCurrencySchema,
  type Iban,
  IbanSchema,
  Integer,
  type SpecificSymbol,
  SpecificSymbolSchema,
  type VariableSymbol,
  VariableSymbolSchema,
} from "../../modules/shared/schema.ts"
import { jsonCodec } from "../../zod-utils.ts"

const MONETA_BASE_URL = "https://api.moneta.cz"
const MONETA_ACCOUNTS_PATH = "/api/v4/vip/aisp/my/accounts"
/**
 * The bank's page. MONETA pages a listing in blocks of 100 whatever `size`
 * asks for: a larger `size` comes back as `pageSize: 100`, a smaller one only
 * cuts each block short, so the entries past it are on no page at all
 * (measured on a live account, 2026-11-01). Asking for exactly the block is
 * what makes `page` and `pageCount` cover the whole listing.
 */
const MONETA_PAGE_SIZE = 100

/**
 * The most transaction pages one `fetchMonetaTransactions` reads. Every page
 * is a call against the token's daily limit (5000), so a misbehaving
 * `pageCount` must not be able to spend it. 20 pages of 100 hold a busy
 * merchant's week, the window one background sync asks for; a window the
 * bank lists more for is narrowed by the job (`MONETA_SYNC_WINDOWS`).
 */
export const MONETA_MAX_PAGES = 20

export interface MonetaApiOptions {
  readonly token: string
  readonly baseUrl?: string
}

/**
 * MONETA's VIP API with one merchant token. Unlike Fio there is no token
 * rotation: the bank limits calls per day, not the gap between them, so a
 * second token would only split the same budget.
 */
export interface MonetaApiDep {
  readonly monetaApi: {
    readonly baseUrl: string
    readonly token: string
  }
}

export const createMonetaApiDep = ({
  token,
  baseUrl = MONETA_BASE_URL,
}: MonetaApiOptions): MonetaApiDep => ({ monetaApi: { baseUrl, token } })

const createMonetaApiError = defineError("MonetaApiError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
  readonly cause: unknown
}>()
export type MonetaApiError = ReturnType<typeof createMonetaApiError>

const createMonetaHttpError = defineError("MonetaHttpError")<{
  readonly message: string
  readonly status: number
  readonly responseBody: string
}>()
export type MonetaHttpError = ReturnType<typeof createMonetaHttpError>

/**
 * The bank refused the token: unknown, expired, revoked, or without the
 * rights the call needs. `code` is the bank's own error code — `NARR` means
 * the query reaches past the history a token may read without strong
 * authentication (two years), not that the token is bad.
 */
const createMonetaUnauthorizedError = defineError("MonetaUnauthorizedError")<{
  readonly message: string
  readonly status: 401 | 403
  readonly code: string | null
  readonly responseBody: string
}>()
export type MonetaUnauthorizedError = ReturnType<
  typeof createMonetaUnauthorizedError
>

const createMonetaRateLimitError = defineError("MonetaRateLimitError")<{
  readonly message: string
  readonly status: 429
  readonly responseBody: string
}>()
export type MonetaRateLimitError = ReturnType<typeof createMonetaRateLimitError>

export type MonetaClientError =
  | MonetaApiError
  | MonetaHttpError
  | MonetaUnauthorizedError
  | MonetaRateLimitError
  | FetchError

/** The code of a ČOBS error body (`{ errors: [{ error, message }] }`). */
const MonetaErrorBody = jsonCodec(
  z.object({
    errors: z.array(z.looseObject({ error: z.string() })).min(1),
  })
)

const MonetaAccountSchema = z.looseObject({
  id: z.string().min(1).max(255),
  identification: z
    .looseObject({ iban: z.string().nullish() })
    .nullish()
    .transform((identification): Iban | null => {
      const parsed = IbanSchema.safeParse(identification?.iban ?? "")
      return parsed.success ? parsed.data : null
    }),
})

export interface MonetaAccount {
  /** The bank's id of the account, the path segment its transactions sit under. */
  readonly id: string
  /** `null` when the bank names the account another way than by an IBAN. */
  readonly iban: Iban | null
}

const MonetaPageCountSchema = z.number().int().nonnegative().nullish()

const MonetaAccountsPageSchema = z.object({
  pageCount: MonetaPageCountSchema,
  accounts: z.array(z.unknown()).nullish(),
})

const MonetaTransactionsPageSchema = z.object({
  pageCount: MonetaPageCountSchema,
  transactions: z.array(z.unknown()).nullish(),
})

const MonetaReferenceSchema = z.union([z.string(), z.array(z.string())])

const MonetaDateSchema = z
  .looseObject({ date: z.string().nullish() })
  .nullish()
  .transform((value): DateString | null => {
    const parsed = DateStringSchema.safeParse(value?.date?.slice(0, 10))
    return parsed.success ? parsed.data : null
  })

const MonetaPartySchema = z
  .looseObject({ name: z.string().nullish() })
  .nullish()

/**
 * One ČOBS v7 transaction, typed only as far as the sync reads it. Everything
 * the standard allows to be missing is `nullish`; a transaction that still
 * fails is skipped by `fetchMonetaTransactions` rather than failing its page.
 */
const MonetaTransactionSchema = z
  .looseObject({
    entryReference: z.string().nullish(),
    amount: z.looseObject({
      value: z.union([z.number(), z.string()]),
      currency: FiatCurrencySchema,
    }),
    creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
    reversalIndicator: z.boolean().nullish(),
    status: z.string().nullish(),
    bookingDate: MonetaDateSchema,
    valueDate: MonetaDateSchema,
    entryDetails: z
      .looseObject({
        transactionDetails: z
          .looseObject({
            references: z
              .looseObject({ endToEndIdentification: z.string().nullish() })
              .nullish(),
            relatedParties: z
              .looseObject({
                debtor: MonetaPartySchema,
                creditor: MonetaPartySchema,
              })
              .nullish(),
            remittanceInformation: z
              .looseObject({
                unstructured: z.string().nullish(),
                structured: z
                  .looseObject({
                    creditorReferenceInformation: z
                      .looseObject({
                        reference: MonetaReferenceSchema.nullish(),
                      })
                      .nullish(),
                  })
                  .nullish(),
              })
              .nullish(),
          })
          .nullish(),
      })
      .nullish(),
  })
  .transform((transaction, ctx): Omit<MonetaTransaction, "raw"> => {
    const { value } = transaction.amount
    const magnitude = signedDecimalAmountToMinorUnits({
      currency: transaction.amount.currency,
      value: typeof value === "string" ? value.replaceAll(/\s/gu, "") : value,
    })
    if (magnitude === null) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid MONETA amount: ${String(value)}`,
        input: value,
      })
      return z.NEVER
    }

    const direction =
      transaction.creditDebitIndicator === "CRDT" ? "incoming" : "outgoing"
    const absolute = Math.abs(magnitude)
    const details = transaction.entryDetails?.transactionDetails
    const reference =
      details?.remittanceInformation?.structured?.creditorReferenceInformation
        ?.reference
    const referenceText =
      typeof reference === "string" ? reference : (reference ?? []).join(",")
    const endToEnd = details?.references?.endToEndIdentification ?? ""
    const counterparty =
      direction === "incoming"
        ? details?.relatedParties?.debtor?.name
        : details?.relatedParties?.creditor?.name
    const noteParts = [
      counterparty,
      details?.remittanceInformation?.unstructured,
    ].flatMap((part) => {
      const trimmed = part?.trim()
      return trimmed === undefined || trimmed === "" ? [] : [trimmed]
    })

    return {
      id: transaction.entryReference?.trim() || null,
      status: toMonetaTransactionStatus(transaction.status),
      isReversal: transaction.reversalIndicator === true,
      direction,
      amountMinor: Integer(direction === "incoming" ? absolute : -absolute),
      currency: transaction.amount.currency,
      occurredOn: transaction.valueDate ?? transaction.bookingDate,
      variableSymbol: readSymbol(
        "VS",
        [referenceText, endToEnd],
        VariableSymbolSchema
      ),
      constantSymbol: readSymbol(
        "KS",
        [referenceText, endToEnd],
        ConstantSymbolSchema
      ),
      specificSymbol: readSymbol(
        "SS",
        [referenceText, endToEnd],
        SpecificSymbolSchema
      ),
      note: noteParts.length > 0 ? noteParts.join(" | ") : null,
      recipientMessage:
        details?.remittanceInformation?.unstructured?.trim() || null,
    }
  })

/**
 * A transaction as the sync reads it. `fetchMonetaTransactions` returns every
 * one it could decode — outgoing, reversed and foreign-currency ones too — so
 * deciding which of them pay anything stays in the module, where it is
 * tested on its own (`isIncomingMonetaTransaction`).
 */
export interface MonetaTransaction {
  /** The bank's `entryReference`; `null` when it sends none. */
  readonly id: string | null
  /**
   * `BOOK` and `PDNG`; a status the standard lists but no payment can come
   * from (a scheduled `FUTR`, an `INFO` line) is `other`. A transaction
   * without one counts as booked, as Linky reads it.
   */
  readonly status: "booked" | "pending" | "other"
  readonly isReversal: boolean
  readonly direction: "incoming" | "outgoing"
  /** Signed by `direction`: the bank always sends a positive amount. */
  readonly amountMinor: Integer
  readonly currency: FiatCurrency
  /**
   * `valueDate`, else `bookingDate`: the day the money reached the account.
   * The bank books a weekend transfer on the next working day, so
   * `bookingDate` may lie in the future.
   */
  readonly occurredOn: DateString | null
  readonly variableSymbol: VariableSymbol | null
  readonly constantSymbol: ConstantSymbol | null
  readonly specificSymbol: SpecificSymbol | null
  /** The counterparty and the free-text message, for people to read. */
  readonly note: string | null
  readonly recipientMessage: string | null
  /** The entry exactly as the bank sent it. */
  readonly raw: unknown
}

const monetaTransactionStatuses: Readonly<
  Record<string, MonetaTransaction["status"]>
> = { BOOK: "booked", PDNG: "pending" }

const toMonetaTransactionStatus = (
  status: string | null | undefined
): MonetaTransaction["status"] =>
  status === null || status === undefined
    ? "booked"
    : (monetaTransactionStatuses[status.toUpperCase()] ?? "other")

/**
 * A payment symbol out of free text such as `VS:0001234567,KS:0308,SS:7` or
 * `/VS42/SS261101/KS0308`, read from the first of `texts` that has a valid
 * one — the structured reference, then the end-to-end id, where Czech banks
 * put the symbols of a payment that carries no structured reference. A text
 * whose symbol is no symbol (eleven digits) does not hide a valid one in the
 * next. The pattern is Linky's.
 *
 * The variable and specific symbols lose the leading zeros the bank may pad
 * them with: Payky's own never have any (`payment-symbol-utils.ts`), and
 * reconciliation compares them as strings. The constant symbol is a code
 * (`0308`) and stays exactly as sent, as Fio reports it.
 */
const readSymbol = <TSchema extends z.ZodType>(
  label: "VS" | "KS" | "SS",
  texts: ReadonlyArray<string>,
  schema: TSchema
): z.output<TSchema> | null => {
  const pattern = new RegExp(`(?:^|[^A-Z0-9])${label}:?\\s*(\\d+)`, "iu")
  for (const text of texts) {
    const digits = pattern.exec(text)?.[1]
    if (digits === undefined) continue

    const value = label === "KS" ? digits : digits.replace(/^0+(?=\d)/u, "")
    const parsed = schema.safeParse(value)
    if (parsed.success) return parsed.data
  }
  return null
}

type MonetaTask<TResult> = Task<
  TResult,
  MonetaClientError,
  MonetaApiDep & FetchDep
>

/**
 * The most pages of accounts `fetchMonetaAccounts` reads. A merchant's token
 * sees a handful; the cap only keeps a misbehaving `pageCount` from spending
 * the daily limit.
 */
const MONETA_MAX_ACCOUNT_PAGES = 5

export interface MonetaAccounts {
  /** The accounts in the shape the standard describes. */
  readonly accounts: ReadonlyArray<MonetaAccount>
  /** Every entry exactly as the bank sent it, read or not. */
  readonly entries: ReadonlyArray<unknown>
}

/**
 * The accounts the token sees, every page of them. A page the bank no longer
 * has ends the listing (`isMonetaPageNotFound`).
 */
export const fetchMonetaAccounts =
  (): MonetaTask<MonetaAccounts> => async (run) => {
    const entries: unknown[] = []
    let pageCount = 1

    for (
      let page = 0;
      page < Math.min(pageCount, MONETA_MAX_ACCOUNT_PAGES);
      page++
    ) {
      const query = new URLSearchParams({
        page: String(page),
        size: String(MONETA_PAGE_SIZE),
      })
      const parsed = await run(
        getMoneta(`${MONETA_ACCOUNTS_PATH}?${query}`, MonetaAccountsPageSchema)
      )
      if (!parsed.ok && isMonetaPageNotFound(parsed.error)) break
      if (!parsed.ok) return parsed

      pageCount = Math.max(1, parsed.value.pageCount ?? 1)
      entries.push(...(parsed.value.accounts ?? []))
    }

    return ok({
      accounts: entries.flatMap((entry) => {
        const account = MonetaAccountSchema.safeParse(entry)
        return account.success
          ? [{ id: account.data.id, iban: account.data.identification }]
          : []
      }),
      entries,
    })
  }

export interface MonetaTransactions {
  readonly transactions: ReadonlyArray<MonetaTransaction>
  /** Entries in a shape the standard does not describe, as the bank sent them. */
  readonly skipped: ReadonlyArray<unknown>
  /** More pages than `MONETA_MAX_PAGES`; the rest were not read. */
  readonly isTruncated: boolean
  /** Calls spent against the daily limit: one per page read. */
  readonly callCount: number
}

/**
 * Every transaction of the account booked from `fromDate` to `toDate`, both
 * days included, all pages read. The bounds go out as bare dates: the bank
 * reads only the date of each, takes the day whole and ignores any time or
 * offset sent with it, and lists a transaction booked after `toDate` anyway
 * (moneta/0004, moneta/0008).
 *
 * The bank lists the newest booking first. A transaction booked between two
 * page reads pushes the rest of the listing one place down, so an entry at a
 * page boundary can be read twice but is never skipped; the sync records a
 * transaction once by its `entryReference`. A page the bank no longer has —
 * `404 PAGE_NOT_FOUND`, its answer for a page past the end — ends the
 * listing rather than failing it.
 */
export const fetchMonetaTransactions =
  ({
    monetaAccountId,
    fromDate,
    toDate,
  }: {
    readonly monetaAccountId: string
    readonly fromDate: DateString
    readonly toDate: DateString
  }): MonetaTask<MonetaTransactions> =>
  async (run) => {
    const transactions: MonetaTransaction[] = []
    const skipped: unknown[] = []
    let pageCount = 1
    let callCount = 0

    for (let page = 0; page < Math.min(pageCount, MONETA_MAX_PAGES); page++) {
      const query = new URLSearchParams({
        fromDate,
        toDate,
        page: String(page),
        size: String(MONETA_PAGE_SIZE),
      })
      callCount += 1
      const parsed = await run(
        getMoneta(
          `${MONETA_ACCOUNTS_PATH}/${encodeURIComponent(monetaAccountId)}/transactions?${query}`,
          MonetaTransactionsPageSchema
        )
      )
      if (!parsed.ok && isMonetaPageNotFound(parsed.error)) break
      if (!parsed.ok) return parsed

      pageCount = Math.max(1, parsed.value.pageCount ?? 1)
      for (const entry of parsed.value.transactions ?? []) {
        const transaction = MonetaTransactionSchema.safeParse(entry)
        if (transaction.success) {
          transactions.push({ ...transaction.data, raw: entry })
        } else {
          skipped.push(entry)
        }
      }
    }

    return ok({
      transactions,
      skipped,
      isTruncated: pageCount > MONETA_MAX_PAGES,
      callCount,
    })
  }

const getMoneta =
  <TSchema extends z.ZodType>(
    path: string,
    schema: TSchema
  ): MonetaTask<z.output<TSchema>> =>
  async (run) => {
    const response = await run(fetchMonetaApi(path))
    if (!response.ok) return response

    return validateJsonResponse(response.value, {
      schema,
      onHttpError: toMonetaHttpError,
      onResponseError: ({ status, responseBody, cause }) =>
        createMonetaApiError({
          message: "Invalid MONETA API response.",
          status,
          responseBody,
          cause,
        }),
    })
  }

const fetchMonetaApi =
  (
    path: string
  ): Task<
    Pick<Response, "ok" | "status"> & {
      readonly text: string
      readonly json: Result<JsonValue, FetchJsonError>
    },
    FetchError,
    MonetaApiDep & FetchDep
  > =>
  (run) =>
    run(
      appFetchAsJson(new URL(path, run.deps.monetaApi.baseUrl), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${run.deps.monetaApi.token}`,
        },
      })
    )

const toMonetaHttpError = ({
  status,
  responseBody,
}: {
  readonly status: number
  readonly responseBody: string
}): MonetaHttpError | MonetaUnauthorizedError | MonetaRateLimitError => {
  if (status === 401 || status === 403) {
    return createMonetaUnauthorizedError({
      message: `MONETA API refused the token with HTTP ${status}.`,
      status,
      code: readMonetaErrorCode(responseBody),
      responseBody,
    })
  }
  if (status === 429) {
    return createMonetaRateLimitError({
      message: "MONETA API daily request limit was exceeded.",
      status: 429,
      responseBody,
    })
  }

  return createMonetaHttpError({
    message: `MONETA API request failed with HTTP ${status}.`,
    status,
    responseBody,
  })
}

/** The bank's answer for a page past the end of a listing. */
const isMonetaPageNotFound = (error: MonetaClientError): boolean =>
  error.type === "MonetaHttpError" &&
  error.status === 404 &&
  readMonetaErrorCode(error.responseBody) === "PAGE_NOT_FOUND"

const readMonetaErrorCode = (responseBody: string): string | null => {
  const parsed = z.safeDecode(MonetaErrorBody, responseBody)
  return parsed.success ? (parsed.data.errors[0]?.error ?? null) : null
}
