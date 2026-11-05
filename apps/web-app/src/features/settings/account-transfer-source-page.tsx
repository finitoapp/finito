import { useTimestamp } from "@dedalik/use-react"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { createDateDep } from "@payky/core/deps"
import {
  createTransferPayload,
  startTransferSource,
  type TransferSource,
  type TransferSourceState,
} from "@payky/core/integrations/nostr/nostr-account-transfer"
import { createNostrDep } from "@payky/core/integrations/nostr/nostr-client"
import { useRouter } from "@tanstack/react-router"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useAtomValue } from "jotai"
import {
  ArrowRightLeft,
  Check,
  KeyRound,
  LoaderCircle,
  QrCode,
  RotateCcw,
  TriangleAlert,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Fragment, useEffect, useId, useRef, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
} from "@/components/reui/stepper.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp.tsx"
import { appEnv } from "@/core/app-env.ts"
import { useAccess } from "@/hooks/use-access.ts"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatCountdown } from "@/lib/format-utils.ts"

type FailureReason = Extract<TransferSourceState, { phase: "failed" }>["reason"]

const failureKeys = {
  conflict: "accountTransfer.source.failed.conflict",
  codeMismatch: "accountTransfer.source.failed.codeMismatch",
  timeout: "accountTransfer.source.failed.timeout",
  cancelled: "accountTransfer.source.failed.cancelled",
  network: "accountTransfer.source.failed.network",
} satisfies Record<FailureReason, TranslationKey>

const stepByPhase = {
  waiting: 1,
  expired: 1,
  locked: 2,
  sending: 3,
  done: 3,
  failed: 0,
} satisfies Record<TransferSourceState["phase"], number>

const introSteps = [
  { icon: QrCode, label: "accountTransfer.source.step.scan" },
  { icon: KeyRound, label: "accountTransfer.source.step.code" },
  { icon: ArrowRightLeft, label: "accountTransfer.source.step.transfer" },
] as const satisfies ReadonlyArray<{
  readonly icon: typeof QrCode
  readonly label: TranslationKey
}>

const TRANSFER_CODE_LENGTH = 6

/**
 * The source half of account/0001, S1–S4: the device with the account shows
 * a QR, takes the code from the device that scanned it, and sends the
 * account. The QR stays up beside the code input until it is confirmed, so
 * the user's own phone can still turn a raced session into a conflict.
 */
export function AccountTransferSourcePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const account = useAtomValue(accountAtom)
  // A new device holds no permissions (access/0004); the owner sets them in
  // Settings → Access, the page this one is reached from.
  const { enabled: accessControlOn } = useAccess()
  const [state, setState] = useState<TransferSourceState | null>(null)
  const [code, setCode] = useState("")
  const sessionRef = useRef<TransferSource | null>(null)
  const codeInputId = useId()
  const codeInputRef = useRef<HTMLInputElement>(null)
  const active =
    state?.phase === "waiting" ||
    state?.phase === "locked" ||
    state?.phase === "sending"
  const now = useTimestamp({ interval: 1000 })
  useScreenWakeLock(active)

  // Leaving the page ends the session; a locked device is told it was
  // cancelled.
  useEffect(() => () => sessionRef.current?.cancel(), [])

  const start = () => {
    sessionRef.current?.cancel()
    setCode("")
    const payload = createTransferPayload(account)
    sessionRef.current = startTransferSource(
      { ...createNostrDep(appEnv.VITE_PAYKY_NOSTR_RELAYS), ...createDateDep() },
      { payload, onState: setState }
    )
  }

  // Back, like the header's arrow, so the page does not linger in history.
  const close = () => {
    router.history.back()
  }

  const qr = (uri: string, small: boolean) => (
    <div
      className={
        small
          ? "mx-auto size-40 rounded-xl bg-white p-3"
          : "mx-auto aspect-square w-full max-w-72 rounded-xl bg-white p-4"
      }
    >
      <QRCodeSVG
        value={uri}
        level="M"
        className="size-full"
        role="img"
        aria-label={t("accountTransfer.source.qr.label")}
      />
    </div>
  )

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("accountTransfer.source.title")} />
      <Card>
        {state !== null && stepByPhase[state.phase] > 0 ? (
          <CardHeader>
            <Stepper
              value={stepByPhase[state.phase]}
              orientation="horizontal"
              aria-hidden="true"
            >
              <StepperNav>
                {[1, 2, 3].map((step) => (
                  <StepperItem key={step} step={step}>
                    <StepperIndicator className="size-2 bg-muted-foreground/30 data-[state=active]:bg-primary data-[state=completed]:bg-primary" />
                    {step < 3 ? <StepperSeparator className="w-6" /> : null}
                  </StepperItem>
                ))}
              </StepperNav>
            </Stepper>
          </CardHeader>
        ) : null}

        <CardContent className="flex flex-col gap-4">
          {state === null ? (
            <>
              <ol className="flex flex-col gap-3">
                {introSteps.map(({ icon: Icon, label }, index) => (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                      {index + 1}
                    </span>
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    {t(label)}
                  </li>
                ))}
              </ol>
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>
                  {t("accountTransfer.source.warning.title")}
                </AlertTitle>
                <AlertDescription>
                  {t("accountTransfer.source.warning.description")}
                </AlertDescription>
              </Alert>
              {accessControlOn ? (
                <p className="text-sm text-muted-foreground">
                  {t("accountTransfer.source.permissions")}
                </p>
              ) : null}
            </>
          ) : null}

          {state?.phase === "waiting" ? (
            <>
              {qr(state.uri, false)}
              <p className="text-sm">
                {t("accountTransfer.source.qr.instructions")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("accountTransfer.source.qr.reassurance")}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("accountTransfer.source.qr.validFor", {
                  time: formatCountdown(state.expiresAt - now),
                })}
              </p>
            </>
          ) : null}

          {state?.phase === "locked" ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                sessionRef.current?.submitCode(code)
                // A mismatch starts the next attempt from an empty input.
                setCode("")
                codeInputRef.current?.focus()
              }}
            >
              {state.uri !== null ? qr(state.uri, true) : null}
              <Field data-invalid={state.mismatch}>
                <FieldLabel htmlFor={codeInputId}>
                  {t("accountTransfer.source.code.instructions")}
                </FieldLabel>
                {/* No auto-submit on the sixth digit: a typo would spend one
                    of three attempts. No one-time-code autofill either. */}
                <InputOTP
                  ref={codeInputRef}
                  id={codeInputId}
                  value={code}
                  maxLength={TRANSFER_CODE_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  aria-label={t("accountTransfer.source.code.label")}
                  containerClassName="justify-center gap-2"
                  onChange={setCode}
                >
                  {[
                    [0, 1, 2],
                    [3, 4, 5],
                  ].map((group, index) => (
                    <Fragment key={group.join()}>
                      {index > 0 ? <InputOTPSeparator /> : null}
                      <InputOTPGroup>
                        {group.map((slot) => (
                          <InputOTPSlot
                            key={slot}
                            index={slot}
                            aria-invalid={state.mismatch}
                            className="size-12 font-mono text-2xl"
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
                    : null}
                </FieldError>
              </Field>
              <Button
                type="submit"
                disabled={code.length !== TRANSFER_CODE_LENGTH}
              >
                <Check data-icon="inline-start" />
                {t("accountTransfer.source.code.confirm")}
              </Button>
            </form>
          ) : null}

          <div aria-live="polite" className="flex flex-col gap-3">
            {state?.phase === "waiting" ? (
              <p className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                {t("accountTransfer.source.qr.waiting")}
              </p>
            ) : null}
            {state?.phase === "locked" ? (
              <p className="text-sm font-medium">
                {t("accountTransfer.source.code.connected")}
              </p>
            ) : null}
            {state?.phase === "expired" ? (
              <p className="text-sm">
                {t("accountTransfer.source.qr.expired")}
              </p>
            ) : null}
            {state?.phase === "sending" ? (
              <p className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                {t("accountTransfer.source.sending")}
              </p>
            ) : null}
            {state?.phase === "done" ? (
              <Alert variant="success">
                <Check />
                <AlertTitle>
                  {t("accountTransfer.source.done.title")}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    state.acked
                      ? "accountTransfer.source.done.acked"
                      : "accountTransfer.source.done.sent"
                  )}
                  {accessControlOn
                    ? ` ${t("accountTransfer.source.permissions")}`
                    : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {state?.phase === "failed" ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>
                  {t("accountTransfer.source.failed.title")}
                </AlertTitle>
                <AlertDescription>
                  {t(failureKeys[state.reason])}{" "}
                  {t("accountTransfer.source.failed.nothingSent")}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-end gap-2">
          {state === null ? (
            <>
              <Button type="button" variant="outline" onClick={close}>
                {t("accountTransfer.cancel")}
              </Button>
              <Button type="button" onClick={start}>
                <QrCode data-icon="inline-start" />
                {t("accountTransfer.source.start")}
              </Button>
            </>
          ) : null}
          {state?.phase === "waiting" || state?.phase === "locked" ? (
            <Button type="button" variant="outline" onClick={close}>
              {t("accountTransfer.cancel")}
            </Button>
          ) : null}
          {state?.phase === "expired" ? (
            <Button type="button" onClick={start}>
              <RotateCcw data-icon="inline-start" />
              {t("accountTransfer.source.qr.renew")}
            </Button>
          ) : null}
          {state?.phase === "failed" ? (
            <>
              <Button type="button" variant="outline" onClick={close}>
                {t("accountTransfer.close")}
              </Button>
              <Button type="button" onClick={start}>
                <RotateCcw data-icon="inline-start" />
                {t("accountTransfer.source.startAgain")}
              </Button>
            </>
          ) : null}
          {state?.phase === "done" ? (
            <Button type="button" onClick={close}>
              {t("accountTransfer.done")}
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </>
  )
}
