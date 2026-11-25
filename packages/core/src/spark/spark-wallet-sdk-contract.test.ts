import { SparkWallet } from "@buildonspark/spark-sdk"
import { expect, test } from "vitest"

// The private SDK methods `pooledWallet` relies on (spark-wallet.ts), which
// spark-wallet.test.ts mocks away. Vitest resolves the SDK's node/browser
// build, not the `dist/native` build Finito runs: the method names are the
// same in every build of SDK 0.14.0, but this test cannot vouch for native.
test("the SDK still has the stream handler the incoming announcement wraps", () => {
  const prototype = SparkWallet.prototype as unknown as Record<string, unknown>
  expect(prototype.handleStreamEvent).toBeTypeOf("function")
  expect(prototype.constructTransfersWithUserRequest).toBeTypeOf("function")
})
