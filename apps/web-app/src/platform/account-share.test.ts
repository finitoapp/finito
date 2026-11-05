import { readFileSync } from "node:fs"
import {
  ACCOUNT_SHARE_ACTION,
  ACCOUNT_SHARE_REQUEST_LIFETIME_MS,
  ACCOUNT_SHARE_VERSION,
  AccountShareRefusalSchema,
  accountShareExtras,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { describe, expect, test } from "vitest"
import { readAccountShareRequestState } from "./account-share.ts"

const javaRoot = "../../../native-shell/android/app/src/main/"
const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const activity = read(`${javaRoot}java/me/payky/AccountShareActivity.java`)
const requests = read(`${javaRoot}java/me/payky/AccountShareRequests.java`)
const plugin = read(`${javaRoot}java/me/payky/AccountSharePlugin.java`)
const mainActivity = read(`${javaRoot}java/me/payky/MainActivity.java`)
const manifest = read(`${javaRoot}AndroidManifest.xml`)
const js = read("./account-share.ts")

describe("account share protocol in Payky's Android half", () => {
  test("uses the protocol's action, version, extras and refusals", () => {
    expect(activity).toContain(`ACTION = "${ACCOUNT_SHARE_ACTION}"`)
    expect(manifest).toContain(
      `<action android:name="${ACCOUNT_SHARE_ACTION}" />`
    )
    expect(activity).toContain(`VERSION = ${ACCOUNT_SHARE_VERSION};`)
    for (const extra of Object.values(accountShareExtras)) {
      expect(activity).toContain(`= "${extra}";`)
    }
    for (const refusal of [
      "rejected",
      "busy",
      "expired",
      "unsupportedVersion",
      "invalidRequest",
    ] as const) {
      expect(AccountShareRefusalSchema.options).toContain(refusal)
      expect(activity).toContain(`= "${refusal}";`)
    }
    expect(requests).toContain(
      `REQUEST_LIFETIME_MS = ${ACCOUNT_SHARE_REQUEST_LIFETIME_MS.toLocaleString("en").replaceAll(",", "_")}L;`
    )
  })

  test("drops a launch that is not for a result", () => {
    expect(activity).toMatch(/getCallingPackage\(\);[\s\S]*caller == null/u)
  })

  test("runs the trampoline in the requester's task and registers the plugin", () => {
    expect(manifest).toMatch(
      /android:name="\.AccountShareActivity"[\s\S]*?android:launchMode="standard"/u
    )
    expect(mainActivity).toContain("registerPlugin(AccountSharePlugin.class)")
    expect(plugin).toContain('@CapacitorPlugin(name = "AccountShare")')
    expect(js).toContain(
      'registerPlugin<AccountShareNativePlugin>("AccountShare")'
    )
    expect(plugin).toContain('EVENT = "accountShareRequest"')
    expect(js).toContain('"accountShareRequest"')
  })
})

describe("readAccountShareRequestState", () => {
  const request = {
    v: 1,
    requestId: "0123456789abcdef0123456789abcdef",
    code: "482913",
    callerPackage: "fit.finito.app",
    callerLabel: "Finito",
    receivedAt: 0,
    expiresAt: 120_000,
  }

  test("reads an open request, with no claimed name or icon", () => {
    expect(readAccountShareRequestState({ request })).toEqual({
      kind: "open",
      request: { ...request, requesterName: null, callerIcon: null },
    })
  })

  test("reads no request", () => {
    expect(readAccountShareRequestState({})).toEqual({ kind: "none" })
    expect(readAccountShareRequestState({ request: null })).toEqual({
      kind: "none",
    })
  })

  test("keeps the id of a request it cannot read, to refuse it", () => {
    expect(
      readAccountShareRequestState({ request: { ...request, v: 2 } })
    ).toEqual({
      kind: "invalid",
      requestId: request.requestId,
      unsupportedVersion: true,
    })
    expect(
      readAccountShareRequestState({ request: { ...request, code: "1" } })
    ).toEqual({
      kind: "invalid",
      requestId: request.requestId,
      unsupportedVersion: false,
    })
  })
})
