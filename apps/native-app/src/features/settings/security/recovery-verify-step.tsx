import {
  checkVerifyAnswers,
  pickVerifyIndexes,
} from "@payky/app-shared/recovery-backup"
import { markRecoveryPhraseVerified } from "@payky/core/modules/app-settings/app-settings-actions"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import { CardContent, CardFooter } from "../../../components/ui/card.tsx"
import { FieldError } from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

/**
 * Web's `RecoveryVerifyStep`: the optional backup check (account/0007), three
 * random words of the phrase. Native has no way out of the screen, so this
 * is the only way to catch a wrong transcription. `onDone` runs after a
 * successful check and after a skip alike. It draws the content and footer
 * of the backup page's card, whose header titles the step.
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
    <>
      <CardContent gap={16}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("settings.security.verify.description", {
            slots: indexes.map((index) => index + 1).join(", "),
          })}
        </Text>
        <YStack gap={8}>
          {indexes.map((slot, position) => (
            <XStack key={slot} items="center" gap={8}>
              <Text
                w={20}
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
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
                    current.map((answer, i) =>
                      i === position ? value : answer
                    )
                  )
                }}
              />
            </XStack>
          ))}
          <FieldError>
            {wrong ? t("settings.security.verify.wrong") : undefined}
          </FieldError>
        </YStack>
      </CardContent>
      <CardFooter justify="flex-end" flexWrap="wrap" gap={8}>
        <Button
          variant="ghost"
          label={t("settings.security.verify.skip")}
          onPress={onDone}
        />
        <Button label={t("settings.security.verify.submit")} onPress={submit} />
      </CardFooter>
    </>
  )
}
