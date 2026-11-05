import { formatCountdown } from "@payky/app-shared/format-text"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createDateDep } from "@payky/core/deps"
import {
  createTransferPayload,
  startTransferSource,
  type TransferSource,
  type TransferSourceState,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { router } from "expo-router"
import { useAtomValue, useStore } from "jotai"
import ArrowRightLeft from "lucide-react-native/icons/arrow-right-left"
import Check from "lucide-react-native/icons/check"
import KeyRound from "lucide-react-native/icons/key-round"
import QrCodeIcon from "lucide-react-native/icons/qr-code"
import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Fragment, useEffect, useRef, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { evoluCounterAtom } from "../../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { QrCode } from "../../../components/qr-code.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../../../components/ui/input-otp.tsx"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
} from "../../../components/ui/stepper.tsx"
import { nativeEnv } from "../../../core/native-env.ts"
import { useAccess, useRequirePermission } from "../../../core/use-access.ts"
import { useScreenWakeLock } from "../../../hooks/use-screen-wake-lock.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

type FailureReason = Extract<TransferSourceState, { phase: "failed" }>["reason"]

const failureKeys = {
  conflict: "accountTransfer.source.failed.conflict",
  codeMismatch: "accountTransfer.source.failed.codeMismatch",
  timeout: "accountTransfer.source.failed.timeout",
  cancelled: "accountTransfer.source.failed.cancelled",
  network: "accountTransfer.source.failed.network",
} satisfies Record<FailureReason, TranslationKey>

const TRANSFER_CODE_LENGTH = 6

const stepByPhase = {
  waiting: 1,
  expired: 1,
  locked: 2,
  sending: 3,
  done: 3,
  failed: 0,
} satisfies Record<TransferSourceState["phase"], number>
const codeGroups = [
  [0, 1, 2],
  [3, 4, 5],
] as const
const introSteps = [
  { label: "accountTransfer.source.step.scan", icon: QrCodeIcon },
  { label: "accountTransfer.source.step.code", icon: KeyRound },
  { label: "accountTransfer.source.step.transfer", icon: ArrowRightLeft },
] as const satisfies ReadonlyArray<{
  readonly label: TranslationKey
  readonly icon: typeof QrCodeIcon
}>

/**
 * The source half of account/0001: the device with the account shows a QR,
 * takes the code from the device that scanned it, and sends the account. The
 * QR stays up beside the code input until it is confirmed, so the owner's own
 * phone can still turn a raced session into a conflict. The session ends on
 * leaving the screen and on an account switch.
 */
export function AccountTransferSourcePage() {
  const { t } = useTranslation()
  const account = useAtomValue(accountAtom)
  const accountVersion = useAtomValue(evoluCounterAtom)
  const { enabled: accessControlOn } = useAccess()
  const { require } = useRequirePermission()
  const [state, setState] = useState<TransferSourceState | null>(null)
  const [code, setCode] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const sessionRef = useRef<TransferSource | null>(null)
  const store = useStore()

  // biome-ignore lint/correctness/useExhaustiveDependencies: a switched account must not keep a session for the old one
  useEffect(
    () => () => {
      sessionRef.current?.cancel()
      sessionRef.current = null
      setState(null)
    },
    [accountVersion]
  )

  const counting = state?.phase === "waiting" || state?.phase === "locked"
  useScreenWakeLock(counting || state?.phase === "sending")
  useEffect(() => {
    if (!counting) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [counting])

  const start = async () => {
    if (!(await require("admin", "accountTransfer.source.start"))) return
    // Left or switched account while the PIN prompt was open.
    if (store.get(evoluCounterAtom) !== accountVersion) return
    sessionRef.current?.cancel()
    setCode("")
    setNow(Date.now())
    const payload = createTransferPayload(account)
    sessionRef.current = startTransferSource(
      {
        ...createNostrDep(nativeEnv.EXPO_PUBLIC_PAYKY_NOSTR_RELAYS),
        ...createDateDep(),
      },
      { payload, onState: setState }
    )
  }

  const close = () => {
    router.back()
  }

  const qr = (uri: string, size: number) => (
    <YStack items="center" aria-label={t("accountTransfer.source.qr.label")}>
      <QrCode value={uri} size={size} />
    </YStack>
  )

  return (
    <Screen>
      <FadeHeader title={t("accountTransfer.source.title")} />
      <Card>
        {state !== null && stepByPhase[state.phase] > 0 ? (
          <CardHeader>
            <Stepper value={stepByPhase[state.phase]}>
              <StepperNav>
                {[1, 2, 3].map((step) => (
                  <StepperItem key={step} step={step} last={step === 3}>
                    <StepperIndicator
                      size={8}
                      inactiveColor="muted-foreground-30"
                    />
                    {step < 3 ? <StepperSeparator /> : null}
                  </StepperItem>
                ))}
              </StepperNav>
            </Stepper>
          </CardHeader>
        ) : null}

        <CardContent gap={16}>
          {state === null ? (
            <YStack gap="3">
              {introSteps.map(({ label, icon }, index) => (
                <XStack key={label} items="center" gap="3">
                  <YStack
                    w={32}
                    h={32}
                    shrink={0}
                    items="center"
                    justify="center"
                    rounded="full"
                    bg="muted"
                  >
                    <Text fontWeight="600">{index + 1}</Text>
                  </YStack>
                  <Icon icon={icon} color="muted-foreground" />
                  <Text flex={1} fontSize="sm" lineHeight="sm">
                    {t(label)}
                  </Text>
                </XStack>
              ))}
              <Alert variant="warning" icon={TriangleAlert}>
                <AlertTitle>
                  {t("accountTransfer.source.warning.title")}
                </AlertTitle>
                <AlertDescription>
                  {t("accountTransfer.source.warning.description")}
                </AlertDescription>
              </Alert>
              {accessControlOn ? (
                <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
                  {t("accountTransfer.source.permissions")}
                </Text>
              ) : null}
            </YStack>
          ) : null}

          {state?.phase === "waiting" ? (
            <YStack gap="3" aria-live="polite">
              {qr(state.uri, 260)}
              <Text>{t("accountTransfer.source.qr.instructions")}</Text>
              <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
                {t("accountTransfer.source.qr.reassurance")}
              </Text>
              <Text color="muted-foreground">
                {t("accountTransfer.source.qr.validFor", {
                  time: formatCountdown(state.expiresAt - now),
                })}
              </Text>
              <Text>{t("accountTransfer.source.qr.waiting")}</Text>
            </YStack>
          ) : null}

          {state?.phase === "locked" ? (
            <YStack gap="3" aria-live="polite">
              {state.uri !== null ? qr(state.uri, 160) : null}
              <Text fontWeight="600">
                {t("accountTransfer.source.code.connected")}
              </Text>
              <Field>
                <FieldLabel>
                  {t("accountTransfer.source.code.instructions")}
                </FieldLabel>
                {/* No auto-submit on the sixth digit: a typo would spend one of
                three attempts. No one-time-code autofill either. */}
                <InputOTP
                  value={code}
                  maxLength={TRANSFER_CODE_LENGTH}
                  autoFocus
                  aria-label={t("accountTransfer.source.code.label")}
                  onChange={(next) => setCode(next.replace(/\D/gu, ""))}
                >
                  {codeGroups.map((group, index) => (
                    <Fragment key={group.join()}>
                      {index > 0 ? <InputOTPSeparator /> : null}
                      <InputOTPGroup>
                        {group.map((slot, position) => (
                          <InputOTPSlot
                            key={slot}
                            index={slot}
                            first={position === 0}
                            last={position === group.length - 1}
                            invalid={state.mismatch}
                            size="lg"
                          />
                        ))}
                      </InputOTPGroup>
                    </Fragment>
                  ))}
                </InputOTP>
                <FieldDescription>
                  {t("accountTransfer.source.code.warning")}
                </FieldDescription>
                <FieldError>
                  {state.mismatch
                    ? t("accountTransfer.source.code.mismatch", {
                        count: state.attemptsLeft,
                      })
                    : undefined}
                </FieldError>
              </Field>
              <Button
                iconStart={Check}
                label={t("accountTransfer.source.code.confirm")}
                disabled={code.length !== TRANSFER_CODE_LENGTH}
                onPress={() => {
                  sessionRef.current?.submitCode(code)
                  // A mismatch starts the next attempt from an empty input.
                  setCode("")
                }}
              />
            </YStack>
          ) : null}

          {state?.phase === "expired" ? (
            <Text aria-live="polite">
              {t("accountTransfer.source.qr.expired")}
            </Text>
          ) : null}

          {state?.phase === "sending" ? (
            <Text aria-live="polite">
              {t("accountTransfer.source.sending")}
            </Text>
          ) : null}

          {state?.phase === "done" ? (
            <Alert variant="success" icon={Check}>
              <AlertTitle>{t("accountTransfer.source.done.title")}</AlertTitle>
              <AlertDescription>
                {t(
                  state.acked
                    ? "accountTransfer.source.done.acked"
                    : "accountTransfer.source.done.sent"
                )}
                {accessControlOn
                  ? ` ${t("accountTransfer.source.permissions")}`
                  : ""}
              </AlertDescription>
            </Alert>
          ) : null}

          {state?.phase === "failed" ? (
            <Alert variant="destructive" icon={TriangleAlert}>
              <AlertTitle>
                {t("accountTransfer.source.failed.title")}
              </AlertTitle>
              <AlertDescription>
                {`${t(failureKeys[state.reason])} ${t("accountTransfer.source.failed.nothingSent")}`}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter justify="flex-end" flexWrap="wrap" gap={8}>
          {state === null ? (
            <>
              <Button
                label={t("accountTransfer.cancel")}
                variant="outline"
                onPress={close}
              />
              <Button
                iconStart={QrCodeIcon}
                label={t("accountTransfer.source.start")}
                onPress={() => {
                  void start()
                }}
              />
            </>
          ) : null}
          {state?.phase === "waiting" || state?.phase === "locked" ? (
            <Button
              label={t("accountTransfer.cancel")}
              variant="outline"
              onPress={close}
            />
          ) : null}
          {state?.phase === "expired" ? (
            <Button
              iconStart={RotateCcw}
              label={t("accountTransfer.source.qr.renew")}
              onPress={() => {
                void start()
              }}
            />
          ) : null}
          {state?.phase === "failed" ? (
            <>
              <Button
                label={t("accountTransfer.close")}
                variant="outline"
                onPress={close}
              />
              <Button
                iconStart={RotateCcw}
                label={t("accountTransfer.source.startAgain")}
                onPress={() => {
                  void start()
                }}
              />
            </>
          ) : null}
          {state?.phase === "done" ? (
            <Button label={t("accountTransfer.done")} onPress={close} />
          ) : null}
        </CardFooter>
      </Card>
    </Screen>
  )
}
