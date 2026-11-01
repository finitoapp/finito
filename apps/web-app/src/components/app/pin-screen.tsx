import { pinPadAttribute } from "@payky/app-shared/error-scrubbing"
import {
  resources,
  type TranslationKey,
} from "@payky/app-shared/i18n/resources"
import {
  type PinAttemptRow,
  pinAttemptBaseQuery,
  pinAttemptsQuery,
} from "@payky/core/evolu/device-pin-attempts"
import {
  clearPinAttemptLog,
  enterPin,
  enterRecoveryPhrase,
} from "@payky/core/modules/access/access-actions"
import {
  maxFailedPinAttempts,
  type Permission,
} from "@payky/core/modules/access/access-types"
import { Link } from "@tanstack/react-router"
import { DeleteIcon, KeyRound, LockKeyhole, ShieldAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { PasswordTextarea } from "@/components/password-textarea.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { useAccess } from "@/hooks/use-access.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { permissionLabelKeys } from "@/i18n/access-labels.ts"
import { formatDateTime } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

export type UnlockedVia = "pin" | "phrase"

interface PinScreenProps {
  /** The permission the screen or action needs; `null` when it always asks. */
  readonly permission: Permission | null
  /** The action of a one-shot prompt, named in the heading. */
  readonly action?: TranslationKey | undefined
  /** What a wrong attempt is logged against: a route path or an action key. */
  readonly target: string
  readonly onUnlocked: (via: UnlockedVia) => void
  /** Offered by the one-shot prompt; the action is then not performed. */
  readonly onCancel?: (() => void) | undefined
}

type View =
  | { readonly kind: "pin"; readonly attemptsLeft: number | null }
  | { readonly kind: "phrase"; readonly wrong: boolean }
  | {
      readonly kind: "attempts"
      readonly via: UnlockedVia
      readonly attempts: ReadonlyArray<PinAttemptRow>
    }

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const
const maxPinLength = 8

/**
 * The PIN screen of a locked route, of the one-shot prompt and of a device
 * without `sell` alike (access/0001): it says why it is there and what to do
 * without the PIN, offers the recovery phrase, and after a correct PIN or
 * phrase shows the failed attempts before they are cleared (access/0006).
 */
export function PinScreen({
  permission,
  action,
  target,
  onUnlocked,
  onCancel,
}: PinScreenProps) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { accountId, deviceId } = useAccess()
  const { data: attempts } = useDeviceEvoluQuery(pinAttemptsQuery(accountId))
  const { data: base } = useDeviceEvoluQuery(pinAttemptBaseQuery(accountId))
  const blocked =
    attempts.length - (base[0]?.baseCount ?? 0) >= maxFailedPinAttempts
  const [view, setView] = useState<View>({ kind: "pin", attemptsLeft: null })
  const [pending, setPending] = useState(false)

  const finish = async (via: UnlockedVia, shown: number) => {
    if (shown > 0 || via === "phrase" || blocked) {
      setPending(true)
      await runToast(async (run) => {
        await run.ok(clearPinAttemptLog({ accountId, deviceId }))
      })
      setPending(false)
    }
    onUnlocked(via)
  }

  const showAttemptsOrFinish = async (
    via: UnlockedVia,
    failed: ReadonlyArray<PinAttemptRow>
  ) => {
    if (failed.length === 0 && via === "pin") {
      await finish(via, 0)
      return
    }
    setView({ kind: "attempts", via, attempts: failed })
  }

  const submitPin = async (pin: string) => {
    setPending(true)
    await runToast(async (run) => {
      const result = await run(enterPin({ pin, accountId, deviceId, target }))
      if (result.ok) {
        await showAttemptsOrFinish("pin", result.value)
      } else if (result.error.type === "WrongPin") {
        setView({ kind: "pin", attemptsLeft: result.error.attemptsLeft })
      }
      // A block shows itself: the log it reads has just reached the limit.
    })
    setPending(false)
  }

  const submitPhrase = async (phrase: string) => {
    setPending(true)
    await runToast(async (run) => {
      const result = await run(enterRecoveryPhrase({ phrase, accountId }))
      if (result.ok) {
        setView({ kind: "attempts", via: "phrase", attempts: result.value })
      } else {
        setView({ kind: "phrase", wrong: true })
      }
    })
    setPending(false)
  }

  const why =
    action === undefined
      ? permission === null
        ? t("access.pin.title")
        : t("access.pin.why.route", {
            permission: t(permissionLabelKeys[permission]),
          })
      : t("access.pin.why.action", { action: t(action) })

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-5 py-6 text-center">
      <div className="flex flex-col items-center gap-2">
        {blocked && view.kind !== "attempts" ? (
          <ShieldAlert className="size-8 text-destructive" aria-hidden="true" />
        ) : (
          <LockKeyhole
            className="size-8 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <h1 className="font-semibold text-xl leading-tight">{why}</h1>
        {permission !== null && view.kind === "pin" && !blocked ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("access.pin.help", {
              permission: t(permissionLabelKeys[permission]),
            })}
          </p>
        ) : null}
      </div>

      {view.kind === "attempts" ? (
        <FailedAttempts
          attempts={view.attempts}
          via={view.via}
          pending={pending}
          onContinue={() => void finish(view.via, view.attempts.length)}
        />
      ) : view.kind === "phrase" ? (
        <PhraseForm
          wrong={view.wrong}
          pending={pending}
          onSubmit={(phrase) => void submitPhrase(phrase)}
          onBack={
            blocked
              ? undefined
              : () => setView({ kind: "pin", attemptsLeft: null })
          }
        />
      ) : blocked ? (
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="font-medium text-destructive">
            {t("access.pin.blocked.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("access.pin.blocked.description")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setView({ kind: "phrase", wrong: false })}
          >
            <KeyRound data-icon="inline-start" />
            {t("access.pin.forgot")}
          </Button>
        </div>
      ) : (
        <PinPad
          pending={pending}
          attemptsLeft={view.attemptsLeft}
          onSubmit={(pin) => void submitPin(pin)}
          onForgot={() => setView({ kind: "phrase", wrong: false })}
        />
      )}

      {onCancel !== undefined && view.kind !== "attempts" ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("access.pin.cancel")}
        </Button>
      ) : null}
    </div>
  )
}

function PinPad({
  pending,
  attemptsLeft,
  onSubmit,
  onForgot,
}: {
  readonly pending: boolean
  readonly attemptsLeft: number | null
  readonly onSubmit: (pin: string) => void
  readonly onForgot: () => void
}) {
  const { t } = useTranslation()
  const [pin, setPin] = useState("")

  const press = (digit: string) => {
    setPin((current) =>
      current.length < maxPinLength ? current + digit : current
    )
  }
  const erase = () => {
    setPin((current) => current.slice(0, -1))
  }
  const submit = () => {
    if (pin.length < 4 || pending) return
    onSubmit(pin)
    setPin("")
  }

  // A hardware keyboard types the PIN too; nothing about the keys reaches
  // the console or an error report.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement) return
      if (/^\d$/u.test(event.key)) press(event.key)
      else if (event.key === "Backspace") erase()
      else if (event.key === "Enter") submit()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  })

  return (
    <div
      className="flex w-full max-w-xs flex-col items-center gap-4"
      {...{ [pinPadAttribute]: "" }}
    >
      <output
        className="flex h-6 items-center gap-2"
        aria-label={t("access.pin.entered", { count: pin.length })}
      >
        {Array.from({ length: Math.max(4, pin.length) }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
            key={index}
            className={cn(
              "size-3 rounded-full border border-foreground/40",
              index < pin.length && "bg-foreground"
            )}
          />
        ))}
      </output>
      <p
        className="min-h-5 text-sm text-destructive"
        role="alert"
        aria-live="assertive"
      >
        {attemptsLeft === null
          ? null
          : t("access.pin.wrong", { count: attemptsLeft })}
      </p>
      <div className="grid w-full grid-cols-3 gap-2">
        {digits.map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            size="lg"
            className="h-14 text-xl"
            disabled={pending}
            onClick={() => press(digit)}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-14"
          disabled={pending}
          aria-label={t("access.pin.erase")}
          onClick={erase}
        >
          <DeleteIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-14 text-xl"
          disabled={pending}
          onClick={() => press("0")}
        >
          0
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-14"
          disabled={pending || pin.length < 4}
          onClick={submit}
        >
          {t("access.pin.submit")}
        </Button>
      </div>
      <Button type="button" variant="link" size="sm" onClick={onForgot}>
        {t("access.pin.forgot")}
      </Button>
    </div>
  )
}

function PhraseForm({
  wrong,
  pending,
  onSubmit,
  onBack,
}: {
  readonly wrong: boolean
  readonly pending: boolean
  readonly onSubmit: (phrase: string) => void
  readonly onBack: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const [phrase, setPhrase] = useState("")

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(phrase)
      }}
    >
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        {t("access.phrase.warning")}
      </p>
      <Field data-invalid={wrong}>
        <FieldLabel htmlFor={inputId}>{t("access.phrase.label")}</FieldLabel>
        {/*
         * Everything that would let the device keyboard learn the phrase is
         * off: it opens the whole account.
         */}
        <PasswordTextarea
          id={inputId}
          value={phrase}
          hideLabel={t("passwordTextarea.hide")}
          showLabel={t("passwordTextarea.show")}
          disabled={pending}
          aria-invalid={wrong}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          onChange={(event) => {
            setPhrase(event.currentTarget.value)
          }}
        />
        <FieldDescription>{t("access.phrase.description")}</FieldDescription>
        <FieldError>{wrong ? t("access.phrase.wrong") : null}</FieldError>
      </Field>
      <div className="flex justify-between gap-2">
        {onBack === undefined ? (
          <span />
        ) : (
          <Button type="button" variant="ghost" onClick={onBack}>
            {t("access.phrase.back")}
          </Button>
        )}
        <Button type="submit" disabled={pending || phrase.trim() === ""}>
          <KeyRound data-icon="inline-start" />
          {t("access.phrase.submit")}
        </Button>
      </div>
    </form>
  )
}

function FailedAttempts({
  attempts,
  via,
  pending,
  onContinue,
}: {
  readonly attempts: ReadonlyArray<PinAttemptRow>
  readonly via: UnlockedVia
  readonly pending: boolean
  readonly onContinue: () => void
}) {
  const { t, language } = useTranslation()

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 text-left">
      {attempts.length > 0 ? (
        <>
          <p className="text-sm font-medium">
            {t("access.attempts.title", { count: attempts.length })}
          </p>
          <ul
            className="flex max-h-64 flex-col gap-2 overflow-auto"
            data-testid="failed-pin-attempts"
          >
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {Object.hasOwn(resources[language], attempt.target)
                    ? t(attempt.target as TranslationKey)
                    : attempt.target}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDateTime(new Date(attempt.attemptedAt), language)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {via === "phrase" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={onContinue}
            render={<Link to="/settings/access" />}
          >
            {t("access.phrase.setNewPin")}
          </Button>
        ) : null}
        <Button type="button" disabled={pending} onClick={onContinue}>
          {t("access.attempts.continue")}
        </Button>
      </div>
    </div>
  )
}
