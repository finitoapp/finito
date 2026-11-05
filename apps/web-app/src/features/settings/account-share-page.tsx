import { useTimestamp } from "@dedalik/use-react"
import {
  createTransferPayload,
  formatTransferCode,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { useRouter } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { Check, ShieldAlert, TriangleAlert, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import {
  type AccountShareSession,
  accountShareSessionAtom,
} from "@/atoms/account-share.ts"
import { evoluCounterAtom } from "@/atoms/evolu-counter.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatCountdown } from "@/lib/format-utils.ts"
import { setAccountShareOverlayProtection } from "@/platform/account-share.ts"

/**
 * Payky's half of account/0008: another app on this phone asks for the
 * active account. The page shows who asks as Android names it (label, icon,
 * package), beside the name the request claims for itself, the code the
 * requester shows, and the account that would leave.
 *
 * It answers once. Leaving the page — back, the PIN lock, an account switch —
 * refuses the request, and so does its expiry; while it is up no other app
 * may draw over it.
 */
export function AccountSharePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useAtomValue(accountShareSessionAtom)
  const [ended, setEnded] = useState<"expired" | null>(null)
  const now = useTimestamp({ interval: 1000 })
  const close = () => {
    void router.navigate({ to: "/", replace: true })
  }

  useEffect(() => {
    void setAccountShareOverlayProtection(true)
    return () => {
      void setAccountShareOverlayProtection(false)
    }
  }, [])

  useRefuseOnLeave(session)

  const expired =
    ended === "expired" ||
    (session !== null && now >= session.request.expiresAt)
  useEffect(() => {
    if (session === null || !expired) return
    void session.refuse("expired")
  }, [session, expired])

  if (session === null || expired) {
    return (
      <>
        <div className="h-6" />
        <FadeHeader title={t("accountShare.title")} />
        <Card>
          <CardContent>
            <p className="text-sm">
              {t(expired ? "accountShare.expired" : "accountShare.none")}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="button" onClick={close}>
              {t("accountTransfer.close")}
            </Button>
          </CardFooter>
        </Card>
      </>
    )
  }

  return (
    <AccountShareRequestCard
      session={session}
      remainingMs={session.request.expiresAt - now}
      onAnswered={(delivered) => {
        if (delivered) close()
        else setEnded("expired")
      }}
    />
  )
}

/**
 * Refuses the open request once the page is really gone. The refusal waits a
 * tick, so StrictMode's simulated unmount and remount in development does
 * not end a request the page is still showing.
 */
function useRefuseOnLeave(session: AccountShareSession | null) {
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const accountVersion = useAtomValue(evoluCounterAtom)
  const startVersion = useRef(accountVersion)

  useEffect(() => {
    clearTimeout(leaveTimer.current)
    return () => {
      leaveTimer.current = setTimeout(() => {
        void session?.refuse("rejected")
      }, 0)
    }
  }, [session])

  // Another account became active: the request was for the one that was.
  useEffect(() => {
    if (accountVersion !== startVersion.current) {
      void session?.refuse("rejected")
    }
  }, [accountVersion, session])
}

function AccountShareRequestCard({
  session,
  remainingMs,
  onAnswered,
}: {
  readonly session: AccountShareSession
  readonly remainingMs: number
  readonly onAnswered: (delivered: boolean) => void
}) {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)
  const [pending, setPending] = useState(false)
  const { request } = session
  const claimed = request.requesterName
  const claimMismatch =
    claimed !== null &&
    claimed !== "" &&
    claimed.toLocaleLowerCase() !== request.callerLabel.toLocaleLowerCase()

  const answer = async (approved: boolean) => {
    if (pending) return
    setPending(true)
    const delivered = approved
      ? await session.approve(createTransferPayload(account))
      : await session.refuse("rejected")
    onAnswered(delivered || !approved)
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("accountShare.title")} />
      <Card>
        <CardHeader className="flex items-center gap-3">
          {request.callerIcon === null ? null : (
            <img
              src={request.callerIcon}
              alt=""
              className="size-12 shrink-0 rounded-xl"
            />
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-semibold">
              {t("accountShare.caller", { caller: request.callerLabel })}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {request.callerPackage}
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {claimed === null || claimed === "" ? null : (
            <p className="text-sm text-muted-foreground">
              {t("accountShare.claimed", { claimed })}
            </p>
          )}
          {claimMismatch ? (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>{t("accountShare.mismatch.title")}</AlertTitle>
              <AlertDescription>
                {t("accountShare.mismatch.description", {
                  caller: request.callerLabel,
                  claimed,
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm">
              {t("accountShare.code.instructions", {
                caller: request.callerLabel,
              })}
            </p>
            <p className="text-center font-mono text-5xl font-semibold tracking-widest tabular-nums">
              <span aria-hidden="true">{formatTransferCode(request.code)}</span>
              {/* Read digit by digit, not as one number. */}
              <span className="sr-only">
                {request.code.split("").join(" ")}
              </span>
            </p>
          </div>

          <p className="text-sm">
            {t("accountShare.account", { name: account.name })}
          </p>

          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>{t("accountShare.warning.title")}</AlertTitle>
            <AlertDescription>
              {t("accountShare.warning.description")}
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground tabular-nums">
            {t("accountShare.validFor", {
              time: formatCountdown(Math.max(0, remainingMs)),
            })}
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              void answer(false)
            }}
          >
            <X data-icon="inline-start" />
            {t("accountShare.reject")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              void answer(true)
            }}
          >
            <Check data-icon="inline-start" />
            {t("accountShare.approve")}
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
