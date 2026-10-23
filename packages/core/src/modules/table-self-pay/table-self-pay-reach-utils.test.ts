import { sqliteTrue } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { z } from "zod"
import { NonNegativeInteger, TimestampMs, WssUrl } from "../shared/schema.ts"
import {
  deriveGuestsCannotPayReason,
  findNewestPublishOfEachView,
  findNewestViewPublish,
  findRelaysThatRefusedLastPublish,
  pickSelfPayAccounts,
  type SelfPayPublishResult,
  SelfPayPublishResultJson,
} from "./table-self-pay-reach-utils.ts"

const bankAccount = { id: "bank", isDeleted: null }
const sparkAccount = { isDeleted: null }
const bankSync = [{ accountId: "bank" }]
const first = WssUrl("wss://first.test")
const second = WssUrl("wss://second.test")

const publish = (
  at: number,
  relays: SelfPayPublishResult["relays"],
  {
    version = 1,
    contentHash = "pizza",
  }: { readonly version?: number; readonly contentHash?: string } = {}
): SelfPayPublishResult => ({
  at: TimestampMs(at),
  version: NonNegativeInteger(version),
  contentHash,
  relays,
})

const reasonFor = (
  accounts: Parameters<typeof pickSelfPayAccounts>[0],
  lastPublish: SelfPayPublishResult | null = null
) =>
  deriveGuestsCannotPayReason({
    accounts: pickSelfPayAccounts(accounts),
    lastPublish,
  })

describe("whether guests can pay a table", () => {
  test("no payment method reaches guests", () => {
    expect(
      reasonFor({
        bankAccount: undefined,
        sparkAccount: undefined,
        activeBankPlugins: [],
      })
    ).toBe("noPaymentMethod")
  })

  test("a bank account without bank sync reaches no guest", () => {
    expect(
      reasonFor({ bankAccount, sparkAccount: undefined, activeBankPlugins: [] })
    ).toBe("noPaymentMethod")
    expect(
      reasonFor({
        bankAccount: { ...bankAccount, isDeleted: sqliteTrue },
        sparkAccount: undefined,
        activeBankPlugins: bankSync,
      })
    ).toBe("noPaymentMethod")
  })

  test("a bank account with bank sync reaches guests", () => {
    const accounts = pickSelfPayAccounts({
      bankAccount,
      sparkAccount: undefined,
      activeBankPlugins: bankSync,
    })

    expect(accounts).toEqual({ bank: bankAccount, spark: null })
    expect(deriveGuestsCannotPayReason({ accounts, lastPublish: null })).toBe(
      null
    )
  })

  test("Lightning alone reaches guests", () => {
    expect(
      pickSelfPayAccounts({
        bankAccount,
        sparkAccount,
        activeBankPlugins: [],
      })
    ).toEqual({ bank: null, spark: sparkAccount })
    expect(
      reasonFor({ bankAccount, sparkAccount, activeBankPlugins: [] })
    ).toBe(null)
  })

  test("no relay accepted the last publish", () => {
    const accounts = {
      bankAccount,
      sparkAccount: undefined,
      activeBankPlugins: bankSync,
    }

    expect(
      reasonFor(
        accounts,
        publish(2, [
          { url: first, accepted: false },
          { url: second, accepted: false },
        ])
      )
    ).toBe("noRelayAccepted")
    expect(
      reasonFor(
        accounts,
        publish(2, [
          { url: first, accepted: false },
          { url: second, accepted: true },
        ])
      )
    ).toBe(null)
  })

  test("a missing method outweighs a refused publish", () => {
    expect(
      reasonFor(
        {
          bankAccount: undefined,
          sparkAccount: undefined,
          activeBankPlugins: [],
        },
        publish(2, [{ url: first, accepted: false }])
      )
    ).toBe("noPaymentMethod")
  })
})

describe("a table every device publishes", () => {
  const accounts = {
    bankAccount,
    sparkAccount: undefined,
    activeBankPlugins: bankSync,
  }
  const reasonAfter = (results: ReadonlyArray<SelfPayPublishResult>) =>
    reasonFor(accounts, findNewestViewPublish(results))

  test("guests see a bill one device got to a relay that refused another device", () => {
    expect(
      reasonAfter([
        publish(1, [{ url: first, accepted: true }], { version: 5 }),
        publish(2, [{ url: first, accepted: false }], { version: 5 }),
      ])
    ).toBe(null)
  })

  test("guests cannot see a bill every device's publish was refused", () => {
    expect(
      reasonAfter([
        publish(1, [{ url: first, accepted: false }], { version: 5 }),
        publish(2, [{ url: second, accepted: false }], { version: 5 }),
      ])
    ).toBe("noRelayAccepted")
  })

  test("a relay that took an older bill does not show guests the newer one", () => {
    expect(
      reasonAfter([
        publish(1, [{ url: first, accepted: true }], {
          version: 4,
          contentHash: "pizza",
        }),
        publish(2, [{ url: first, accepted: false }], {
          version: 5,
          contentHash: "pizza and beer",
        }),
      ])
    ).toBe("noRelayAccepted")
  })

  test("a relay holding the same bill counts, whatever change raised its version", () => {
    expect(
      reasonAfter([
        publish(1, [{ url: first, accepted: true }], { version: 4 }),
        publish(2, [{ url: first, accepted: false }], { version: 5 }),
      ])
    ).toBe(null)
  })

  test("marks a relay refused only when no device's publish of a table's newest bill reached it", () => {
    const row = (tag: string, result: SelfPayPublishResult) => ({
      tag,
      lastPublishJson: z.encode(SelfPayPublishResultJson, result),
    })

    expect(
      findRelaysThatRefusedLastPublish(
        findNewestPublishOfEachView([
          row(
            "terrace",
            publish(
              1,
              [
                { url: first, accepted: true },
                { url: second, accepted: false },
              ],
              { version: 5 }
            )
          ),
          row(
            "terrace",
            publish(
              2,
              [
                { url: first, accepted: false },
                { url: second, accepted: false },
              ],
              { version: 5 }
            )
          ),
          row(
            "window",
            publish(1, [{ url: second, accepted: true }], {
              version: 9,
              contentHash: "beer",
            })
          ),
        ])
      )
    ).toEqual(new Set([second]))
  })
})

describe("publish results", () => {
  test("marks each relay by its own latest result", () => {
    expect(
      findRelaysThatRefusedLastPublish([
        publish(1, [
          { url: first, accepted: false },
          { url: second, accepted: true },
        ]),
        publish(3, [
          { url: first, accepted: true },
          { url: second, accepted: false },
        ]),
        publish(2, [{ url: second, accepted: true }]),
      ])
    ).toEqual(new Set([second]))
  })
})
