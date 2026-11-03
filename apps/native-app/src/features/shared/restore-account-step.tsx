import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { checkRestorePhrase } from "@payky/app-shared/restore-phrase"
import {
  analyzeRestoreWords,
  detectForeignSeed,
  emptyRestoreWords,
  fillRestoreWords,
  RESTORE_WORD_COUNT,
  restoreWordsToPhrase,
} from "@payky/app-shared/restore-words"
import * as Clipboard from "expo-clipboard"
import ClipboardPaste from "lucide-react-native/icons/clipboard-paste"
import KeyRound from "lucide-react-native/icons/key-round"
import { useRef, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../components/ui/button.tsx"
import {
  FieldDescription,
  FieldError,
  FieldGroup,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import { Switch } from "../../components/ui/switch.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * The recovery-phrase form: a paste button and 20 numbered word fields, hidden
 * until shown. The phrase lives only in this component's state (gone on
 * unmount), never in a query key, a persisted atom or a log. A pasted phrase
 * fans out over the fields; unknown words and completions of the field being
 * typed in show under the grid. Keyboard learning, suggestions and autofill
 * are off. The transfer from another device is the caller's to offer beside
 * it: onboarding's restore page draws it under the form, Settings as a row.
 */
export function RestoreAccountStep({
  error,
  pending,
  onRestore,
  submitFullWidth = false,
}: {
  readonly error: TranslationKey | null
  readonly pending: boolean
  readonly onRestore: (mnemonic: string) => void
  /** Onboarding makes this submit full-width, as fazole.fit's restore page; Settings ends its row with it. */
  readonly submitFullWidth?: boolean
}) {
  const { t } = useTranslation()
  const [words, setWords] = useState(emptyRestoreWords)
  const [shown, setShown] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [pasteFailed, setPasteFailed] = useState(false)
  const [dirtyError, setDirtyError] = useState(true)
  const inputs = useRef<Array<{ focus: () => void } | null>>([])

  const analysis = analyzeRestoreWords(words, activeIndex)
  const phrase = restoreWordsToPhrase(words)
  // A seed from another wallet is explained once, not word by word.
  const invalidIndexes = detectForeignSeed(words) ? [] : analysis.invalidIndexes
  const unknownWords = invalidIndexes.flatMap((index) => {
    const word = words[index]
    return word === undefined || word === "" ? [] : [word]
  })
  // Twenty known words that still fail are a checksum problem; a foreign seed
  // is named as soon as it is in.
  const checked =
    analysis.isComplete || analysis.filledCount > 0
      ? checkRestorePhrase(phrase)
      : null
  const liveError =
    checked !== null &&
    !checked.ok &&
    (analysis.isComplete ||
      checked.error === "settings.accounts.restore.mnemonic.foreign")
      ? checked.error
      : null
  const visibleError = (dirtyError ? error : null) ?? liveError

  const focusSlot = (index: number) => {
    inputs.current[index]?.focus()
  }

  const write = (index: number, value: string) => {
    const fill = fillRestoreWords(words, index, value)
    setWords(fill.words)
    setDirtyError(false)
    setPasteFailed(false)
    if (fill.nextIndex !== index) focusSlot(fill.nextIndex)
  }

  const complete = (word: string) => {
    if (activeIndex === null) return
    const fill = fillRestoreWords(words, activeIndex, `${word} `)
    setWords(fill.words)
    focusSlot(fill.nextIndex)
  }

  const paste = async () => {
    setPasteFailed(false)
    try {
      const text = await Clipboard.getStringAsync()
      if (text.trim() === "") {
        setPasteFailed(true)
        return
      }
      setWords(fillRestoreWords(emptyRestoreWords(), 0, text).words)
      setDirtyError(false)
    } catch {
      setPasteFailed(true)
    }
  }

  return (
    <YStack gap="4">
      <FieldGroup>
        <FieldDescription>{t("onboarding.restore.subtitle")}</FieldDescription>
        <Button
          variant="secondary"
          label={t("onboarding.restore.paste")}
          iconStart={ClipboardPaste}
          disabled={pending}
          onPress={() => void paste()}
        />
        {pasteFailed ? (
          <FieldError>{t("onboarding.restore.pasteFailed")}</FieldError>
        ) : null}
        <YStack gap="3">
          <XStack items="center" justify="space-between" gap="3">
            <XStack items="center" gap="2">
              <Switch
                checked={shown}
                onCheckedChange={setShown}
                aria-label={t("onboarding.restore.showWords")}
              />
              <Text fontSize="sm" fontWeight="600">
                {t("onboarding.restore.showWords")}
              </Text>
            </XStack>
            <Text fontSize="xs" color="muted-foreground">
              {t("onboarding.restore.counter", {
                count: analysis.filledCount,
                total: RESTORE_WORD_COUNT,
              })}
            </Text>
          </XStack>
          <XStack flexWrap="wrap" gap="2">
            {words.map((word, index) => (
              <XStack
                // biome-ignore lint/suspicious/noArrayIndexKey: the slots are fixed positions
                key={index}
                width="48%"
                items="center"
                gap="2"
              >
                <Text
                  width={20}
                  fontSize="xs"
                  color="muted-foreground"
                  style={{ textAlign: "right" }}
                >
                  {index + 1}
                </Text>
                <Input
                  ref={(element) => {
                    inputs.current[index] = element
                  }}
                  flex={1}
                  value={word}
                  disabled={pending}
                  aria-label={t("onboarding.restore.wordLabel", {
                    index: index + 1,
                  })}
                  invalid={
                    visibleError !== null || invalidIndexes.includes(index)
                  }
                  secureTextEntry={!shown}
                  autoComplete={index === 0 ? "current-password" : "off"}
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  contextMenuHidden
                  returnKeyType="next"
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() =>
                    setActiveIndex((current) =>
                      current === index ? null : current
                    )
                  }
                  onChangeText={(next) => write(index, next)}
                  onKeyPress={(event) => {
                    if (
                      event.nativeEvent.key === "Backspace" &&
                      word === "" &&
                      index > 0
                    ) {
                      focusSlot(index - 1)
                    }
                  }}
                  onSubmitEditing={() =>
                    focusSlot(Math.min(index + 1, RESTORE_WORD_COUNT - 1))
                  }
                />
              </XStack>
            ))}
          </XStack>
          {analysis.suggestions.length > 0 ? (
            <XStack flexWrap="wrap" gap="2">
              {analysis.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  label={suggestion}
                  // On web a press would first blur the word field, which
                  // clears the active slot and these suggestions with it;
                  // Android keeps the focus (`keyboardShouldPersistTaps`).
                  onMouseDown={(event) => event.preventDefault()}
                  onPress={() => complete(suggestion)}
                />
              ))}
            </XStack>
          ) : null}
          {unknownWords.length > 0 ? (
            <FieldError>
              {t("onboarding.restore.unknownWords", {
                words: unknownWords.join(", "),
              })}
            </FieldError>
          ) : null}
        </YStack>
        <FieldError>
          {visibleError === null ? undefined : t(visibleError)}
        </FieldError>
      </FieldGroup>
      <Button
        w={submitFullWidth ? "100%" : undefined}
        self={submitFullWidth ? undefined : "flex-end"}
        label={t("onboarding.restore.action")}
        iconStart={KeyRound}
        pending={pending}
        disabled={!analysis.isComplete}
        onPress={() => {
          setDirtyError(true)
          onRestore(phrase)
        }}
      />
    </YStack>
  )
}
