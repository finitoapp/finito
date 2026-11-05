import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import { useEffect, useRef } from "react"
import { accountAtom } from "@/atoms/account.ts"
import {
  accountShareSessionAtom,
  createAccountShareSession,
  screenAccountShareRequest,
} from "@/atoms/account-share.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import {
  type AccountShareRequestState,
  getPendingAccountShareRequest,
  isAccountSharePlatform,
  respondToAccountShare,
  watchAccountShareRequest,
} from "@/platform/account-share.ts"
import { router } from "@/router.tsx"

/**
 * Picks up an account request another app on this phone sent
 * (account/0008) — at start-up and whenever the native half reports a new
 * one — and opens the approval page for it. A request Payky cannot honour is
 * refused here, before any page opens: from a demo account, from an account
 * not set up yet, and one that does not decode. A request that ended on the
 * native side (expired, replaced by a second one) closes its session, which
 * the page shows.
 */
export function AccountShareRequestHost() {
  const account = useAtomValue(accountAtom)
  const [settings] = useEvoluQuery(settingsQuery).data
  const setSession = useSetAtom(accountShareSessionAtom)
  const store = useStore()
  const screenRef = useRef({ demo: false, onboarded: false })
  screenRef.current = {
    demo: account.demo !== null,
    onboarded: settings !== undefined,
  }

  useEffect(() => {
    // Nothing sends a request elsewhere; the e2e bridge sets its own session.
    if (!isAccountSharePlatform()) return undefined
    let disposed = false

    const onState = async (state: AccountShareRequestState) => {
      if (disposed) return
      if (state.kind === "none") {
        setSession(null)
        return
      }
      if (state.kind === "invalid") {
        setSession(null)
        if (state.requestId !== null) {
          await respondToAccountShare({
            requestId: state.requestId,
            approved: false,
            error: state.unsupportedVersion
              ? "unsupportedVersion"
              : "invalidRequest",
          })
        }
        return
      }
      if (
        store.get(accountShareSessionAtom)?.request.requestId ===
        state.request.requestId
      ) {
        return
      }
      const refusal = screenAccountShareRequest(screenRef.current)
      if (refusal !== null) {
        setSession(null)
        await respondToAccountShare({
          requestId: state.request.requestId,
          approved: false,
          error: refusal,
        })
        return
      }
      setSession(
        createAccountShareSession(state.request, respondToAccountShare)
      )
      await router.navigate({ to: "/settings/accounts/share" })
    }

    const stop = watchAccountShareRequest((state) => {
      void onState(state)
    })
    void (async () => {
      await onState(await getPendingAccountShareRequest())
    })()

    return () => {
      disposed = true
      void (async () => {
        await (await stop)()
      })()
    }
  }, [setSession, store])

  return null
}
