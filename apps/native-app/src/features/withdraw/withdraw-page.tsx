import {
  confirmOutcome,
  createWithdrawDraft,
  draftComment,
  initialWithdrawState,
  quoteErrorMessage,
  type WithdrawReviewState,
  withdrawPinDetail,
  withdrawReducer,
} from "@payky/app-shared/withdraw-flow"
import type { AccountId } from "@payky/core/modules/account/account-types"
import {
  executeWithdrawal,
  quoteWithdrawal,
} from "@payky/core/modules/withdraw/withdraw-actions"
import { router, useLocalSearchParams } from "expo-router"
import { useStore } from "jotai"
import { Suspense, useEffect, useReducer, useRef, useState } from "react"
import { ScrollView } from "react-native"
import { useTheme } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../components/fade-header.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { useAccess, useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { useSparkBalance } from "../shared/use-spark-balance.ts"
import { useSparkAccountId } from "./use-withdraw-data.ts"
import { WithdrawFormStep } from "./withdraw-form-step.tsx"
import { WithdrawNoAccountCard } from "./withdraw-no-account-card.tsx"
import { WithdrawReviewStep } from "./withdraw-review-step.tsx"

/** `/withdraw/new`: form, then review, then the send. Moves money. */
export function WithdrawPage() {
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
      <FadeHeader title={t("withdraw.form.title")} />
      <Suspense fallback={<LoadingView />}>
        <WithdrawAccount />
      </Suspense>
    </SafeAreaView>
  )
}

function WithdrawAccount() {
  const { destination } = useLocalSearchParams<{ destination?: string }>()
  const accountId = useSparkAccountId()
  if (accountId === undefined) {
    return <WithdrawNoAccountCard method="spark" />
  }
  return (
    <WithdrawFlow
      accountId={accountId}
      initialDestination={destination ?? ""}
    />
  )
}

function WithdrawFlow({
  accountId,
  initialDestination,
}: {
  readonly accountId: AccountId
  readonly initialDestination: string
}) {
  const appRun = useAppRun()
  const access = useAccess()
  const { require, requirePin } = useRequirePermission()
  const jotaiStore = useStore()
  const { t } = useTranslation()
  const locale = useLocale()
  const [state, dispatch] = useReducer(withdrawReducer, initialWithdrawState)
  const [requoting, setRequoting] = useState(false)
  // A send may or may not have happened: nothing is confirmed again from this
  // review until the merchant has gone back (withdraw/0007).
  const [uncertain, setUncertain] = useState(false)
  const [draft, setDraft] = useState(() =>
    createWithdrawDraft(initialDestination)
  )

  const availableSats = useSparkBalance(accountId)
  // `state.confirming` lags a render behind: a second press before it lands
  // must not send the same quote twice.
  const confirmingRef = useRef(false)
  // A requote in flight: confirming then could send a quote about to be replaced.
  const requotingRef = useRef(false)
  // The account the review was quoted on: a review never outlives a switch.
  const reviewAccountVersionRef = useRef(0)
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

  const confirmWithdrawal = async () => {
    if (
      state.step !== "review" ||
      confirmingRef.current ||
      requotingRef.current
    )
      return
    confirmingRef.current = true
    // Stays locked after a send was started: only a retryable end unlocks.
    let retryable = true
    try {
      retryable = await confirmReviewedWithdrawal(state)
    } finally {
      if (retryable) confirmingRef.current = false
    }
  }

  /** `true` when nothing was sent and the review may be confirmed again. */
  const confirmReviewedWithdrawal = async (
    review: WithdrawReviewState
  ): Promise<boolean> => {
    const accountVersion = reviewAccountVersionRef.current
    const isCurrentAccount = () =>
      jotaiStore.get(evoluCounterAtom) === accountVersion
    // Quoted on another account: drop the review, send nothing.
    if (!isCurrentAccount()) {
      dispatch({ type: "BACK" })
      return true
    }
    const markUncertain = () => {
      setUncertain(true)
      dispatch({
        type: "CONFIRM_FAILED",
        error: t("withdraw.review.error.uncertain"),
      })
      return false
    }

    dispatch({ type: "CONFIRM_STARTED" })

    // Moving money always asks for the PIN, session or not (access/0007).
    // With access control off there is no PIN, and `require` lets it through.
    const pinDetail = withdrawPinDetail({
      quote: review.quote,
      exitSpeed: review.exitSpeed,
      t,
      locale,
    })
    const allowed = accessEnabledRef.current
      ? await requirePin("access.action.withdraw", pinDetail)
      : await require("admin", "access.action.withdraw")
    // The screen was left or the account switched while the PIN was asked
    // for: the approval was for that screen, so nothing is sent.
    if (!allowed || !mountedRef.current || !isCurrentAccount()) {
      if (mountedRef.current) dispatch({ type: "CONFIRM_FINISHED" })
      return true
    }

    try {
      const { device } = await jotaiStore.get(accountAtom)
      if (!isCurrentAccount()) {
        dispatch({ type: "CONFIRM_FINISHED" })
        return true
      }
      await using run = appRun()
      const result = await run(
        executeWithdrawal({
          accountId,
          quote: review.quote,
          exitSpeed: review.exitSpeed,
          deviceId: device.id,
          comment: draftComment(draft),
        })
      )
      const outcome = confirmOutcome(result, t)
      if (outcome.kind === "recorded") {
        // Recorded: its detail follows what happens next, from the stored row.
        if (mountedRef.current && isCurrentAccount()) {
          router.replace({
            pathname: "/withdraw/[withdrawalId]",
            params: { withdrawalId: outcome.withdrawalId },
          })
        }
        return false
      }
      dispatch({ type: "CONFIRM_FAILED", error: outcome.message })
      return true
    } catch {
      // Thrown after the money may have moved is indistinguishable from
      // thrown before it: never offer a retry.
      return markUncertain()
    }
  }

  const requote = async () => {
    if (state.step !== "review" || confirmingRef.current) return
    requotingRef.current = true
    setRequoting(true)
    try {
      await using run = appRun()
      const result = await run(quoteWithdrawal({ accountId, ...state.request }))
      if (result.ok && !confirmingRef.current) {
        dispatch({ type: "REQUOTED", quote: result.value })
      } else if (!result.ok) {
        dispatch({
          type: "CONFIRM_FAILED",
          error: quoteErrorMessage(result.error, t),
        })
      }
    } catch {
      dispatch({
        type: "CONFIRM_FAILED",
        error: t("withdraw.quoteError.generic"),
      })
    } finally {
      requotingRef.current = false
      setRequoting(false)
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
    >
      {state.step === "form" ? (
        <WithdrawFormStep
          accountId={accountId}
          availableSats={availableSats}
          draft={draft}
          onDraftChange={setDraft}
          onReview={(request, quote) => {
            reviewAccountVersionRef.current = jotaiStore.get(evoluCounterAtom)
            dispatch({ type: "OPEN_REVIEW", request, quote })
          }}
        />
      ) : (
        <WithdrawReviewStep
          quote={state.quote}
          recipientComment={
            state.quote.kind === "lightning"
              ? state.quote.recipientComment
              : null
          }
          comment={draftComment(draft)}
          exitSpeed={state.exitSpeed}
          confirming={state.confirming}
          requoting={requoting}
          confirmError={state.confirmError}
          uncertain={uncertain}
          onExitSpeedChange={(exitSpeed) =>
            dispatch({ type: "SET_EXIT_SPEED", exitSpeed })
          }
          onBack={() => {
            // Back in the same frame as Confirm must not reset the guard
            // while the PIN prompt is open.
            if (confirmingRef.current && !uncertain) return
            setUncertain(false)
            confirmingRef.current = false
            dispatch({ type: "BACK" })
          }}
          onConfirm={() => void confirmWithdrawal()}
          onNewQuote={() => void requote()}
          onOpenHistory={() => router.replace("/withdraw")}
        />
      )}
    </ScrollView>
  )
}
