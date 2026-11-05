import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createDateDep } from "@payky/core/deps"
import {
  formatTransferCode,
  startTransferTarget,
  type TransferPayload,
  type TransferTargetState,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import {
  type PaykyUriError,
  parsePairUri,
  type WrongPaykyUriTypeError,
} from "@payky/core/modules/shared/payky-uri"
import { useAtomValue } from "jotai"
import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { evoluCounterAtom } from "../../atoms/evolu-counter.ts"
import {
  QR_SCAN_TYPES,
  ScanCodeScanner,
} from "../../components/scan-code-scanner.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button } from "../../components/ui/button.tsx"
import { nativeEnv } from "../../core/native-env.ts"
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useAddTransferredAccount } from "./use-add-transferred-account.ts"

const scanErrorKeys = {
  NotPaykyUri: "accountTransfer.target.error.NotPaykyUri",
  UnknownPaykyUriType: "accountTransfer.target.error.UnknownPaykyUriType",
  UnsupportedPaykyUriVersion:
    "accountTransfer.target.error.UnsupportedPaykyUriVersion",
  InvalidPaykyUri: "accountTransfer.target.error.InvalidPaykyUri",
  WrongPaykyUriType: "accountTransfer.target.error.WrongPaykyUriType",
} satisfies Record<
  (PaykyUriError | WrongPaykyUriTypeError)["type"],
  TranslationKey
>

type FailureReason = Extract<TransferTargetState, { phase: "failed" }>["reason"]

const failureKeys = {
  cancelled: "accountTransfer.target.failed.cancelled",
  conflict: "accountTransfer.target.failed.conflict",
  codeMismatch: "accountTransfer.target.failed.codeMismatch",
  timeout: "accountTransfer.target.failed.timeout",
  network: "accountTransfer.target.failed.network",
  invalid: "accountTransfer.target.failed.invalid",
} satisfies Record<FailureReason, TranslationKey>

type View =
  | { readonly phase: "scan"; readonly error: TranslationKey | null }
  | { readonly phase: "adding" }
  | Exclude<TransferTargetState, { phase: "received" }>

/**
 * The new device's half of account/0001: scans the source's QR, shows the
 * code once the source has locked onto this device, and adds the account it
 * receives. Used by the onboarding step and the settings route. The scanned
 * text is untrusted: only `parsePairUri` lets it start a session, and the
 * session is cancelled on leaving, on cancel and on an account switch.
 */
export function AccountTransferTarget({
  source,
  confirmBeforeAdding,
  onRestoreWithPhrase,
}: {
  readonly source: "onboarding" | "settings"
  /** A device that already has an account confirms before adding another. */
  readonly confirmBeforeAdding: boolean
  /** Offers the recovery phrase instead, for when no source device is at hand. */
  readonly onRestoreWithPhrase?: () => void
}) {
  const { t } = useTranslation()
  const accountVersion = useAtomValue(evoluCounterAtom)
  const addTransferredAccount = useAddTransferredAccount({
    source,
    confirmBeforeAdding,
  })
  const [view, setView] = useState<View>({ phase: "scan", error: null })
  useScreenWakeLock(view.phase === "connecting" || view.phase === "code")
  const cancelRef = useRef<(() => void) | null>(null)
  const theme = useTheme()

  // Leaving the screen or switching account mid-session tells the source it
  // was cancelled.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts on account switch only
  useEffect(() => () => cancelRef.current?.(), [accountVersion])

  const addAccount = async (payload: TransferPayload) => {
    if (!(await addTransferredAccount(payload))) {
      setView({ phase: "scan", error: null })
    }
  }

  const onScan = (text: string) => {
    if (view.phase !== "scan") return
    const pair = parsePairUri(text.trim())
    if (!pair.ok) {
      setView({ phase: "scan", error: scanErrorKeys[pair.error.type] })
      return
    }
    setView({ phase: "connecting" })
    const session = startTransferTarget(
      {
        ...createNostrDep(nativeEnv.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS),
        ...createDateDep(),
      },
      {
        pair: pair.value,
        onState: (state) => {
          if (state.phase === "received") {
            cancelRef.current = null
            setView({ phase: "adding" })
            void addAccount(state.payload)
            return
          }
          if (state.phase === "failed") cancelRef.current = null
          setView(state)
        },
      }
    )
    cancelRef.current = session.cancel
  }

  const cancelSession = () => {
    cancelRef.current?.()
    cancelRef.current = null
    setView({ phase: "scan", error: null })
  }

  return (
    <YStack gap="4">
      {view.phase === "scan" ? (
        <>
          <Text color="muted-foreground">
            {t("accountTransfer.target.instructions")}
          </Text>
          <ScanCodeScanner types={QR_SCAN_TYPES} onScan={onScan} />
          {view.error !== null ? (
            <Text color="destructive" role="alert">
              {t(view.error)}
            </Text>
          ) : null}
          <Alert variant="warning" icon={TriangleAlert}>
            <AlertTitle>{t("accountTransfer.target.warning.title")}</AlertTitle>
            <AlertDescription>
              {t("accountTransfer.target.warning.description")}
            </AlertDescription>
          </Alert>
          {onRestoreWithPhrase === undefined ? null : (
            <Button
              variant="ghost"
              w="100%"
              h="auto"
              aria-label={t("accountTransfer.target.fallback")}
              onPress={onRestoreWithPhrase}
            >
              <Text
                flexShrink={1}
                text="center"
                fontSize="sm"
                lineHeight="sm"
                fontWeight="700"
                color="primary"
              >
                {t("accountTransfer.target.fallback")}
              </Text>
            </Button>
          )}
        </>
      ) : null}

      {view.phase === "connecting" || view.phase === "adding" ? (
        <XStack items="center" gap="2" aria-live="polite">
          <ActivityIndicator size="small" color={theme.primary.val} />
          <Text>{t("accountTransfer.target.connecting")}</Text>
        </XStack>
      ) : null}

      {view.phase === "code" ? (
        <YStack gap="3" aria-live="polite">
          <Text>{t("accountTransfer.target.code.instructions")}</Text>
          <Text
            fontSize="5xl"
            lineHeight="5xl"
            fontWeight="600"
            letterSpacing={4.8}
            text="center"
            // Read digit by digit, not as one number.
            aria-label={view.code.split("").join(" ")}
          >
            {formatTransferCode(view.code)}
          </Text>
          <Text color="muted-foreground">
            {t("accountTransfer.target.code.warning")}
          </Text>
          <XStack items="center" gap="2">
            <ActivityIndicator
              size="small"
              color={theme["muted-foreground"].val}
            />
            <Text color="muted-foreground">
              {t("accountTransfer.target.code.waiting")}
            </Text>
          </XStack>
        </YStack>
      ) : null}

      {view.phase === "failed" ? (
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertTitle>{t("accountTransfer.target.failed.title")}</AlertTitle>
          <AlertDescription>{t(failureKeys[view.reason])}</AlertDescription>
        </Alert>
      ) : null}

      {view.phase === "connecting" || view.phase === "code" ? (
        <Button
          label={t("accountTransfer.cancel")}
          variant="outline"
          self="flex-start"
          onPress={cancelSession}
        />
      ) : null}

      {view.phase === "failed" ? (
        <Button
          label={t("accountTransfer.target.scanAgain")}
          iconStart={RotateCcw}
          self="flex-start"
          onPress={() => setView({ phase: "scan", error: null })}
        />
      ) : null}
    </YStack>
  )
}
