import {
  checkVerifyAnswers,
  pickVerifyIndexes,
} from "@payky/app-shared/recovery-backup"
import { markRecoveryPhraseVerified } from "@payky/core/modules/app-settings/app-settings-actions"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * Web's `RecoveryVerifyStep`: the optional backup check (account/0009), three
 * random words of the phrase. Native has no way out of the screen, so this
 * is the only way to catch a wrong transcription. `onDone` runs after a
 * successful check and after a skip alike.
 */
export function RecoveryVerifyStep({
  words,
  onDone,
}: {
  readonly words: ReadonlyArray<string>
  readonly onDone: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const runToast = useRunToast()
  const [indexes] = useState(() => pickVerifyIndexes())
  const [answers, setAnswers] = useState<ReadonlyArray<string>>(() =>
    indexes.map(() => "")
  )
  const [wrong, setWrong] = useState(false)

  const submit = () => {
    if (!checkVerifyAnswers(words.join(" "), indexes, answers)) {
      setWrong(true)
      return
    }
    void runToast(async (run) => {
      await run.ok(markRecoveryPhraseVerified())
      toast.success(t("settings.security.verify.success"))
      onDone()
    })
  }

  return (
    <YStack gap="4">
      <Text fontSize="base" fontWeight="600">
        {t("settings.security.verify.title")}
      </Text>
      <Text fontSize="sm" color="muted-foreground">
        {t("settings.security.verify.description", {
          slots: indexes.map((index) => index + 1).join(", "),
        })}
      </Text>
      <YStack gap="2">
        {indexes.map((slot, position) => (
          <XStack key={slot} items="center" gap="2">
            <Text
              width={20}
              fontSize="xs"
              color="muted-foreground"
              style={{ textAlign: "right" }}
            >
              {slot + 1}
            </Text>
            <Input
              flex={1}
              value={answers[position] ?? ""}
              aria-label={t("onboarding.restore.wordLabel", {
                index: slot + 1,
              })}
              invalid={wrong}
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              contextMenuHidden
              onChangeText={(value) => {
                setWrong(false)
                setAnswers((current) =>
                  current.map((answer, i) => (i === position ? value : answer))
                )
              }}
            />
          </XStack>
        ))}
        {wrong ? (
          <Text fontSize="sm" color="destructive" role="alert">
            {t("settings.security.verify.wrong")}
          </Text>
        ) : null}
      </YStack>
      <XStack justify="flex-end" gap="2">
        <Button
          variant="ghost"
          label={t("settings.security.verify.skip")}
          onPress={onDone}
        />
        <Button label={t("settings.security.verify.submit")} onPress={submit} />
      </XStack>
    </YStack>
  )
}
