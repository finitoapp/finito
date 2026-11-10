import { describe, expect, test } from "vitest"
import { appOwnerIdPlaceholder } from "../../evolu/device-account.ts"
import { WssUrlSchema } from "./schema.ts"

describe("WssUrlSchema", () => {
  test("accepts a plain wss URL, including the owner placeholder", () => {
    expect(WssUrlSchema.safeParse("wss://relay.example.com").success).toBe(true)
    expect(
      WssUrlSchema.safeParse(`wss://relay.example.com/${appOwnerIdPlaceholder}`)
        .success
    ).toBe(true)
  })

  test("rejects other protocols and credentials", () => {
    expect(WssUrlSchema.safeParse("ws://relay.example.com").success).toBe(false)
    expect(
      WssUrlSchema.safeParse("wss://user:pass@relay.example.com").success
    ).toBe(false)
    expect(WssUrlSchema.safeParse("wss://user@relay.example.com").success).toBe(
      false
    )
  })

  test("rejects a value that is no URL instead of throwing", () => {
    expect(WssUrlSchema.safeParse("not a url").success).toBe(false)
    expect(WssUrlSchema.safeParse("").success).toBe(false)
  })
})
