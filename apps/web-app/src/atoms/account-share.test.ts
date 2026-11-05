import { MasterKey } from "@payky/core/modules/shared/key-derivation"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { describe, expect, test, vi } from "vitest"
import type { PendingAccountShareRequest } from "@/platform/account-share.ts"
import {
  type AccountShareResponder,
  createAccountShareSession,
  screenAccountShareRequest,
} from "./account-share.ts"

const request: PendingAccountShareRequest = {
  v: 1,
  requestId: "0123456789abcdef0123456789abcdef",
  code: "482913",
  requesterName: "Finito",
  callerPackage: "fit.finito.app",
  callerLabel: "Finito",
  callerIcon: null,
  receivedAt: 0,
  expiresAt: 120_000,
}

const payload = {
  masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
  accountName: NonEmptyString255("Shop"),
  transports: [],
}

describe("AccountShareRequestHost", () => {
  test.each([
    [{ demo: true, onboarded: true }, "demo"],
    [{ demo: false, onboarded: false }, "noAccount"],
  ] as const)(
    "refuses a request on %o without opening the page",
    (account, refusal) => {
      expect(screenAccountShareRequest(account)).toBe(refusal)
    }
  )

  test("asks the user for a request on a set-up account", () => {
    expect(screenAccountShareRequest({ demo: false, onboarded: true })).toBe(
      null
    )
  })
})

describe("AccountShareSession", () => {
  test("leaving the page after an approval refuses nothing", async () => {
    const respond = vi.fn<AccountShareResponder>(async () => true)
    const session = createAccountShareSession(request, respond)
    expect(await session.approve(payload)).toBe(true)
    // What the page does when it unmounts.
    expect(await session.refuse("rejected")).toBe(false)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond.mock.calls[0]?.[0]).toMatchObject({
      requestId: request.requestId,
      approved: true,
    })
  })

  test("leaving the page unanswered refuses the request", async () => {
    const respond = vi.fn<AccountShareResponder>(async () => true)
    const session = createAccountShareSession(request, respond)
    await session.refuse("rejected")
    expect(respond).toHaveBeenCalledWith({
      requestId: request.requestId,
      approved: false,
      error: "rejected",
    })
    expect(session.answered()).toBe(true)
  })
})
