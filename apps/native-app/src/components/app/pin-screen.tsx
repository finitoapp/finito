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
import { router } from "expo-router"
import Delete from "lucide-react-native/icons/delete"
import KeyRound from "lucide-react-native/icons/key-round"
import LockKeyhole from "lucide-react-native/icons/lock-keyhole"
import ShieldAlert from "lucide-react-native/icons/shield-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { permissionLabelKeys } from "../../core/access-labels.ts"
import type { UnlockedVia } from "../../core/access-session.ts"
import { useAccess } from "../../core/use-access.ts"
import { useDeviceEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { PasswordTextarea } from "../password-textarea.tsx"
import { Button } from "../ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../ui/field.tsx"
import { Icon } from "../ui/icon.tsx"

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

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const
const minPinLength = 4
const maxPinLength = 8

/**
 * The PIN screen of a locked route, of the one-shot prompt and of a device
 * without `sell` alike (access/0001), mirroring the web `PinScreen`: it says
 * why it is there, offers the recovery phrase, and after a correct PIN or
 * phrase shows the failed attempts before they are cleared (access/0006).
 * Every check goes through `enterPin`; nothing here sees a hash.
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

  const submitPin = async (pin: string) => {
    setPending(true)
    await runToast(async (run) => {
      const result = await run(enterPin({ pin, accountId, deviceId, target }))
      if (result.ok) {
        if (result.value.length === 0) await finish("pin", 0)
        else setView({ kind: "attempts", via: "pin", attempts: result.value })
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
    <YStack gap={20} items="center" width="100%" py={24}>
      <YStack gap={8} items="center">
        {blocked && view.kind !== "attempts" ? (
          <Icon icon={ShieldAlert} size={32} color="destructive" />
        ) : (
          <Icon icon={LockKeyhole} size={32} color="muted-foreground" />
        )}
        <Text
          fontSize={fontSize.xl}
          lineHeight={fontSize.xl}
          fontWeight={fontWeight.semibold}
          text="center"
          role="heading"
          aria-level={1}
        >
          {why}
        </Text>
        {permission !== null && view.kind === "pin" && !blocked ? (
          <Text
            maxW={384}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            text="center"
            color="muted-foreground"
          >
            {t("access.pin.help", {
              permission: t(permissionLabelKeys[permission]),
            })}
          </Text>
        ) : null}
      </YStack>

      {view.kind === "attempts" ? (
        <FailedAttempts
          attempts={view.attempts}
          pending={pending}
          onContinue={() => void finish(view.via, view.attempts.length)}
          // As web: a forgotten PIN was just bypassed with the phrase, so
          // offer to replace it. Unlocking first starts the session the
          // admin-only access settings need.
          onSetNewPin={
            view.via === "phrase"
              ? async () => {
                  await finish(view.via, view.attempts.length)
                  router.push("/settings/access")
                }
              : undefined
          }
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
        <YStack gap={12} items="center" maxW={384}>
          <Text
            fontWeight={fontWeight.medium}
            color="destructive"
            text="center"
            role="alert"
          >
            {t("access.pin.blocked.title")}
          </Text>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            text="center"
            color="muted-foreground"
          >
            {t("access.pin.blocked.description")}
          </Text>
          <Button
            variant="outline"
            iconStart={KeyRound}
            label={t("access.pin.forgot")}
            onPress={() => setView({ kind: "phrase", wrong: false })}
          />
        </YStack>
      ) : (
        <PinPad
          pending={pending}
          attemptsLeft={view.attemptsLeft}
          onSubmit={(pin) => void submitPin(pin)}
          onForgot={() => setView({ kind: "phrase", wrong: false })}
        />
      )}

      {onCancel !== undefined && view.kind !== "attempts" ? (
        <Button
          variant="ghost"
          label={t("access.pin.cancel")}
          onPress={onCancel}
        />
      ) : null}
    </YStack>
  )
}

/**
 * An in-app keypad, not a system keyboard: the digits never reach the
 * keyboard's suggestions, clipboard or learning. The PIN lives in this state
 * only until submitted, then is cleared; it is never stored or logged.
 */
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
  const submit = () => {
    if (pin.length < minPinLength || pending) return
    onSubmit(pin)
    setPin("")
  }

  const digitKey = (digit: string) => (
    <YStack key={digit} flex={1}>
      <Button
        variant="outline"
        size="lg"
        h={56}
        aria-label={digit}
        disabled={pending}
        onPress={() => press(digit)}
      >
        <Text
          fontSize={fontSize.xl}
          lineHeight={fontSize.xl}
          fontWeight={fontWeight.medium}
        >
          {digit}
        </Text>
      </Button>
    </YStack>
  )

  return (
    <YStack gap={16} items="center" width="100%" maxW={320}>
      <XStack
        gap={8}
        items="center"
        h={24}
        role="status"
        aria-label={t("access.pin.entered", { count: pin.length })}
      >
        {Array.from(
          { length: Math.max(minPinLength, pin.length) },
          (_, index) => (
            <YStack
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
              key={index}
              w={12}
              h={12}
              rounded={radius.full}
              borderWidth={1}
              borderColor="foreground-40"
              bg={index < pin.length ? "color" : "transparent"}
            />
          )
        )}
      </XStack>
      <Text
        minH={20}
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="destructive"
        text="center"
        role="alert"
        aria-live="assertive"
      >
        {attemptsLeft === null
          ? null
          : t("access.pin.wrong", { count: attemptsLeft })}
      </Text>
      <YStack gap={8} width="100%">
        {keypadRows.map((row) => (
          <XStack key={row.join()} gap={8}>
            {row.map(digitKey)}
          </XStack>
        ))}
        <XStack gap={8}>
          <YStack flex={1}>
            <Button
              variant="ghost"
              size="lg"
              h={56}
              iconStart={Delete}
              aria-label={t("access.pin.erase")}
              disabled={pending}
              onPress={() => setPin((current) => current.slice(0, -1))}
            />
          </YStack>
          {digitKey("0")}
          <YStack flex={1}>
            <Button
              size="lg"
              h={56}
              label={t("access.pin.submit")}
              pending={pending}
              disabled={pin.length < minPinLength}
              onPress={submit}
            />
          </YStack>
        </XStack>
      </YStack>
      <Button
        variant="link"
        size="sm"
        label={t("access.pin.forgot")}
        onPress={onForgot}
      />
    </YStack>
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
  const [phrase, setPhrase] = useState("")

  return (
    <YStack gap={16} width="100%" maxW={384}>
      <Text
        rounded={radius.md}
        borderWidth={1}
        borderColor="destructive-40"
        bg="destructive-5"
        p={12}
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
      >
        {t("access.phrase.warning")}
      </Text>
      {/*
       * Everything that would let the device keyboard learn the phrase is
       * off: it opens the whole account.
       */}
      <Field>
        <FieldLabel>{t("access.phrase.label")}</FieldLabel>
        {/* PasswordTextarea keeps every keyboard aid off whatever is passed. */}
        <PasswordTextarea
          value={phrase}
          onChangeText={setPhrase}
          hideLabel={t("passwordTextarea.hide")}
          showLabel={t("passwordTextarea.show")}
          contextMenuHidden
          disabled={pending}
          invalid={wrong}
        />
        <FieldDescription>{t("access.phrase.description")}</FieldDescription>
        <FieldError>{wrong ? t("access.phrase.wrong") : undefined}</FieldError>
      </Field>
      <XStack justify="space-between" gap={8}>
        {onBack === undefined ? (
          <YStack />
        ) : (
          <Button
            variant="ghost"
            label={t("access.phrase.back")}
            onPress={onBack}
          />
        )}
        <Button
          iconStart={KeyRound}
          label={t("access.phrase.submit")}
          pending={pending}
          disabled={phrase.trim() === ""}
          onPress={() => onSubmit(phrase)}
        />
      </XStack>
    </YStack>
  )
}

function FailedAttempts({
  attempts,
  pending,
  onContinue,
  onSetNewPin,
}: {
  readonly attempts: ReadonlyArray<PinAttemptRow>
  readonly pending: boolean
  readonly onContinue: () => void
  /** Only after a recovery-phrase unlock. */
  readonly onSetNewPin: (() => Promise<void>) | undefined
}) {
  const { t, language } = useTranslation()

  return (
    <YStack gap={16} width="100%" maxW={384}>
      {attempts.length > 0 ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
          >
            {t("access.attempts.title", { count: attempts.length })}
          </Text>
          <YStack gap={8} testID="failed-pin-attempts">
            {attempts.map((attempt) => (
              <XStack
                key={attempt.id}
                justify="space-between"
                gap={12}
                borderWidth={1}
                borderColor="border-color"
                rounded={radius.md}
                px={12}
                py={8}
              >
                <Text
                  flexShrink={1}
                  numberOfLines={1}
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                >
                  {Object.hasOwn(resources[language], attempt.target)
                    ? t(attempt.target as TranslationKey)
                    : attempt.target}
                </Text>
                <Text
                  shrink={0}
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                >
                  {new Date(attempt.attemptedAt).toLocaleString(language)}
                </Text>
              </XStack>
            ))}
          </YStack>
        </>
      ) : null}
      <XStack justify="flex-end" flexWrap="wrap" gap={8}>
        {onSetNewPin === undefined ? null : (
          <Button
            variant="outline"
            label={t("access.phrase.setNewPin")}
            disabled={pending}
            onPress={() => void onSetNewPin()}
          />
        )}
        <Button
          label={t("access.attempts.continue")}
          pending={pending}
          onPress={onContinue}
        />
      </XStack>
    </YStack>
  )
}
