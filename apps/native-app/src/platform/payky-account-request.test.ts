import { readFileSync } from "node:fs"
import {
  ACCOUNT_SHARE_ACTION,
  ACCOUNT_SHARE_PACKAGE,
  ANDROID_RESULT_CANCELED,
  ANDROID_RESULT_OK,
  accountShareExtras,
  createShareRequest,
  encodeShareAnswer,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { MasterKey } from "@payky/core/modules/shared/key-derivation"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, test, vi } from "vitest"

const platform = vi.hoisted(() => ({ os: "android" }))
const requireModule = vi.hoisted(() => vi.fn(() => null))
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.os
    },
  },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}))
vi.mock("expo", () => ({
  NativeModule: class {},
  requireOptionalNativeModule: requireModule,
}))

const { canRequestAccountFromPayky, requestAccountFromPayky } = await import(
  "./payky-account-request.ts"
)
const {
  canRequestAccountFromPaykyQueryKey,
  invalidateCanRequestAccountFromPayky,
} = await import("../features/shared/use-can-request-account-from-payky.ts")

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const js = read("./payky-account-request.ts")
const moduleRoot = "../../modules/payky-account-request/android/src/main/"
const kotlin = read(
  `${moduleRoot}java/me/payky/accountrequest/PaykyAccountRequestModule.kt`
)
const manifest = read(`${moduleRoot}AndroidManifest.xml`)

const payload = {
  masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
  accountName: NonEmptyString255("Shop"),
  transports: [],
}

const fakeModule = (
  requestAccount: (...args: ReadonlyArray<unknown>) => Promise<unknown>,
  canRequest = true
) => ({ canRequestAccount: () => canRequest, requestAccount })

describe("account request protocol in Finito's Android module", () => {
  test("names the module and its functions the same in JS and Kotlin", () => {
    expect(js).toContain(
      'requireOptionalNativeModule<PaykyAccountRequestNativeModule>(\n          "PaykyAccountRequest"'
    )
    expect(kotlin).toContain('Name("PaykyAccountRequest")')
    expect(kotlin).toContain('Function("canRequestAccount")')
    expect(kotlin).toContain('AsyncFunction("requestAccount")')
  })

  test("sends the protocol's package, action and extras", () => {
    expect(kotlin).toContain(`PAYKY_PACKAGE = "${ACCOUNT_SHARE_PACKAGE}"`)
    expect(kotlin).toContain(`ACTION = "${ACCOUNT_SHARE_ACTION}"`)
    for (const extra of Object.values(accountShareExtras)) {
      expect(kotlin).toContain(`= "${extra}"`)
    }
    expect(manifest).toContain(
      `<package android:name="${ACCOUNT_SHARE_PACKAGE}" />`
    )
  })

  test("uses the same not-installed rejection code on both sides", () => {
    const code = /PAYKY_NOT_INSTALLED_CODE = "([^"]+)"/u.exec(js)?.[1]
    expect(code).toBeDefined()
    expect(kotlin).toContain(`NOT_INSTALLED_CODE = "${code}"`)
  })

  test("stores no result", () => {
    expect(kotlin).not.toMatch(/SharedPreferences|getSharedPreferences/u)
  })
})

describe("requestAccountFromPayky", () => {
  test("returns the account Payky approved for this request", async () => {
    const request = createShareRequest("Finito")
    const requestAccount = vi.fn(async () => ({
      resultCode: ANDROID_RESULT_OK,
      account: encodeShareAnswer({ requestId: request.requestId, payload }),
      error: null,
    }))
    expect(
      await requestAccountFromPayky(request, {
        module: fakeModule(requestAccount),
      })
    ).toEqual({ ok: true, value: payload })
    expect(requestAccount).toHaveBeenCalledWith(
      1,
      request.requestId,
      request.code,
      "Finito"
    )
  })

  test("reads Payky's refusal", async () => {
    const result = await requestAccountFromPayky(createShareRequest("Finito"), {
      module: fakeModule(async () => ({
        resultCode: ANDROID_RESULT_CANCELED,
        account: null,
        error: "demo",
      })),
    })
    expect(result).toEqual({
      ok: false,
      error: { type: "AccountShareFailed", reason: "demo" },
    })
  })

  test("a launch no activity took is notInstalled", async () => {
    const result = await requestAccountFromPayky(createShareRequest("Finito"), {
      module: fakeModule(async () => {
        throw Object.assign(new Error("missing"), {
          code: "PAYKY_NOT_INSTALLED",
        })
      }),
    })
    expect(result).toEqual({
      ok: false,
      error: { type: "AccountShareFailed", reason: "notInstalled" },
    })
  })
})

describe("detecting Payky", () => {
  test("off Android the module is not asked", () => {
    platform.os = "ios"
    requireModule.mockClear()
    expect(canRequestAccountFromPayky()).toBe(false)
    expect(requireModule).not.toHaveBeenCalled()
    platform.os = "android"
  })

  test("follows what the installed Payky resolves to", () => {
    expect(
      canRequestAccountFromPayky({
        module: fakeModule(async () => null, false),
      })
    ).toBe(false)
    expect(
      canRequestAccountFromPayky({ module: fakeModule(async () => null) })
    ).toBe(true)
    expect(canRequestAccountFromPayky({ module: null })).toBe(false)
  })

  test("a launch that found no Payky asks the detection again", async () => {
    const queryClient = new QueryClient()
    const detect = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
    const observe = () =>
      queryClient.fetchQuery({
        queryKey: canRequestAccountFromPaykyQueryKey,
        queryFn: detect,
        staleTime: Number.POSITIVE_INFINITY,
      })
    expect(await observe()).toBe(true)
    expect(await observe()).toBe(true)
    await invalidateCanRequestAccountFromPayky(queryClient)
    expect(await observe()).toBe(false)
  })
})
