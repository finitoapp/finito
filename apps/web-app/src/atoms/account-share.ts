import type { TransferPayload } from "@payky/core/integrations/nostr/nostr-account-transfer"
import {
  type AccountShareRefusal,
  encodeShareAnswer,
} from "@payky/core/integrations/payky-app/account-share-protocol"
import { atom } from "jotai"
import type { PendingAccountShareRequest } from "@/platform/account-share.ts"

/** How an answer reaches the requester: the native plugin, or the e2e bridge's fake. */
export type AccountShareResponder = (
  answer:
    | {
        readonly requestId: string
        readonly approved: true
        readonly account: string
      }
    | {
        readonly requestId: string
        readonly approved: false
        readonly error: AccountShareRefusal
      }
) => Promise<boolean>

/**
 * The account request another app sent (account/0008), as the approval page
 * answers it. It answers once: whatever comes after the first answer — the
 * page unmounting after an approval, a second tap — does nothing.
 */
export interface AccountShareSession {
  readonly request: PendingAccountShareRequest
  readonly approve: (payload: TransferPayload) => Promise<boolean>
  readonly refuse: (reason: AccountShareRefusal) => Promise<boolean>
  readonly answered: () => boolean
}

export const createAccountShareSession = (
  request: PendingAccountShareRequest,
  respond: AccountShareResponder
): AccountShareSession => {
  let answered = false
  const once = async (
    answer: Parameters<AccountShareResponder>[0]
  ): Promise<boolean> => {
    if (answered) return false
    answered = true
    return respond(answer)
  }
  return {
    request,
    approve: (payload) =>
      once({
        requestId: request.requestId,
        approved: true,
        account: encodeShareAnswer({ requestId: request.requestId, payload }),
      }),
    refuse: (error) =>
      once({ requestId: request.requestId, approved: false, error }),
    answered: () => answered,
  }
}

/**
 * The refusal a request gets without the page opening, or `null` to ask the
 * user: a demo account never leaves the device (demo-data/0001), and an
 * account that is not set up has nothing to give.
 */
export const screenAccountShareRequest = (account: {
  readonly demo: boolean
  readonly onboarded: boolean
}): AccountShareRefusal | null =>
  account.demo ? "demo" : account.onboarded ? null : "noAccount"

/** The open request; set by `AccountShareRequestHost` (or the e2e bridge). */
export const accountShareSessionAtom = atom<AccountShareSession | null>(null)
