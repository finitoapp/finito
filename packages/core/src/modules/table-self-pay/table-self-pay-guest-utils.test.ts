import { Version } from "bysquare"
import { decode as decodePayBySquare, validateDataModel } from "bysquare/pay"
import { describe, expect, test } from "vitest"
import { createNostrRelayClient } from "../../integrations/nostr/nostr-relay-client.ts"
import { createFakeNostrRelay } from "../../integrations/nostr/nostr-relay-test-fixtures.ts"
import { createGuestLightningInvoice } from "../../spark/spark-guest-invoice.ts"
import {
  deriveTableSelfPayKeys,
  deriveTableSelfPayRoot,
} from "../shared/key-derivation.ts"
import { IbanSchema } from "../shared/schema.ts"
import { createTableSelfPayAddress } from "./table-self-pay-address-utils.ts"
import {
  createSelfPayBankQrPayload,
  createSelfPayLightningRequest,
  createSelfPaySpaydPayload,
  createSelfPayViewFilter,
  findSelfPayBank,
  findSelfPayConfirmation,
  findUsableSelfPayRate,
  isSelfPayViewStale,
  keepNewerSelfPayContent,
  pickNewestSelfPayContent,
  selfPayRateChangesAt,
  selfPayViewConfirmedAt,
  selfPayViewStaleFrom,
} from "./table-self-pay-guest-utils.ts"
import {
  createSelfPayShareSelectionText,
  deriveSelfPayPointer,
} from "./table-self-pay-pointer-utils.ts"
import {
  createSelfPayRate,
  selfPayCreditForSats,
  selfPayRateValidUntil,
  signSelfPayRate,
} from "./table-self-pay-rate-utils.ts"
import {
  deriveBillSelfPayReference,
  deriveSelfPayPointerHash,
  parseSelfPayLightningMemo,
} from "./table-self-pay-reference-utils.ts"
import type { SelfPaySplit } from "./table-self-pay-share-utils.ts"
import { selfPayTestMasterKey } from "./table-self-pay-test-fixtures.ts"
import {
  createSelfPayViewEvent,
  deriveSelfPayViewTag,
  type SelfPayView,
  type SelfPayViewBill,
  SelfPayViewSchema,
} from "./table-self-pay-view-utils.ts"

const pointerOf = (current: SelfPayViewBill, split: SelfPaySplit) =>
  deriveSelfPayPointer(
    createSelfPayShareSelectionText({ bill: current, split })
  )

const payBySquareVersionOf = (payload: string) =>
  (Number.parseInt(payload.slice(0, 2), 32) >> 2) & 0b1111

const root = deriveTableSelfPayRoot(selfPayTestMasterKey)
const keys = deriveTableSelfPayKeys(root, "table-3", 0)
const foreignKeys = deriveTableSelfPayKeys(root, "table-4", 0)

const bill = (
  lines: ReadonlyArray<{
    readonly key: string
    readonly totalAmount: number
    readonly allocatedAmount?: number
    readonly quantity?: number
  }>,
  covered = 0
): SelfPayViewBill => {
  const total = lines.reduce((sum, line) => sum + line.totalAmount, 0)
  return {
    reference: deriveBillSelfPayReference("bill-1"),
    currency: "CZK",
    total,
    covered,
    remainder: Math.max(0, total - covered),
    lines: lines.map(({ key, totalAmount, allocatedAmount, quantity }) => ({
      key,
      name: key,
      quantity: quantity ?? 1,
      totalAmount,
      allocatedAmount: allocatedAmount ?? 0,
    })),
  }
}

const view = (bills: ReadonlyArray<SelfPayViewBill>): SelfPayView => ({
  v: 1,
  table: "Table 3",
  enabled: true,
  payee: "Bistro",
  bank: {
    iban: IbanSchema.decode("CZ6508000000192000145399"),
    accountName: "Bistro *Praha*",
    currency: "CZK",
    qrFormat: "spayd",
  },
  lightning: { identityPublicKey: `02${"ab".repeat(32)}` },
  selectionKey: "cd".repeat(32),
  bills: [...bills],
  confirmations: [],
})

describe("loading the view", () => {
  test("asks relays for views the table's key signed, with nothing that reads them", () => {
    const address = createTableSelfPayAddress("https://t.example", {
      ...keys,
      relays: [],
    })
    const fragment = address.slice(address.indexOf("#") + 1)
    const filter = createSelfPayViewFilter(keys)
    const request = JSON.stringify(filter)
    const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex")

    expect(filter.authors).toEqual([toHex(keys.publicKey)])
    expect(request).not.toContain(fragment.slice(2))
    expect(request).not.toContain(toHex(keys.viewKey))
  })

  const event = (content: SelfPayView, version: number, signing = keys) =>
    createSelfPayViewEvent({
      signingKey: signing.signingKey,
      viewKey: keys.viewKey,
      view: content,
      version,
    })
  const pick = (
    events: Parameters<typeof pickNewestSelfPayContent>[0]["events"]
  ) =>
    pickNewestSelfPayContent({
      events,
      publicKey: keys.publicKey,
      viewKey: keys.viewKey,
      tag: deriveSelfPayViewTag(keys.viewKey),
      schema: SelfPayViewSchema,
    })

  test("shows the newest authentic view", () => {
    const older = view([bill([{ key: "AAAAAAAA", totalAmount: 100 }])])
    const newer = view([bill([{ key: "AAAAAAAA", totalAmount: 200 }])])

    expect(pick([event(older, 10), event(newer, 20)])).toEqual({
      value: newer,
      createdAt: 20,
    })
  })

  test("ignores a view signed by any other key", () => {
    const genuine = view([])
    const forged = view([bill([{ key: "AAAAAAAA", totalAmount: 1 }])])

    expect(pick([event(genuine, 10), event(forged, 99, foreignKeys)])).toEqual({
      value: genuine,
      createdAt: 10,
    })
    expect(pick([event(forged, 99, foreignKeys)])).toBe(null)
  })

  test("finds the table's view under a relay full of junk for its address", async () => {
    const relay = createFakeNostrRelay()
    const urls = ["wss://relay.test"]
    const relays = createNostrRelayClient({ createSocket: relay.createSocket })
    const genuine = view([bill([{ key: "AAAAAAAA", totalAmount: 100 }])])
    await relays.publish(urls, event(genuine, 10))
    for (let junk = 0; junk < 30; junk++) {
      await relays.publish(
        urls,
        event(
          view([]),
          100 + junk,
          deriveTableSelfPayKeys(root, `junk-${junk}`, 0)
        )
      )
    }

    const events = await relays.query(urls, createSelfPayViewFilter(keys))

    expect(pick(events)).toEqual({ value: genuine, createdAt: 10 })
  })

  test("never replaces a view it has shown with an older one", () => {
    const older = { value: view([]), createdAt: 10 }
    const newer = { value: view([]), createdAt: 20 }

    expect(keepNewerSelfPayContent(newer, older)).toBe(newer)
    expect(keepNewerSelfPayContent(newer, null)).toBe(newer)
    expect(keepNewerSelfPayContent(older, newer)).toBe(newer)
    expect(keepNewerSelfPayContent(null, older)).toBe(older)
  })

  test("ignores a tampered event", () => {
    const genuine = event(view([]), 10)

    expect(pick([{ ...genuine, created_at: 11 }])).toBe(null)
  })

  test("warns when no device confirmed the table for ten minutes", () => {
    expect(isSelfPayViewStale(1000, 1000 + 600)).toBe(false)
    expect(isSelfPayViewStale(1000, 1000 + 601)).toBe(true)
    expect(isSelfPayViewStale(null, 1000)).toBe(true)
  })

  test("names the second the view turns stale", () => {
    expect(selfPayViewStaleFrom(1000)).toBe(1601)
    expect(isSelfPayViewStale(1000, 1600)).toBe(false)
    expect(isSelfPayViewStale(1000, 1601)).toBe(true)
    expect(selfPayViewStaleFrom(null)).toBe(null)
  })

  test("counts a confirmation only for the view it names or a newer one", () => {
    const shown = { value: view([]), createdAt: 20 }
    const confirming = (viewVersion: number) => ({
      value: { v: 1 as const, viewVersion, rates: [] },
      createdAt: 1000,
    })

    expect(selfPayViewConfirmedAt(shown, confirming(20))).toBe(1000)
    expect(selfPayViewConfirmedAt(shown, confirming(19))).toBe(1000)
    expect(selfPayViewConfirmedAt(shown, confirming(21))).toBe(null)
    expect(selfPayViewConfirmedAt(shown, null)).toBe(null)
  })
})

describe("paying by bank transfer", () => {
  test("offers the bank only to a bill in its account's currency", () => {
    const koruna = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
    const euro = { ...koruna, currency: "EUR" as const }
    const table = view([koruna, euro])

    expect(findSelfPayBank(table, koruna)).toBe(table.bank)
    expect(findSelfPayBank(table, euro)).toBe(null)
  })

  test("puts the account, amount, reference and the share's pointer into SPAYD", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
    const pointer = pointerOf(current, { kind: "remainder" })

    expect(
      createSelfPaySpaydPayload({
        bank: {
          iban: IbanSchema.decode("CZ6508000000192000145399"),
          accountName: "Bistro *Praha*",
          currency: "CZK",
          qrFormat: "spayd",
        },
        bill: current,
        amount: 11_100,
        pointer,
      })
    ).toBe(
      `SPD*1.0*ACC:CZ6508000000192000145399*AM:111.00*CC:CZK*PT:IP*X-VS:${current.reference}*MSG:PK1${pointer}*RN:Bistro %2APraha%2A`
    )
  })

  test.each([
    [
      "a long name",
      "Bistro na nádraží u Fatíka a jeho přátel",
      "Bistro na nádraží u Fatíka a jeho p",
    ],
    ["a name of stars", "*".repeat(20), "%2A".repeat(11)],
  ])(
    "keeps %s within the 35 characters SPAYD allows a payee",
    (_name, accountName, payee) => {
      const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])

      expect(
        createSelfPaySpaydPayload({
          bank: {
            iban: IbanSchema.decode("CZ6508000000192000145399"),
            accountName,
            currency: "CZK",
            qrFormat: "spayd",
          },
          bill: current,
          amount: 10_100,
          pointer: pointerOf(current, { kind: "remainder" }),
        })
      ).toMatch(new RegExp(`\\*RN:${payee.replaceAll("*", "\\*")}$`, "u"))
    }
  )

  test("names no recipient while the owner has chosen no name for guests", async () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
    const unnamed = {
      iban: IbanSchema.decode("SK3112000000198742637541"),
      accountName: "",
      currency: "CZK" as const,
      qrFormat: "spayd" as const,
    }
    const payment = {
      bank: unnamed,
      bill: current,
      amount: 10_100,
      pointer: pointerOf(current, { kind: "remainder" }),
    }

    expect(createSelfPaySpaydPayload(payment)).not.toContain("RN:")
    const [paid] = decodePayBySquare(
      await createSelfPayBankQrPayload({
        ...payment,
        format: "payBySquare1_2_0",
      })
    ).payments
    expect(paid?.beneficiary?.name ?? "").toBe("")
  })

  test.each([
    ["no name", "", Version["1.0.0"]],
    ["a name", "Kavárna U Lípy", Version["1.2.0"]],
  ] as const)(
    "picks a PAY by square version that accepts %s for guests",
    async (_payee, accountName, version) => {
      const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])

      const payload = await createSelfPayBankQrPayload({
        format: "payBySquare1_2_0",
        bank: {
          iban: IbanSchema.decode("SK3112000000198742637541"),
          accountName,
          currency: "CZK",
          qrFormat: "spayd",
        },
        bill: current,
        amount: 10_100,
        pointer: pointerOf(current, { kind: "remainder" }),
      })

      expect(payBySquareVersionOf(payload)).toBe(version)
      expect(() =>
        validateDataModel(decodePayBySquare(payload), version)
      ).not.toThrow()
    }
  )

  test.each(["payBySquare1_2_0", "payBySquare1_0_0"] as const)(
    "puts the amount, reference and the share's pointer into %s",
    async (format) => {
      const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
      const pointer = pointerOf(current, { kind: "remainder" })

      const payload = await createSelfPayBankQrPayload({
        format,
        bank: {
          iban: IbanSchema.decode("SK3112000000198742637541"),
          accountName: `Bistro Košice ${"x".repeat(80)}`,
          currency: "CZK",
          qrFormat: "spayd",
        },
        bill: current,
        amount: 11_100,
        pointer,
      })

      expect(decodePayBySquare(payload).payments).toEqual([
        expect.objectContaining({
          amount: 111,
          currencyCode: "CZK",
          variableSymbol: current.reference,
          paymentNote: `PK1${pointer}`,
          bankAccounts: [{ iban: "SK3112000000198742637541" }],
          beneficiary: expect.objectContaining({
            name: `Bistro Kosice ${"x".repeat(56)}`,
          }),
        }),
      ])
    }
  )
})

describe("paying by Lightning", () => {
  const now = new Date("2026-06-05T12:00:00Z")
  const rate = {
    currency: "CZK" as const,
    ...signSelfPayRate(
      new Uint8Array(32),
      createSelfPayRate({ currency: "CZK", exchangeRate: 2_500_000, now })
    ),
  }
  const seconds = Math.floor(now.getTime() / 1000)

  test("offers only a rate still valid for a fresh invoice", () => {
    const liveness = { v: 1 as const, viewVersion: seconds, rates: [rate] }

    expect(findUsableSelfPayRate(liveness, "CZK", seconds)).toEqual(rate)
    expect(findUsableSelfPayRate(liveness, "EUR", seconds)).toBe(null)
    expect(
      findUsableSelfPayRate(liveness, "CZK", rate.validFrom + 50 * 60)
    ).toEqual(rate)
    expect(
      findUsableSelfPayRate(
        liveness,
        "CZK",
        selfPayRateValidUntil(rate.validFrom) - 30
      )
    ).toBe(null)
    expect(findUsableSelfPayRate(null, "CZK", seconds)).toBe(null)
  })

  test("names every second a rate starts or stops being offered", () => {
    const liveness = { v: 1 as const, viewVersion: seconds, rates: [rate] }
    const [startsAt, stopsAt] = selfPayRateChangesAt(liveness, "CZK")

    expect(startsAt).toBe(rate.validFrom)
    expect(findUsableSelfPayRate(liveness, "CZK", rate.validFrom - 1)).toBe(
      null
    )
    expect(findUsableSelfPayRate(liveness, "CZK", rate.validFrom)).toEqual(rate)
    expect(stopsAt).toBeDefined()
    expect(findUsableSelfPayRate(liveness, "CZK", (stopsAt ?? 0) - 1)).toEqual(
      rate
    )
    expect(findUsableSelfPayRate(liveness, "CZK", stopsAt ?? 0)).toBe(null)
    expect(selfPayRateChangesAt(liveness, "EUR")).toEqual([])
  })

  test("mints an invoice for the merchant whose memo the terminal parses back", async () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 45_000 }])
    const pointer = pointerOf(current, { kind: "remainder" })
    const request = createSelfPayLightningRequest({
      bill: current,
      amount: 45_000,
      pointer,
      rate,
    })
    const minted: Array<Record<string, unknown>> = []

    const invoice = await createGuestLightningInvoice({
      ...request,
      receiverIdentityPubkey: `02${"ab".repeat(32)}`,
      wallet: Promise.resolve({
        createLightningInvoice: async (params) => {
          minted.push(params)
          return { invoice: { encodedInvoice: "lnbc1test" } }
        },
        cleanup: async () => undefined,
      }),
    })

    expect(invoice).toBe("lnbc1test")
    expect(minted).toEqual([
      {
        amountSats: 18_000,
        memo: request.memo,
        expirySeconds: 600,
        receiverIdentityPubkey: `02${"ab".repeat(32)}`,
      },
    ])
    expect(parseSelfPayLightningMemo(request.memo)).toEqual({
      reference: current.reference,
      pointer,
      amount: 45_000,
      rate: {
        msatPerMajor: rate.msatPerMajor,
        validFrom: rate.validFrom,
        tag: rate.tag,
      },
    })
    expect(
      selfPayCreditForSats({
        sats: request.amountSats,
        fractionDigits: 2,
        msatPerMajor: rate.msatPerMajor,
      })
    ).toBeGreaterThanOrEqual(45_000)
  })
})

describe("createGuestLightningInvoice", () => {
  test("gives up on a wallet that never answers, so the guest can retry", async () => {
    await expect(
      createGuestLightningInvoice({
        amountSats: 1000,
        memo: "memo",
        receiverIdentityPubkey: `02${"ab".repeat(32)}`,
        wallet: new Promise(() => undefined),
        timeoutMs: 20,
      })
    ).rejects.toThrow("Spark did not answer in time.")
  })
})

describe("the payer's confirmation", () => {
  test("shows only on the page that holds the payment's pointer", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
    const mine = pointerOf(current, {
      kind: "lines",
      fractions: [{ key: "PIZZAAAA", numerator: 1, denominator: 5 }],
    })
    const theirs = pointerOf(current, { kind: "remainder" })
    const confirmed: SelfPayView = {
      ...view([current]),
      confirmations: [
        {
          pointerHash: deriveSelfPayPointerHash(mine),
          amount: 2020,
          currency: "CZK",
          at: 1,
        },
      ],
    }

    expect(findSelfPayConfirmation(confirmed, mine)?.amount).toBe(2020)
    expect(findSelfPayConfirmation(confirmed, theirs)).toBe(null)
  })

  test("two guests with the same split see only their own confirmation", () => {
    const current = bill([{ key: "PIZZAAAA", totalAmount: 10_100 }])
    const half = { kind: "fractionOfBill", denominator: 2 } as const
    const first = pointerOf(current, half)
    const second = pointerOf(current, half)
    const confirmed: SelfPayView = {
      ...view([current]),
      confirmations: [
        {
          pointerHash: deriveSelfPayPointerHash(first),
          amount: 5050,
          currency: "CZK",
          at: 1,
        },
      ],
    }

    expect(findSelfPayConfirmation(confirmed, first)?.amount).toBe(5050)
    expect(findSelfPayConfirmation(confirmed, second)).toBe(null)
  })
})
