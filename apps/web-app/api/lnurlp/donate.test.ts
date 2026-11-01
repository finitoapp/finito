import { afterEach, describe, expect, test, vi } from "vitest"
import type { DonateWallet } from "../../src/server/donate-wallet.js"
import { GET } from "./donate.ts"

vi.mock("../../src/server/donate-wallet.js", () => ({
  createDonateWallet: vi.fn(),
}))

const { createDonateWallet } = await import("../../src/server/donate-wallet.js")

/**
 * The env is read per request, so every case states the whole donation
 * configuration — including the two optional variables, which must be absent
 * unless a case is about them.
 */
const stubEnv = (
  overrides: Readonly<Record<string, string | undefined>> = {}
): void => {
  vi.stubEnv("PAYKY_DONATE_SPARK_MNEMONIC", "test mnemonic")
  vi.stubEnv("PAYKY_DONATE_CALLBACK_URL", undefined)
  vi.stubEnv("PAYKY_DONATE_IDENTIFIER", undefined)
  vi.stubEnv("PAYKY_BRAND", undefined)

  for (const [name, value] of Object.entries(overrides)) {
    vi.stubEnv(name, value)
  }
}

const spoofedRequest = (url = "https://payky.test/.well-known/lnurlp/donate") =>
  new Request(url, {
    headers: {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
    },
  })

interface MetadataBody {
  readonly callback: string
  readonly metadata: string
}

const identifierOf = (body: MetadataBody): string | undefined => {
  const entries = JSON.parse(body.metadata) as ReadonlyArray<readonly string[]>

  return entries.find(([kind]) => kind === "text/identifier")?.[1]
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(createDonateWallet).mockReset()
})

describe("LNURL-pay origin handling", () => {
  test("builds the callback from the request URL, not the forwarded host", async () => {
    stubEnv()

    const body = (await (await GET(spoofedRequest())).json()) as MetadataBody

    expect(body.callback).toBe("https://payky.test/.well-known/lnurlp/donate")
    expect(identifierOf(body)).toBe("donate@payky.test")
  })

  test("prefers the configured callback URL and takes the identifier from it", async () => {
    stubEnv({
      PAYKY_DONATE_CALLBACK_URL: "https://donate.payky.test/lnurlp",
    })

    const body = (await (await GET(spoofedRequest())).json()) as MetadataBody

    expect(body.callback).toBe("https://donate.payky.test/lnurlp")
    expect(identifierOf(body)).toBe("donate@donate.payky.test")
  })

  test("prefers an explicitly configured identifier", async () => {
    stubEnv({ PAYKY_DONATE_IDENTIFIER: "tips@payky.test" })

    const body = (await (await GET(spoofedRequest())).json()) as MetadataBody

    expect(identifierOf(body)).toBe("tips@payky.test")
  })

  test("builds the LUD-21 verify URL from the request URL too", async () => {
    stubEnv()
    const cleanup = vi.fn().mockResolvedValue(undefined)
    vi.mocked(createDonateWallet).mockResolvedValue({
      createLightningInvoice: () =>
        Promise.resolve({
          id: "invoice-id",
          invoice: { encodedInvoice: "lnbc10n1" },
        }),
      cleanup,
    } as unknown as DonateWallet)

    const response = await GET(
      spoofedRequest("https://payky.test/.well-known/lnurlp/donate?amount=1000")
    )

    expect(await response.json()).toMatchObject({
      pr: "lnbc10n1",
      verify: "https://payky.test/.well-known/lnurlp/donate?verify=invoice-id",
    })
    expect(cleanup).toHaveBeenCalledOnce()
  })
})

const descriptionOf = (body: MetadataBody): string | undefined => {
  const entries = JSON.parse(body.metadata) as ReadonlyArray<readonly string[]>

  return entries.find(([kind]) => kind === "text/plain")?.[1]
}

describe("LNURL-pay description", () => {
  test("asks for a donation to the app this deployment serves", async () => {
    stubEnv()
    const payky = (await (await GET(spoofedRequest())).json()) as MetadataBody
    stubEnv({ PAYKY_BRAND: "finito" })
    const finito = (await (await GET(spoofedRequest())).json()) as MetadataBody

    expect(descriptionOf(payky)).toBe("Donate to Payky")
    expect(descriptionOf(finito)).toBe("Donate to Finito")
  })
})

describe("LNURL-pay configuration", () => {
  test.each([
    {
      overrides: { PAYKY_DONATE_SPARK_MNEMONIC: undefined },
      shape: "no mnemonic",
    },
    {
      overrides: { PAYKY_DONATE_MIN_SATS: "abc" },
      shape: "a non-numeric minimum",
    },
    {
      overrides: { PAYKY_DONATE_MIN_SATS: "500", PAYKY_DONATE_MAX_SATS: "100" },
      shape: "a minimum above the maximum",
    },
    {
      overrides: { PAYKY_BRAND: "linky" },
      shape: "an unknown brand",
    },
  ])("answers $shape as not configured", async ({ overrides }) => {
    stubEnv(overrides)

    const body = (await (await GET(spoofedRequest())).json()) as {
      readonly status: string
      readonly reason: string
    }

    expect(body).toMatchObject({
      status: "ERROR",
      reason: "Donation endpoint is not configured.",
    })
  })
})
