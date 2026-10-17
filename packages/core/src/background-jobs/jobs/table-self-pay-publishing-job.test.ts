import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import {
  getNostrTag,
  type NostrEvent,
  verifyNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import {
  createNostrRelayClient,
  type NostrRelayClient,
} from "../../integrations/nostr/nostr-relay-client.ts"
import { createFakeNostrRelay } from "../../integrations/nostr/nostr-relay-test-fixtures.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { saveFiatBankAccount } from "../../modules/account/account-actions.ts"
import { addManualAmountToBill } from "../../modules/bill/bill-actions.ts"
import { saveFioPlugin } from "../../modules/fio-plugin/fio-plugin-actions.ts"
import { connectMonetaPlugin } from "../../modules/moneta-plugin/moneta-plugin-actions.ts"
import { createRowId } from "../../modules/shared/evolu-utils.ts"
import {
  deriveSelfPayRateKey,
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
} from "../../modules/shared/key-derivation.ts"
import {
  IbanSchema,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  WssUrl,
} from "../../modules/shared/schema.ts"
import {
  createTableAtEnd,
  requestTableSelfPayPublish,
  updateTable,
} from "../../modules/table/table-actions.ts"
import {
  loadSelfPayViewPublishedAt,
  loadTableSelfPayView,
  setSelfPayRelayActive,
} from "../../modules/table-self-pay/table-self-pay-actions.ts"
import {
  selfPayPublishResultsByTagQuery,
  selfPayTablesQuery,
} from "../../modules/table-self-pay/table-self-pay-queries.ts"
import { verifySelfPayRate } from "../../modules/table-self-pay/table-self-pay-rate-utils.ts"
import {
  findNewestViewPublish,
  parseSelfPayPublishResults,
} from "../../modules/table-self-pay/table-self-pay-reach-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  receiveBankTransfer,
  type SelfPayTestContext,
  selfPayTestMasterKey,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import {
  createSelfPayViewEvent,
  deriveSelfPayLivenessTag,
  deriveSelfPayViewTag,
  parseSelfPayContent,
  SelfPayLivenessSchema,
  SelfPayViewSchema,
} from "../../modules/table-self-pay/table-self-pay-view-utils.ts"
import { createFakeSparkWallet } from "../../spark/spark-wallet-test-fixtures.ts"
import { testSyncedAppOwner } from "../../testing/app-owner-sync.ts"
import { createTestDeviceAccountDep } from "../../testing/background-jobs.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import { createTableSelfPayPublishingJob } from "./table-self-pay-publishing-job.ts"

const identityPublicKey = `02${"ab".repeat(32)}`

const billReferencesQuery = createQuery((db) =>
  db.selectFrom("billSelfPayReference").select(["id", "reference"])
)
const root = deriveTableSelfPayRoot(selfPayTestMasterKey)

const fakeSparkWallet = (
  privacy: "private" | "public" | "staysPublic" = "private"
) => {
  const privacyRequests: boolean[] = []
  let privateEnabled = privacy === "private"
  const settings = () => ({
    ownerIdentityPublicKey: identityPublicKey,
    privateEnabled,
  })
  return {
    privacyRequests,
    create: async () =>
      createFakeSparkWallet({
        getIdentityPublicKey: async () => identityPublicKey,
        getWalletSettings: async () => settings(),
        setPrivacyEnabled: async (privacyEnabled) => {
          privacyRequests.push(privacyEnabled)
          if (privacy !== "staysPublic") privateEnabled = privacyEnabled
          return settings()
        },
      }),
  }
}

const startJob = async (
  context: SelfPayTestContext,
  {
    livenessIntervalMs = 60,
    ...overrides
  }: Partial<AppBackgroundJobContext> & {
    readonly livenessIntervalMs?: number
  } = {}
) => {
  const errors: unknown[] = []
  const fetch = async () =>
    new Response(JSON.stringify({ BTC: 2_500_000, timestamp: 1 }))
  const device = await createTestDeviceAccountDep()
  const jobDeps: AppBackgroundJobContext = {
    ...context.deps,
    ...device.deviceAccount,
    ...createEetApiDep({ date: context.deps.date, fetch }),
    ...createQerkoApiDep({ posId: "test" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...createYadioApiDep(),
    ...testSyncedAppOwner,
    fetch,
    deviceId: context.deviceId,
    connectivity: { onOnline: () => () => undefined },
    sparkWallet: fakeSparkWallet(),
    onError: (error) => {
      errors.push(error)
    },
    ...overrides,
  }
  const run = testCreateRun(jobDeps)
  const job = await run.ok(
    createTableSelfPayPublishingJob({ debounceMs: 5, livenessIntervalMs })
  )
  return {
    errors,
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
      await device[Symbol.asyncDispose]()
    },
  }
}

const tableKeys = (context: SelfPayTestContext, epoch = 0) =>
  deriveTableSelfPayKeys(root, context.tableId, epoch)

const viewTag = (context: SelfPayTestContext) =>
  NonEmptyString255(deriveSelfPayViewTag(tableKeys(context).viewKey))

const lastPublish = async (context: SelfPayTestContext) =>
  findNewestViewPublish(
    parseSelfPayPublishResults(
      await context.deps.evolu.loadQuery(
        selfPayPublishResultsByTagQuery(viewTag(context))
      )
    )
  )

const viewPublishedAt = async (context: SelfPayTestContext) => {
  await using run = testCreateRun({
    ...context.deps,
    deviceId: context.deviceId,
  })
  return await run.ok(loadSelfPayViewPublishedAt(viewTag(context)))
}

const newestWithTag = (
  context: SelfPayTestContext,
  tag: string
): NostrEvent | undefined =>
  context.relay
    .events()
    .filter((event) => getNostrTag(event, "d") === tag)
    .sort((left, right) => right.created_at - left.created_at)[0]

const publishedView = (context: SelfPayTestContext, epoch = 0) => {
  const { viewKey } = tableKeys(context, epoch)
  const event = newestWithTag(context, deriveSelfPayViewTag(viewKey))
  return event === undefined
    ? undefined
    : parseSelfPayContent(SelfPayViewSchema, viewKey, event.content)
}

const publishedLiveness = (context: SelfPayTestContext) => {
  const { viewKey } = tableKeys(context)
  const event = newestWithTag(context, deriveSelfPayLivenessTag(viewKey))
  return event === undefined
    ? undefined
    : {
        event,
        liveness: parseSelfPayContent(
          SelfPayLivenessSchema,
          viewKey,
          event.content
        ),
      }
}

describe("table self-pay publishing job", () => {
  test("publishes the open bills of a self-pay table, signed by its key", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(
      saveFioPlugin({
        accountId: context.ibanAccountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )

    await using job = await startJob(context)

    await expect
      .poll(() => publishedView(context)?.bills.map((bill) => bill.reference))
      .toEqual([reference])
    const event = newestWithTag(
      context,
      deriveSelfPayViewTag(tableKeys(context).viewKey)
    )
    expect(event !== undefined && verifyNostrEvent(event)).toBe(true)
    expect(event?.pubkey).toBe(
      Buffer.from(tableKeys(context).publicKey).toString("hex")
    )
    expect(event?.tags.some(([name]) => name === "expiration")).toBe(true)
    expect(publishedView(context)).toMatchObject({
      table: "Table 3",
      enabled: true,
      payee: null,
      bank: {
        iban: "CZ6508000000192000145399",
        accountName: "",
        currency: "CZK",
        qrFormat: "spayd",
      },
      lightning: { identityPublicKey },
    })
    expect(job.errors).toEqual([])
  })

  test("offers guests the bank account once MONETA syncs it", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const iban = IbanSchema.decode("CZ6508000000192000145399")
    await using _job = await startJob(context)
    await expect.poll(() => publishedView(context)?.bills).toHaveLength(1)
    expect(publishedView(context)?.bank).toBe(null)

    await using run = testCreateRun({
      ...context.deps,
      fetch: async () =>
        Response.json({
          accounts: [{ id: "bank-account-1", identification: { iban } }],
        }),
    })
    await run.orThrow(
      connectMonetaPlugin({
        accountId: context.ibanAccountId,
        iban,
        token: NonEmptyStringSchema.decode("moneta-token"),
      })
    )

    await expect.poll(() => publishedView(context)?.bank?.iban).toBe(iban)
  })

  test("offers guests the QR format the bank account defaults to", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(
      saveFioPlugin({
        accountId: context.ibanAccountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )
    await run.ok(
      saveFiatBankAccount({
        enabled: true,
        currency: "CZK",
        defaultQrFormat: "payBySquare1_2_0",
      })
    )

    await using _job = await startJob(context)

    await expect
      .poll(() => publishedView(context)?.bank?.qrFormat)
      .toBe("payBySquare1_2_0")
  })

  test("stores the reference of every bill it offers", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    const { billId } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(4500),
        name: NonEmptyString255("Beer"),
        currency: "CZK",
      })
    )

    await using _job = await startJob(context)

    await expect
      .poll(async () =>
        (await context.deps.evolu.loadQuery(billReferencesQuery)).map(
          ({ id }) => id
        )
      )
      .toContain(billId)
  })

  test("gives two devices with the same data one event id", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })

    await using _first = await startJob(context)
    await using _second = await startJob(context, {
      deviceId: createRowId<"Device">(),
    })

    const tag = deriveSelfPayViewTag(tableKeys(context).viewKey)
    await expect
      .poll(
        () =>
          context.relay
            .received()
            .filter((event) => getNostrTag(event, "d") === tag).length
      )
      .toBeGreaterThanOrEqual(2)
    const ids = new Set(
      context.relay
        .received()
        .filter((event) => getNostrTag(event, "d") === tag)
        .map(({ id }) => id)
    )
    expect(ids.size).toBe(1)
  })

  test("keeps a device behind on sync from displacing a fresher view", async () => {
    await using context = await createSelfPayTestContext()
    const { billId } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    const [table] = await context.deps.evolu.loadQuery(selfPayTablesQuery)
    if (table === undefined) throw new Error("Expected the self-pay table.")
    const stale = await run.ok(loadTableSelfPayView(table))
    context.deps.evolu.setMutationBackdate((stale.version + 1) * 1000)
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(4500),
        name: NonEmptyString255("Beer"),
        currency: "CZK",
      })
    )
    context.deps.evolu.setMutationBackdate(null)
    const fresh = await run.ok(loadTableSelfPayView(table))
    expect(fresh.version).toBeGreaterThan(stale.version)
    await using _job = await startJob(context)
    await expect
      .poll(() => publishedView(context)?.bills[0]?.lines.length)
      .toBe(2)

    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      createSelfPayViewEvent({
        ...tableKeys(context),
        view: stale.view,
        version: stale.version,
      })
    )

    expect(publishedView(context)?.bills[0]?.lines).toHaveLength(2)
  })

  test("confirms the table every interval with a rate the terminal accepts", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })

    await using _job = await startJob(context)

    const livenessTag = deriveSelfPayLivenessTag(tableKeys(context).viewKey)
    await expect
      .poll(
        () =>
          context.relay
            .received()
            .filter((event) => getNostrTag(event, "d") === livenessTag).length
      )
      .toBeGreaterThanOrEqual(2)
    const published = publishedLiveness(context)
    const [rate] = published?.liveness?.rates ?? []
    if (rate === undefined) throw new Error("Expected a published rate.")
    expect(rate).toMatchObject({ currency: "CZK", msatPerMajor: 40_000 })
    expect(verifySelfPayRate(deriveSelfPayRateKey(root), "CZK", rate)).toBe(
      true
    )
    expect(published?.event.tags.some(([name]) => name === "expiration")).toBe(
      true
    )
  })

  test("asks Yadio for a currency once a round, however many tables use it", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    const terrace = await run.ok(
      createTableAtEnd({
        deviceId: context.deviceId,
        name: NonEmptyString255("Terrace"),
        seatCount: PositiveInteger(2),
        selfPayEnabled: 1,
      })
    )
    await openSelfPayBill(context, {
      tableId: terrace,
      lines: [{ name: "Beer", amount: 4500 }],
    })
    let quotes = 0
    const fetch: typeof globalThis.fetch = async () => {
      quotes++
      return new Response(JSON.stringify({ BTC: 2_500_000, timestamp: 1 }))
    }

    await using _job = await startJob(context, { fetch })

    const livenessTags = [context.tableId, terrace].map((tableId) =>
      deriveSelfPayLivenessTag(deriveTableSelfPayKeys(root, tableId, 0).viewKey)
    )
    const rounds = () =>
      Math.min(
        ...livenessTags.map(
          (tag) =>
            context.relay
              .received()
              .filter((event) => getNostrTag(event, "d") === tag).length
        )
      )
    await expect.poll(rounds).toBeGreaterThanOrEqual(4)
    expect(quotes).toBeLessThan(2 * rounds())
  })

  test("names in each confirmation the view it published last", async () => {
    await using context = await createSelfPayTestContext()
    const { billId } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const { viewKey } = tableKeys(context)
    const viewTag = deriveSelfPayViewTag(viewKey)
    const livenessTag = deriveSelfPayLivenessTag(viewKey)
    const newestView = () => newestWithTag(context, viewTag)?.created_at ?? 0
    const confirmsNewestView = () => {
      const confirmation = context.relay
        .received()
        .findLast((event) => getNostrTag(event, "d") === livenessTag)
      return (
        confirmation !== undefined &&
        parseSelfPayContent(
          SelfPayLivenessSchema,
          viewKey,
          confirmation.content
        )?.viewVersion === newestView()
      )
    }

    await using _job = await startJob(context)
    await expect.poll(confirmsNewestView).toBe(true)
    const first = newestView()
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(4500),
        name: NonEmptyString255("Beer"),
        currency: "CZK",
      })
    )

    await expect
      .poll(() => newestView() > first && confirmsNewestView())
      .toBe(true)
  })

  test("publishes a view again once a relay accepts it", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    let attempts = 0
    let isOffline = true
    const nostrRelayClient: NostrRelayClient = {
      ...context.deps.nostrRelayClient,
      publish: async (relays, event) => {
        attempts++
        return isOffline
          ? relays.map((url) => ({ url, accepted: false }))
          : await context.deps.nostrRelayClient.publish(relays, event)
      },
    }

    await using _job = await startJob(context, { nostrRelayClient })
    await expect.poll(() => attempts).toBeGreaterThan(0)
    isOffline = false

    await expect
      .poll(() => publishedView(context)?.bills.map((bill) => bill.reference))
      .toEqual([reference])
  })

  test("saves which relay accepted the last publish and which refused it", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const full = createFakeNostrRelay()
    full.refuseEvents(true)
    const selfPayDefaultRelays = [
      WssUrl("wss://relay.test"),
      WssUrl("wss://full.test"),
    ]
    const nostrRelayClient = createNostrRelayClient({
      createSocket: (url) =>
        url === "wss://full.test"
          ? full.createSocket()
          : context.relay.createSocket(),
    })

    await using _job = await startJob(context, {
      nostrRelayClient,
      selfPayDefaultRelays,
    })

    await expect
      .poll(() => lastPublish(context))
      .toMatchObject({
        relays: [
          { url: "wss://relay.test", accepted: true },
          { url: "wss://full.test", accepted: false },
        ],
      })
    expect(await viewPublishedAt(context)).not.toBe(null)
  })

  test("saves a publish every relay refused, without counting it published", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    context.relay.refuseEvents(true)

    await using _job = await startJob(context)

    await expect
      .poll(() => lastPublish(context))
      .toMatchObject({
        relays: [{ url: "wss://relay.test", accepted: false }],
      })
    expect(await viewPublishedAt(context)).toBe(null)
  })

  test("publishes a refused view again when the owner asks", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const tag = viewTag(context)
    let viewAttempts = 0
    const nostrRelayClient: NostrRelayClient = {
      ...context.deps.nostrRelayClient,
      publish: async (relays, event) => {
        if (getNostrTag(event, "d") === tag) viewAttempts++
        return await context.deps.nostrRelayClient.publish(relays, event)
      },
    }
    context.relay.refuseEvents(true)
    await using _job = await startJob(context, {
      nostrRelayClient,
      livenessIntervalMs: 60_000,
    })
    await expect.poll(() => lastPublish(context)).not.toBe(null)
    await new Promise((resolve) => setTimeout(resolve, 100))
    const attemptsBeforeRetry = viewAttempts
    context.relay.refuseEvents(false)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(viewAttempts).toBe(attemptsBeforeRetry)

    await using run = testCreateRun(context.deps)
    await run.ok(requestTableSelfPayPublish(context.tableId))

    await expect
      .poll(() => lastPublish(context))
      .toMatchObject({
        relays: [{ url: "wss://relay.test", accepted: true }],
      })
  })

  test("publishes the view again to a relay the account switches on", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const { viewKey } = tableKeys(context)
    const viewTag = deriveSelfPayViewTag(viewKey)
    const livenessTag = deriveSelfPayLivenessTag(viewKey)
    const viewRelays: ReadonlyArray<string>[] = []
    const livenessRelays: ReadonlyArray<string>[] = []
    const nostrRelayClient: NostrRelayClient = {
      ...context.deps.nostrRelayClient,
      publish: async (relays, event) => {
        const tag = getNostrTag(event, "d")
        if (tag === viewTag) viewRelays.push(relays)
        if (tag === livenessTag) livenessRelays.push(relays)
        return await context.deps.nostrRelayClient.publish(relays, event)
      },
    }
    await using _job = await startJob(context, {
      nostrRelayClient,
      livenessIntervalMs: 60_000,
    })
    const defaults = context.deps.selfPayDefaultRelays
    await expect.poll(() => livenessRelays.at(-1)).toEqual(defaults)
    expect(viewRelays.at(-1)).toEqual(defaults)

    await using run = testCreateRun(context.deps)
    await run.ok(
      setSelfPayRelayActive({ url: WssUrl("wss://own.test"), isActive: true })
    )

    await expect
      .poll(() => livenessRelays.at(-1))
      .toEqual([...defaults, "wss://own.test"])
    await expect
      .poll(() => viewRelays.at(-1))
      .toEqual([...defaults, "wss://own.test"])
  })

  test("keeps publishing bank payment while Spark is unreachable", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(
      saveFioPlugin({
        accountId: context.ibanAccountId,
        numberOfSecondsBetweenChecks: PositiveInteger(60),
        isActive: sqliteTrue,
      })
    )

    await using job = await startJob(context, {
      sparkWallet: {
        create: async () => {
          throw new Error("Spark is unreachable.")
        },
      },
    })

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({
        bills: [{ reference }],
        bank: { iban: "CZ6508000000192000145399" },
        lightning: null,
      })
    expect(job.errors).toEqual([])
  })

  test("after a restart, publishes a changed view above the one before it", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const tag = deriveSelfPayViewTag(tableKeys(context).viewKey)
    {
      await using _job = await startJob(context)
      await expect
        .poll(() => publishedView(context)?.lightning)
        .toMatchObject({ identityPublicKey })
    }
    const before = newestWithTag(context, tag)?.created_at ?? 0

    await using _job = await startJob(context, {
      sparkWallet: {
        create: async () => {
          throw new Error("Spark is unreachable.")
        },
      },
    })

    await expect
      .poll(() => newestWithTag(context, tag)?.created_at)
      .toBe(before + 1)
    expect(publishedView(context)?.lightning).toBeNull()
  })

  test("lifts a healed view above the one it displaced before a restart", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const healthySpark = fakeSparkWallet()
    let isSparkReachable = true
    const sparkWallet = {
      create: async () => {
        if (!isSparkReachable) throw new Error("Spark is unreachable.")
        return healthySpark.create()
      },
    }
    {
      await using _job = await startJob(context, { sparkWallet })
      await expect
        .poll(() => publishedView(context)?.lightning)
        .toMatchObject({ identityPublicKey })
      isSparkReachable = false
      await expect.poll(() => publishedView(context)?.lightning).toBeNull()
    }
    isSparkReachable = true

    await using _job = await startJob(context, { sparkWallet })

    await expect
      .poll(() => publishedView(context)?.lightning)
      .toMatchObject({ identityPublicKey })
  })

  test("turns Spark privacy mode on before offering Lightning", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const sparkWallet = fakeSparkWallet("public")

    await using job = await startJob(context, { sparkWallet })

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({ lightning: { identityPublicKey } })
    expect(sparkWallet.privacyRequests).toEqual([true])
    expect(job.errors).toEqual([])
  })

  test("offers no Lightning while the Spark wallet stays public", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })

    await using job = await startJob(context, {
      sparkWallet: fakeSparkWallet("staysPublic"),
    })

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({ bills: [{ reference }], lightning: null })
    expect(job.errors).toEqual([])
  })

  test("leaves Spark privacy mode alone while self-pay is switched off", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(updateTable({ id: context.tableId, selfPayEnabled: 0 }))
    const sparkWallet = fakeSparkWallet("public")

    await using _job = await startJob(context, { sparkWallet })

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({ enabled: false })
    expect(sparkWallet.privacyRequests).toEqual([])
  })

  test("replaces the view with an empty one when the last bill closes", async () => {
    await using context = await createSelfPayTestContext()
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using _job = await startJob(context)
    await expect.poll(() => publishedView(context)?.bills.length).toBe(1)

    context.clock.advance(60_000)
    await receiveBankTransfer(context, {
      amount: 10_100,
      variableSymbol: reference,
    })

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({ enabled: true, bills: [] })
  })

  test("tells guests to pay with staff once self-pay is switched off", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using _job = await startJob(context)
    await expect.poll(() => publishedView(context)?.bills.length).toBe(1)

    await using run = testCreateRun(context.deps)
    await run.ok(updateTable({ id: context.tableId, selfPayEnabled: 0 }))

    await expect
      .poll(() => publishedView(context))
      .toMatchObject({ enabled: false, bills: [] })
  })

  test("moves the bills to the new keys and empties the old ones on regeneration", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using _job = await startJob(context)
    await expect.poll(() => publishedView(context)?.bills.length).toBe(1)

    await using run = testCreateRun(context.deps)
    await run.ok(
      updateTable({
        id: context.tableId,
        selfPayEpoch: NonNegativeInteger(1),
      })
    )

    await expect.poll(() => publishedView(context, 1)?.bills.length).toBe(1)
    await expect
      .poll(() => publishedView(context, 0))
      .toMatchObject({ enabled: false, bills: [] })
  })

  test("regenerated twice before a publish, the oldest sticker shows nothing to pay", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    {
      await using _job = await startJob(context)
      await expect.poll(() => publishedView(context)?.bills.length).toBe(1)
    }

    await using run = testCreateRun(context.deps)
    for (const epoch of [1, 2]) {
      await run.ok(
        updateTable({
          id: context.tableId,
          selfPayEpoch: NonNegativeInteger(epoch),
        })
      )
    }
    const [regenerated] = await context.deps.evolu.loadQuery(selfPayTablesQuery)
    expect(regenerated?.selfPayEpoch).toBe(2)
    await using _job = await startJob(context)

    await expect.poll(() => publishedView(context, 2)?.bills.length).toBe(1)
    await expect
      .poll(() => publishedView(context, 0))
      .toMatchObject({ enabled: false, bills: [] })
  })
})
