import { sqliteFalse, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { EvoluOwnerDep, FetchDep } from "../../deps.ts"
import type { QerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { NonEmptyString255, NonEmptyStringSchema } from "../shared/schema.ts"
import {
  completeQerkoPairing,
  deleteQerkoPlugin,
  pairQerkoPaymentLocation,
} from "./qerko-plugin-actions.ts"
import { qerkoPluginQuery } from "./qerko-plugin-queries.ts"
import { qerkoPluginIdByRole } from "./qerko-plugin-utils.ts"

const terminals = {
  legalEntity: {
    id: "le",
    name: "Cafe s.r.o.",
    identificationNumber: "12345678",
    country: "CZ",
  },
  locations: [],
}

const locationId = "5455d25b-415c-4104-9035-5c357e60ff01"

const locations = (pairedLocationId: string | null = null) => ({
  legalEntity: {
    id: "le-2",
    name: "Bistro a.s.",
    identificationNumber: "87654321",
    country: "SK",
  },
  locations: [
    {
      id: locationId,
      name: "Cafe Praha",
      address: {
        street: "Dlouhá",
        descriptiveNumber: "1",
        city: "Praha",
        zipCode: "11000",
        country: "CZ",
      },
    },
  ],
  pairedLocationId,
})

const pairing = {
  role: "terminalPayments",
  environment: "sandbox",
  pairingRequestId: "p-1",
  code: "1234",
  name: "Payky",
} as const

const fakeFetch =
  (
    confirmReply: unknown,
    urls: string[] = [],
    {
      pairedLocationId = null,
      pairStatus = 200,
    }: {
      readonly pairedLocationId?: string | null
      readonly pairStatus?: number
    } = {}
  ): FetchDep["fetch"] =>
  async (input) => {
    const url = String(input)
    urls.push(url)
    if (url.endsWith("/confirm-pairing")) return Response.json(confirmReply)
    if (url.endsWith("/get-locations")) {
      return Response.json(locations(pairedLocationId))
    }
    if (url.endsWith("/pair-location")) {
      return pairStatus === 200
        ? Response.json({ status: "Accepted" })
        : Response.json({ message: "Not found" }, { status: pairStatus })
    }
    return Response.json(terminals)
  }

const okReply = { type: "ok", apiKey: { token: "secret", name: "Payky" } }

describe("completeQerkoPairing", () => {
  test("saves the key with its environment and the legal entity", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(run(completeQerkoPairing(pairing))).resolves.toEqual({
      ok: true,
      value: undefined,
    })

    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("terminalPayments")))
      .toMatchObject([
        {
          environment: "sandbox",
          apiKey: "secret",
          apiKeyName: "Payky",
          legalEntityName: "Cafe s.r.o.",
          identificationNumber: "12345678",
          country: "CZ",
        },
      ])
  })

  test.each([
    [
      { type: "invalidCode", remainingAttempts: 2 },
      { type: "QerkoPairingInvalidCode", remainingAttempts: 2 },
    ],
    [{ type: "codeExpired" }, { type: "QerkoPairingCodeExpired" }],
    [
      { type: "maxAttemptsReached" },
      { type: "QerkoPairingMaxAttemptsReached" },
    ],
  ])("reports %j and saves nothing", async (reply, error) => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(reply),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(run(completeQerkoPairing(pairing))).resolves.toMatchObject({
      ok: false,
      error,
    })
    await expect(
      evolu.loadQuery(qerkoPluginQuery("terminalPayments"))
    ).resolves.toEqual([])
  })

  test("unpairing removes the pairing", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)
    expect((await run(completeQerkoPairing(pairing))).ok).toBe(true)
    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("terminalPayments")))
      .toHaveLength(1)

    await run.ok(deleteQerkoPlugin("terminalPayments"))

    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("terminalPayments")))
      .toHaveLength(0)
  })

  test("a fresh standard key is proven by get-locations and waits for its location", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const urls: string[] = []
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply, urls),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    expect(
      (await run(completeQerkoPairing({ ...pairing, role: "standard" }))).ok
    ).toBe(true)

    expect(urls.map((url) => url.split("/").at(-1))).toEqual([
      "confirm-pairing",
      "get-locations",
    ])
    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("standard")))
      .toMatchObject([
        {
          role: "standard",
          legalEntityName: "Bistro a.s.",
          identificationNumber: "87654321",
          country: "SK",
          restaurantId: null,
          locationName: null,
        },
      ])
    await expect(
      evolu.loadQuery(qerkoPluginQuery("terminalPayments"))
    ).resolves.toEqual([])
  })

  test("a standard key already paired keeps its location", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply, [], { pairedLocationId: locationId }),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    expect(
      (await run(completeQerkoPairing({ ...pairing, role: "standard" }))).ok
    ).toBe(true)

    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("standard")))
      .toMatchObject([{ restaurantId: locationId, locationName: "Cafe Praha" }])
  })

  test("each role keeps its own key and environment", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    expect((await run(completeQerkoPairing(pairing))).ok).toBe(true)
    expect(
      (
        await run(
          completeQerkoPairing({
            ...pairing,
            role: "standard",
            environment: "production",
          })
        )
      ).ok
    ).toBe(true)

    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("standard")))
      .toMatchObject([{ environment: "production" }])
    await expect(
      evolu.loadQuery(qerkoPluginQuery("terminalPayments"))
    ).resolves.toMatchObject([{ environment: "sandbox" }])

    await run.ok(deleteQerkoPlugin("standard"))
    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("standard")))
      .toHaveLength(0)
    await expect(
      evolu.loadQuery(qerkoPluginQuery("terminalPayments"))
    ).resolves.toHaveLength(1)
  })

  test("a row written before roles existed reads as the terminal", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu

    evolu.upsert(
      "qerkoPlugin",
      {
        id: qerkoPluginIdByRole.terminalPayments,
        environment: "sandbox",
        apiKey: NonEmptyStringSchema.decode("old"),
        apiKeyName: NonEmptyString255("Payky"),
        legalEntityName: NonEmptyString255("Cafe s.r.o."),
        identificationNumber: NonEmptyString255("12345678"),
        country: "CZ",
        isDeleted: sqliteFalse,
      },
      { owner: evoluTestDeps(evolu).evoluOwner }
    )

    await expect
      .poll(() => evolu.loadQuery(qerkoPluginQuery("terminalPayments")))
      .toMatchObject([{ apiKey: "old", role: null }])
    await expect(
      evolu.loadQuery(qerkoPluginQuery("standard"))
    ).resolves.toEqual([])
  })
})

describe("pairQerkoPaymentLocation", () => {
  const setup = async (options: { readonly pairStatus?: number } = {}) => {
    const testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const urls: string[] = []
    const deps = {
      ...evoluTestDeps(evolu),
      ...createQerkoApiDep({ posId: "pos" }),
      fetch: fakeFetch(okReply, urls, options),
    } satisfies EvoluDep & EvoluOwnerDep & QerkoApiDep & FetchDep
    const run = testCreateRun(deps)
    await run.orThrow(completeQerkoPairing({ ...pairing, role: "standard" }))
    return {
      run,
      urls,
      plugin: () => evolu.loadQuery(qerkoPluginQuery("standard")),
      [Symbol.asyncDispose]: async () => {
        await run[Symbol.asyncDispose]()
        await testEvolu[Symbol.asyncDispose]()
      },
    }
  }

  test("pairs the key with the location and keeps it as the restaurant", async () => {
    await using test = await setup()

    expect(
      await test.run(
        pairQerkoPaymentLocation({ locationId, locationName: "Cafe Praha" })
      )
    ).toEqual({ ok: true, value: undefined })

    expect(test.urls.at(-1)).toMatch(/\/pair-location$/)
    await expect
      .poll(() => test.plugin())
      .toMatchObject([{ restaurantId: locationId, locationName: "Cafe Praha" }])
  })

  test("writes nothing when Qerko does not know the location", async () => {
    await using test = await setup({ pairStatus: 404 })

    expect(
      await test.run(
        pairQerkoPaymentLocation({ locationId: "gone", locationName: "Old" })
      )
    ).toMatchObject({
      ok: false,
      error: { type: "QerkoHttpError", status: 404 },
    })
    await expect(test.plugin()).resolves.toMatchObject([
      { restaurantId: null, locationName: null },
    ])
  })
})
