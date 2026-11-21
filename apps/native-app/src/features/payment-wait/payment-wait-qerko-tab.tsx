import {
  describeQerkoPaymentError,
  isQerkoKeyRejected,
  isQerkoStepCancellable,
  qerkoStepKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import { qerkoTerminalSelectionQuery } from "@payky/core/evolu/device-qerko"
import type { QerkoPaymentFailureReason } from "@payky/core/integrations/qerko/qerko-client"
import type { AccountId } from "@payky/core/modules/account/account-types"
import {
  cancelQerkoTerminalPayment,
  type QerkoTerminalPaymentProgress,
  startQerkoTerminalPayment,
  syncQerkoTerminalPayment,
} from "@payky/core/modules/payment/payment-qerko-actions"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import Nfc from "lucide-react-native/icons/nfc"
import { useRef, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { Button } from "../../components/ui/button.tsx"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useDeviceEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

type Outcome =
  | {
      readonly kind: "progress"
      readonly progress: QerkoTerminalPaymentProgress
    }
  | {
      readonly kind: "error"
      readonly error: { readonly type: string; readonly reason?: string }
    }

/**
 * Taking the payment on the Qerko terminal this device chose, as web's
 * `QerkoPaymentTab`. The attempt lives in the payment's own row, so this tab
 * only draws what is there and polls while one is pending; the background job
 * settles it too, which is why closing this screen mid-payment loses nothing.
 */
export function QerkoPaymentTab({
  paymentId,
  accountId,
  payable,
  pendingTransactionId,
  unresolvedTransactionId,
  failureReason,
}: {
  readonly paymentId: PaymentId
  readonly accountId: AccountId | null | undefined
  /** The payment is still waiting for money. */
  readonly payable: boolean
  readonly pendingTransactionId: string | null | undefined
  readonly unresolvedTransactionId: string | null | undefined
  /** Why the last attempt ended without money, when it did. */
  readonly failureReason: QerkoPaymentFailureReason | null | undefined
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const confirm = useConfirm()
  const toast = useToast()
  const queryClient = useQueryClient()
  const account = useAtomValue(accountAtom)
  const selection = useDeviceEvoluQuery(qerkoTerminalSelectionQuery(account.id))
    .data[0]
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  // Two taps can land before React re-renders `starting`.
  const startingRef = useRef(false)
  const [startErrorKey, setStartErrorKey] = useState<ReturnType<
    typeof describeQerkoPaymentError
  > | null>(null)
  // The method is prepared when its tab opens; until then there is no
  // account to start the payment with.
  const prepared = accountId !== null && accountId !== undefined
  const pending =
    pendingTransactionId !== null && pendingTransactionId !== undefined
  const unresolved =
    unresolvedTransactionId !== null && unresolvedTransactionId !== undefined
  const pollKey = ["qerko", "payment-sync", paymentId]

  // One poll a second while the attempt is pending and this screen is open.
  const poll = useQuery({
    queryKey: pollKey,
    enabled: pending,
    refetchInterval: 1000,
    queryFn: async (): Promise<Outcome> => {
      await using run = appRun()
      const result = await run(
        syncQerkoTerminalPayment({ paymentId, deviceId: account.device.id })
      )
      return result.ok
        ? { kind: "progress", progress: result.value }
        : { kind: "error", error: result.error }
    },
  })

  const start = async () => {
    if (accountId === null || accountId === undefined) return
    if (selection === undefined) return
    if (startingRef.current) return
    startingRef.current = true
    try {
      if (unresolved) {
        const confirmed = await confirm({
          title: t("paymentWait.qerko.retryUnresolved.title"),
          description: t("paymentWait.qerko.retryUnresolved.description"),
          confirmLabel: t("paymentWait.qerko.retryUnresolved.confirm"),
          cancelLabel: t("paymentWait.qerko.retryUnresolved.cancel"),
          variant: "destructive",
        })
        if (!confirmed) return
      }

      setStartErrorKey(null)
      queryClient.removeQueries({ queryKey: pollKey })
      setStarting(true)
      await using run = appRun()
      const result = await run(
        startQerkoTerminalPayment({
          paymentId,
          accountId,
          terminalId: selection.terminalId,
          terminalTid: selection.terminalTid,
          deviceId: account.device.id,
          retryUnresolved: unresolved,
        })
      )
      if (!result.ok) setStartErrorKey(describeQerkoPaymentError(result.error))
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  const cancel = async () => {
    setCancelling(true)
    try {
      await using run = appRun()
      const result = await run(cancelQerkoTerminalPayment(paymentId))
      if (!result.ok) {
        toast.error(t(describeQerkoPaymentError(result.error)))
      } else if (result.value === "notCancellable") {
        toast.error(t("paymentWait.qerko.cancel.notCancellable"))
      }
    } finally {
      setCancelling(false)
    }
  }

  const outcome = poll.data
  const step =
    outcome?.kind === "progress" && outcome.progress.status === "pending"
      ? outcome.progress.step
      : "connecting"
  // The last attempt's failure is on the payment's row, not in this poll's
  // answer: the background job may have been the one to read it.
  const failureKey =
    failureReason === null || failureReason === undefined
      ? null
      : describeQerkoPaymentError({
          type: "QerkoTerminalPaymentFailed",
          reason: failureReason,
        })
  // A refused key shows even while an attempt is pending: nothing else will
  // ever move that attempt along.
  const rejectedKey =
    outcome?.kind === "error" && isQerkoKeyRejected(outcome.error)
      ? describeQerkoPaymentError(outcome.error)
      : null
  const errorKey = startErrorKey ?? rejectedKey ?? failureKey
  const settingsLink =
    errorKey === "paymentWait.qerko.error.keyRejected" ? (
      <Button
        variant="link"
        label={t("paymentWait.qerko.error.keyRejected.link")}
        onPress={() => {
          router.push("/settings/payment-accounts/qerko-terminal")
        }}
      />
    ) : null

  if (selection === undefined) {
    return (
      <YStack w="100%" gap={8} items="center" py={16}>
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
          text="center"
        >
          {t("paymentWait.qerko.noTerminal")}
        </Text>
        <Button
          variant="link"
          label={t("paymentWait.qerko.noTerminal.link")}
          onPress={() => {
            router.push("/settings/payment-accounts/qerko-terminal")
          }}
        />
      </YStack>
    )
  }

  if (pending) {
    return (
      <YStack w="100%" gap={12} items="center" py={16}>
        <XStack items="center" gap={8} aria-live="polite">
          <ActivityIndicator />
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
          >
            {t(qerkoStepKeys[step])}
          </Text>
        </XStack>
        {isQerkoStepCancellable(step) ? (
          <Button
            variant="outline"
            label={t("paymentWait.qerko.cancel")}
            pending={cancelling}
            onPress={() => {
              void cancel()
            }}
          />
        ) : null}
        {rejectedKey === null ? null : (
          <Text
            maxW={288}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
            text="center"
            role="alert"
          >
            {t(rejectedKey)}
          </Text>
        )}
        {settingsLink}
      </YStack>
    )
  }

  return (
    <YStack w="100%" gap={8} items="center" py={16}>
      <Button
        size="lg"
        h={56}
        px={32}
        iconStart={Nfc}
        label={t(
          unresolved ? "paymentWait.qerko.retry" : "paymentWait.qerko.action"
        )}
        pending={starting}
        disabled={!payable || !prepared}
        onPress={() => {
          void start()
        }}
      />
      {unresolved ? (
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color="destructive"
          text="center"
          role="alert"
        >
          {t("paymentWait.qerko.unresolved")}
        </Text>
      ) : errorKey !== null ? (
        <Text
          maxW={288}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color="destructive"
          text="center"
          role="alert"
        >
          {t(errorKey)}
        </Text>
      ) : null}
      {unresolved ? null : settingsLink}
    </YStack>
  )
}
