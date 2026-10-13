import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, FetchDep } from "../../deps.ts"
import { DateStringSchema } from "../../modules/shared/schema.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import {
  createFioApiDep,
  type FioAllTokensRestingError,
  type FioApiDep,
  type FioApiError,
  type FioRateLimitError,
  type FioStrongAuthorizationRequiredError,
  fetchFioLastTransactions,
  fetchFioTransactionsByPeriod,
  setFioLastDate,
} from "./fio-client.ts"

const dateString = DateStringSchema.parse

const transaction = {
  column0: { value: 123456789, name: "ID pohybu" },
  column1: { value: "2026-05-26+02:00", name: "Datum" },
  column2: { value: "199.50", name: "Objem" },
  column3: { value: "CZK", name: "Měna" },
  column4: { value: "2600123456", name: "Protiúčet" },
  column5: { value: "Customer Ltd.", name: "Název protiúčtu" },
  column6: { value: "2010", name: "Kód banky" },
  column7: { value: "Fio banka, a.s.", name: "Název banky" },
  column8: { value: "0308", name: "KS" },
  column9: { value: "123456", name: "VS" },
  column10: { value: "789", name: "SS" },
  column11: { value: "Terminal 1", name: "Uživatelská identifikace" },
  column12: { value: "Thanks", name: "Zpráva pro příjemce" },
  column13: { value: "Bezhotovostní příjem", name: "Typ" },
  column14: { value: "ABC123", name: "ID pokynu" },
}

const statementResponse = (transactions: unknown) =>
  new Response(
    JSON.stringify({
      accountStatement: {
        info: {
          iban: "CZ6508000000192000145399",
          currency: "CZK",
        },
        transactionList: {
          transaction: transactions,
        },
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

const inputToString = (input: RequestInfo | URL): string =>
  input instanceof URL ? input.toString() : String(input)

/**
 * The statement fixture with only its `Objem` (amount) column replaced.
 * `moneyToMinorUnits` is not exported, so the cases below reach it the way
 * production does — through a whole downloaded statement.
 */
const statementWithAmount = (value: unknown) =>
  statementResponse([{ ...transaction, column2: { value, name: "Objem" } }])

const fetchStatementWithAmount = async (value: unknown) => {
  const deps = {
    ...createFioApiDep({
      tokens: ["token-a"],
      baseUrl: "https://example.test",
    }),
    ...createTestDateDep(),
    fetch: async () => statementWithAmount(value),
  } satisfies FioApiDep & FetchDep & DateDep
  await using run = testCreateRun(deps)

  return await run(fetchFioLastTransactions())
}

describe("fio client", () => {
  test("downloads and normalizes last transactions", async () => {
    const requestedUrls: string[] = []
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return statementResponse([transaction])
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await expect(run(fetchFioLastTransactions())).resolves.toMatchObject({
      ok: true,
      value: {
        iban: "CZ6508000000192000145399",
        currency: "CZK",
        transactions: [
          {
            id: "123456789",
            bookedDate: "2026-05-26",
            amountMinor: 19950,
            currency: "CZK",
            counterAccountNumber: "2600123456",
            counterAccountName: "Customer Ltd.",
            counterBankCode: "2010",
            counterBankName: "Fio banka, a.s.",
            constantSymbol: "0308",
            variableSymbol: "123456",
            specificSymbol: "789",
            userIdentification: "Terminal 1",
            recipientMessage: "Thanks",
            type: "Bezhotovostní příjem",
            instructionId: "ABC123",
          },
        ],
      },
    })
    expect(requestedUrls).toEqual([
      "https://example.test/v1/rest/last/token-a/transactions.json",
    ])
  })

  test("supports a single transaction object in FIO response", async () => {
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async () => statementResponse(transaction),
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    const result = await run(fetchFioLastTransactions())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.transactions).toHaveLength(1)
    expect(result.value.transactions[0]?.id).toBe("123456789")
  })

  test("rotates tokens across requests", async () => {
    const requestedUrls: string[] = []
    const clock = createTestDateDep()
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a", "token-b"],
        baseUrl: "https://example.test",
      }),
      ...clock,
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return statementResponse([])
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await run(fetchFioLastTransactions())
    clock.advance(15_000)
    await run(fetchFioLastTransactions())
    clock.advance(15_000)
    await run(fetchFioLastTransactions())

    expect(requestedUrls).toEqual([
      "https://example.test/v1/rest/last/token-a/transactions.json",
      "https://example.test/v1/rest/last/token-b/transactions.json",
      "https://example.test/v1/rest/last/token-a/transactions.json",
    ])
  })

  test("downloads transactions by period", async () => {
    const requestedUrls: string[] = []
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return statementResponse([])
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await run(
      fetchFioTransactionsByPeriod({
        from: dateString("2026-05-01"),
        to: dateString("2026-05-27"),
      })
    )

    expect(requestedUrls).toEqual([
      "https://example.test/v1/rest/periods/token-a/2026-05-01/2026-05-27/transactions.json",
    ])
  })

  test("sets the last successful download date", async () => {
    const requestedUrls: string[] = []
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return new Response(null, { status: 204 })
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await expect(
      run(setFioLastDate({ date: dateString("2026-05-27") }))
    ).resolves.toMatchObject({
      ok: true,
      value: "",
    })
    expect(requestedUrls).toEqual([
      "https://example.test/v1/rest/set-last-date/token-a/2026-05-27/",
    ])
  })

  // `amountMinor` is what later decides whether a bill is covered, so each
  // shape FIO can put in `Objem` is worth stating outright.
  test.each([
    { objem: "199.50", expected: 19_950, shape: "a string with a dot" },
    { objem: 199.5, expected: 19_950, shape: "a JSON number" },
    { objem: 199, expected: 19_900, shape: "a whole JSON number" },
    { objem: "199,50", expected: 19_950, shape: "a comma decimal" },
    { objem: "1234", expected: 123_400, shape: "no fraction part" },
    { objem: "199.5", expected: 19_950, shape: "one fraction digit" },
    { objem: "-199.50", expected: -19_950, shape: "an outgoing transfer" },
    { objem: "-0,5", expected: -50, shape: "a negative under one unit" },
    { objem: 0, expected: 0, shape: "zero" },
    { objem: "  199.50  ", expected: 19_950, shape: "surrounding whitespace" },
    // The two branches disagree below a cent: a JSON number is rounded to two
    // places, while the identical string ("199.555" in the rejection table
    // below) is refused outright. FIO sends whole cents, so nothing depends on
    // it today — but it is not the same rule twice.
    { objem: 199.555, expected: 19_956, shape: "a sub-cent JSON number" },
  ])("reads $shape as $expected minor units", async ({ objem, expected }) => {
    const result = await fetchStatementWithAmount(objem)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.transactions[0]?.amountMinor).toBe(expected)
  })

  // A malformed amount rejects the *whole* statement, so nothing at all is
  // ingested from that download — worth knowing which shapes do that.
  test.each([
    { objem: "1 234,56", shape: "a space-grouped amount" },
    { objem: "1,234.56", shape: "a thousands separator" },
    { objem: "199.555", shape: "three fraction digits" },
    { objem: "abc", shape: "a non-numeric value" },
    { objem: "", shape: "an empty string" },
  ])("rejects the statement for $shape", async ({ objem }) => {
    const result = await fetchStatementWithAmount(objem)

    expect(result).toMatchObject({
      ok: false,
      error: {
        type: "FioApiError",
        message: "Invalid FIO account statement response.",
        status: 200,
        responseBody: expect.stringContaining("accountStatement"),
      } satisfies Partial<FioApiError>,
    })
  })

  test("keeps the token out of a failed request's error", async () => {
    const deps = {
      ...createFioApiDep({
        tokens: ["token/a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async (input) => {
        throw Object.assign(
          new TypeError(`Unable to connect to ${inputToString(input)}`),
          { path: inputToString(input) }
        )
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    const result = await run(fetchFioLastTransactions())

    expect(result).toMatchObject({ ok: false, error: { type: "FetchError" } })
    expect(JSON.stringify(result)).not.toMatch(/token(%2F|\/)a/u)
    expect(JSON.stringify(result)).toContain("Unable to connect")
  })

  test("returns a typed rate limit error", async () => {
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async () => new Response("Too many requests", { status: 409 }),
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await expect(run(fetchFioLastTransactions())).resolves.toMatchObject({
      ok: false,
      error: {
        type: "FioRateLimitError",
        message:
          "FIO API request failed because the interval between requests was not respected.",
        status: 409,
        responseBody: "Too many requests",
      } satisfies Partial<FioRateLimitError>,
    })
  })

  test("rests each token for 30 s after asking FIO with it", async () => {
    const requestedTokens: string[] = []
    const clock = createTestDateDep()
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a", "token-b"],
        baseUrl: "https://example.test",
      }),
      ...clock,
      fetch: async (input) => {
        requestedTokens.push(inputToString(input).split("/")[6] ?? "")
        return statementResponse([])
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await run(fetchFioLastTransactions())
    clock.advance(20_000)
    await run(fetchFioLastTransactions())
    clock.advance(5000)
    const tooSoon = await run(fetchFioLastTransactions())
    clock.advance(5000)
    await run(fetchFioLastTransactions())

    expect(tooSoon).toMatchObject({
      ok: false,
      error: { type: "FioAllTokensRestingError" },
    })
    expect(requestedTokens).toEqual(["token-a", "token-b", "token-a"])
  })

  test("keeps a token's later rest when an earlier use rests it again", () => {
    const { fioApi } = createFioApiDep({ tokens: ["token-a"] })
    const now = new Date("2026-05-31T10:00:00.000Z")

    fioApi.restToken("token-a", now)
    fioApi.restToken("token-a", new Date(now.getTime() - 20_000))

    expect(fioApi.takeToken(new Date(now.getTime() + 15_000))).toEqual({
      ok: false,
      error: {
        type: "FioAllTokensRestingError",
        retryAt: now.getTime() + 30_000,
      } satisfies FioAllTokensRestingError,
    })
  })

  test("does not ask FIO while every token rests", async () => {
    let requestCount = 0
    const clock = createTestDateDep()
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...clock,
      fetch: async () => {
        requestCount += 1
        return statementResponse([])
      },
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await run(fetchFioLastTransactions())
    clock.advance(10_000)

    await expect(
      run(setFioLastDate({ date: dateString("2026-05-27") }))
    ).resolves.toEqual({
      ok: false,
      error: {
        type: "FioAllTokensRestingError",
        retryAt: clock.date.now().getTime() + 20_000,
      } satisfies FioAllTokensRestingError,
    })
    expect(requestCount).toBe(1)
  })

  test("returns a typed strong authorization error", async () => {
    const responseBody =
      "Data není možné poskytnout bez silné autorizace. Pokyn k zobrazení dat si autorizujte ve Vašem Internetovém bankovnictví a data si vyžádejte znovu. Platnost ověření je 10 minut od autorizace. Nebo požádejte o data, která nejsou starší jak 90 dní (od 28.02.2026), v takovém případě není autorizace třeba."
    const deps = {
      ...createFioApiDep({
        tokens: ["token-a"],
        baseUrl: "https://example.test",
      }),
      ...createTestDateDep(),
      fetch: async () => new Response(responseBody, { status: 422 }),
    } satisfies FioApiDep & FetchDep & DateDep
    await using run = testCreateRun(deps)

    await expect(run(fetchFioLastTransactions())).resolves.toMatchObject({
      ok: false,
      error: {
        type: "FioStrongAuthorizationRequiredError",
        message:
          "FIO API requires strong authorization to provide the requested data.",
        status: 422,
        responseBody,
      } satisfies Partial<FioStrongAuthorizationRequiredError>,
    })
  })
})
