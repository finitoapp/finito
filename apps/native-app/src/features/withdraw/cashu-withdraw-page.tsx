import {
  type CashuSendRequest,
  type CashuWithdrawRequest,
  cashuConfirmOutcome,
  cashuQuoteErrorMessage,
  cashuSendConfirmOutcome,
  cashuSendPinDetail,
  cashuSendQuoteErrorMessage,
  cashuWithdrawPinDetail,
  fundedMints,
  withdrawMint,
} from "@payky/app-shared/cashu-withdraw-flow"
import {
  createWithdrawDraft,
  draftComment,
} from "@payky/app-shared/withdraw-flow"
import type { AccountId } from "@payky/core/modules/account/account-types"
import type { MintUrl } from "@payky/core/modules/cashu/cashu-types"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import {
  type CashuWithdrawalQuote,
  executeCashuWithdrawal,
  quoteCashuWithdrawal,
} from "@payky/core/modules/withdraw/withdraw-cashu-actions"
import {
  type CashuSendQuote,
  executeCashuSendWithdrawal,
  quoteCashuSend,
} from "@payky/core/modules/withdraw/withdraw-cashu-send-actions"
import { router, useLocalSearchParams } from "expo-router"
import { useStore } from "jotai"
import { Suspense, useEffect, useRef, useState } from "react"
import { ScrollView } from "react-native"
import { useTheme } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../components/fade-header.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { useColumnScroll } from "../../components/web-column.tsx"
import { useAccess, useRequirePermission } from "../../core/use-access.ts"
import { useCashuAppRun } from "../../hooks/use-app-run.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { useCashuWalletSnapshot } from "../shared/cashu/use-cashu-wallet-snapshot.ts"
import { CashuSendReviewStep } from "./cashu-send-review-step.tsx"
import { CashuWithdrawFormStep } from "./cashu-withdraw-form-step.tsx"
import { CashuWithdrawReviewStep } from "./cashu-withdraw-review-step.tsx"
import { useCashuAccountId } from "./use-cashu-withdraw-data.ts"
import { WithdrawNoAccountCard } from "./withdraw-no-account-card.tsx"
import { withdrawRoutes } from "./withdraw-routes.ts"

/** The account the quote was made on: a review never outlives a switch. */
type CashuReview =
  | {
      readonly kind: "melt"
      readonly request: CashuWithdrawRequest
      readonly quote: CashuWithdrawalQuote
      readonly accountVersion: number
    }
  | {
      /** A token to a Linky contact (withdraw/0015). */
      readonly kind: "send"
      readonly request: CashuSendRequest
      readonly quote: CashuSendQuote
      readonly accountVersion: number
    }

/**
 * `/cashu-withdraw/new`: a Lightning withdrawal from one mint of the wallet
 * shared with Linky (cashu.md §6): the default mint preselected, a review of
 * the mint's own fees, and the PIN before anything leaves. Moves money.
 */
export function CashuWithdrawPage() {
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingHorizontal: screenPaddingX,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader title={t("withdraw.cashu.title")} />
      <Suspense fallback={<LoadingView />}>
        <CashuWithdrawAccount />
      </Suspense>
    </SafeAreaView>
  )
}

function CashuWithdrawAccount() {
  const { destination } = useLocalSearchParams<{ destination?: string }>()
  const accountId = useCashuAccountId()
  if (accountId === undefined) {
    return <WithdrawNoAccountCard method="cashu" />
  }
  return (
    <CashuWithdrawFlow
      accountId={accountId}
      initialDestination={destination ?? ""}
    />
  )
}

function CashuWithdrawFlow({
  accountId,
  initialDestination,
}: {
  readonly accountId: AccountId
  readonly initialDestination: string
}) {
  // CashuWithdrawPage's SafeAreaView pads the screen's sides.
  const column = useColumnScroll(screenPaddingX)
  const cashuAppRun = useCashuAppRun()
  const access = useAccess()
  const { require, requirePin } = useRequirePermission()
  const jotaiStore = useStore()
  const { t } = useTranslation()
  const locale = useLocale()
  const { snapshot } = useCashuWalletSnapshot()
  const [draft, setDraft] = useState(() =>
    createWithdrawDraft(initialDestination)
  )
  const [chosenMint, setChosenMint] = useState<MintUrl | null>(null)
  const [review, setReview] = useState<CashuReview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [requoting, setRequoting] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  // A melt may or may not have been sent: nothing is confirmed again from this
  // review until the merchant has gone back (withdraw/0007, withdraw/0013).
  const [uncertain, setUncertain] = useState(false)
  // `confirming` lags a render behind: a second press before it lands must
  // not melt the same quote twice.
  const confirmingRef = useRef(false)
  // A requote in flight: confirming then could melt a quote about to be replaced.
  const requotingRef = useRef(false)
  // Read when confirming, not when the handler was made (access/0007).
  const accessEnabledRef = useRef(access.enabled)
  accessEnabledRef.current = access.enabled
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const funded = fundedMints(snapshot?.balances ?? new Map<MintUrl, number>())
  const mint = withdrawMint({
    funded,
    chosen: chosenMint,
    defaultMint: snapshot?.defaultMint ?? null,
  })

  const confirm = async () => {
    if (review === null || confirmingRef.current || requotingRef.current) return
    confirmingRef.current = true
    // Stays locked after a melt was started: only a retryable end unlocks.
    let retryable = true
    try {
      retryable = await confirmReviewed(review)
    } finally {
      if (retryable) confirmingRef.current = false
    }
  }

  /** `true` when nothing was sent and the review may be confirmed again. */
  const confirmReviewed = async (reviewed: CashuReview): Promise<boolean> => {
    const { accountVersion } = reviewed
    const isCurrentAccount = () =>
      jotaiStore.get(evoluCounterAtom) === accountVersion
    // Quoted on another account: drop the review, send nothing.
    if (!isCurrentAccount()) {
      setReview(null)
      return true
    }
    const finishUnsent = (error: string | null) => {
      if (mountedRef.current) {
        setConfirming(false)
        setConfirmError(error)
      }
      return true
    }

    setConfirming(true)
    setConfirmError(null)

    // Moving money always asks for the PIN, session or not (access/0007).
    // With access control off there is no PIN, and `require` lets it through.
    const pinDetail =
      reviewed.kind === "melt"
        ? cashuWithdrawPinDetail({ quote: reviewed.quote, t, locale })
        : cashuSendPinDetail({ quote: reviewed.quote, t, locale })
    const allowed = accessEnabledRef.current
      ? await requirePin("access.action.withdraw", pinDetail)
      : await require("admin", "access.action.withdraw")
    // The screen was left or the account switched while the PIN was asked
    // for: the approval was for that screen, so nothing is sent.
    if (!allowed || !mountedRef.current || !isCurrentAccount()) {
      return finishUnsent(null)
    }

    // Before anything is written: a failure here has sent nothing.
    let prepared: Awaited<ReturnType<typeof cashuAppRun>>
    let deviceId: DeviceId
    try {
      deviceId = (await jotaiStore.get(accountAtom)).device.id
      prepared = await cashuAppRun()
    } catch {
      return finishUnsent(t("withdraw.review.error.generic"))
    }
    await using run = prepared
    if (!isCurrentAccount()) return finishUnsent(null)

    try {
      const comment = draftComment(draft)
      const outcome =
        reviewed.kind === "melt"
          ? cashuConfirmOutcome(
              await run(
                executeCashuWithdrawal({
                  accountId,
                  deviceId,
                  quote: reviewed.quote,
                  ...(comment === null ? {} : { comment }),
                })
              ),
              t
            )
          : cashuSendConfirmOutcome(
              await run(
                executeCashuSendWithdrawal({
                  accountId,
                  deviceId,
                  quote: reviewed.quote,
                  ...(comment === null ? {} : { comment }),
                })
              ),
              t
            )
      if (outcome.kind === "recorded") {
        // Sent: its detail follows what the mint does next, from the stored row.
        if (mountedRef.current && isCurrentAccount()) {
          router.replace({
            pathname: withdrawRoutes.cashu.detail,
            params: { withdrawalId: outcome.withdrawalId },
          })
        }
        return false
      }
      if (outcome.kind === "uncertain") {
        if (mountedRef.current && isCurrentAccount()) {
          setUncertain(true)
          setConfirming(false)
          setConfirmError(outcome.message)
        }
        return false
      }
      return finishUnsent(outcome.message)
    } catch {
      // Thrown after the melt may have been sent is indistinguishable from
      // thrown before it: never offer a retry. (A send's proofs stay in the
      // store either way; its withdrawal shows what became of them.)
      if (mountedRef.current) {
        setUncertain(true)
        setConfirming(false)
        setConfirmError(t("withdraw.review.error.uncertain"))
      }
      return false
    }
  }

  const requote = async () => {
    if (review === null || confirmingRef.current) return
    requotingRef.current = true
    setRequoting(true)
    setConfirmError(null)
    try {
      await using run = await cashuAppRun()
      if (review.kind === "melt") {
        const result = await run(quoteCashuWithdrawal(review.request))
        if (result.ok && !confirmingRef.current)
          setReview({ ...review, quote: result.value })
        else if (result.ok) return
        else setConfirmError(cashuQuoteErrorMessage(result.error, t))
      } else {
        const result = await run(quoteCashuSend(review.request))
        if (result.ok && !confirmingRef.current)
          setReview({ ...review, quote: result.value })
        else if (result.ok) return
        else setConfirmError(cashuSendQuoteErrorMessage(result.error, t))
      }
    } catch {
      setConfirmError(t("withdraw.quoteError.generic"))
    } finally {
      requotingRef.current = false
      setRequoting(false)
    }
  }

  return (
    <ScrollView
      style={column.style}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: 12,
        paddingBottom: 24,
        paddingHorizontal: column.padding,
      }}
    >
      {review === null ? (
        <CashuWithdrawFormStep
          funded={funded}
          mint={mint}
          onMintChange={setChosenMint}
          draft={draft}
          onDraftChange={setDraft}
          onReview={(request, quote) => {
            setConfirmError(null)
            setReview({
              kind: "melt",
              request,
              quote,
              accountVersion: jotaiStore.get(evoluCounterAtom),
            })
          }}
          onReviewSend={(request, quote) => {
            setConfirmError(null)
            setReview({
              kind: "send",
              request,
              quote,
              accountVersion: jotaiStore.get(evoluCounterAtom),
            })
          }}
        />
      ) : review.kind === "send" ? (
        <CashuSendReviewStep
          quote={review.quote}
          comment={draftComment(draft)}
          confirming={confirming}
          requoting={requoting}
          confirmError={confirmError}
          uncertain={uncertain}
          onBack={() => {
            if (confirmingRef.current && !uncertain) return
            confirmingRef.current = false
            setUncertain(false)
            setConfirmError(null)
            setReview(null)
          }}
          onConfirm={() => void confirm()}
          onNewQuote={() => void requote()}
          onOpenHistory={() => router.replace(withdrawRoutes.cashu.history)}
        />
      ) : (
        <CashuWithdrawReviewStep
          quote={review.quote}
          comment={draftComment(draft)}
          confirming={confirming}
          requoting={requoting}
          confirmError={confirmError}
          uncertain={uncertain}
          onBack={() => {
            // Back in the same frame as Confirm must not reset the guard
            // while the PIN prompt is open.
            if (confirmingRef.current && !uncertain) return
            setUncertain(false)
            confirmingRef.current = false
            setConfirmError(null)
            setReview(null)
          }}
          onConfirm={() => void confirm()}
          onNewQuote={() => void requote()}
          onOpenHistory={() => router.replace(withdrawRoutes.cashu.history)}
        />
      )}
    </ScrollView>
  )
}
