import { WalletConfig } from "@buildonspark/spark-sdk"
import { describe, expect, test } from "vitest"

import { guestSparkEndpoints } from "./spark-guest-endpoints.ts"

describe("guestSparkEndpoints", () => {
  test("lets the guest page reach every host a mainnet Spark wallet calls", () => {
    const { signingOperators, electrsUrl, sspClientOptions } =
      WalletConfig.MAINNET
    const origins = [
      ...Object.values(signingOperators).map(({ address }) => address),
      electrsUrl,
      sspClientOptions.baseUrl,
    ].map((url) => new URL(url).origin)

    expect(guestSparkEndpoints).toEqual(expect.arrayContaining(origins))
  })
})
