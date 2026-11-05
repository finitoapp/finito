import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { checkRestorePhrase } from "@payky/app-shared/restore-phrase"
import {
  analyzeRestoreWords,
  fillRestoreWords,
  RESTORE_WORD_COUNT,
  restoreWordsToPhrase,
} from "@payky/app-shared/restore-words"
import { ClipboardPaste, KeyRound } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import {
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field.tsx"
import { RestoreWordsGrid } from "@/features/shared/account/restore-words-grid.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/** The recovery-phrase form, as onboarding and Settings → Accounts show it. */
export function RestoreAccountForm({
  error,
  words,
  pending,
  onWordsChange,
  onRestore,
}: {
  readonly error: TranslationKey | null
  readonly words: ReadonlyArray<string>
  readonly pending: boolean
  readonly onWordsChange: (words: ReadonlyArray<string>) => void
  readonly onRestore: () => void
}) {
  const { t } = useTranslation()
  const [pasteFailed, setPasteFailed] = useState(false)
  const analysis = analyzeRestoreWords(words, null)

  // Twenty known words that still fail are a checksum problem; show it before
  // the button is pressed. A pasted foreign seed is reported the same way.
  const phrase = restoreWordsToPhrase(words)
  const live = analysis.isComplete ? checkRestorePhrase(phrase) : null
  const foreign =
    analysis.filledCount > 0 && analysis.filledCount !== RESTORE_WORD_COUNT
      ? checkRestorePhrase(phrase)
      : null
  const liveError =
    live !== null && !live.ok
      ? live.error
      : foreign !== null &&
          !foreign.ok &&
          foreign.error === "settings.accounts.restore.mnemonic.foreign"
        ? foreign.error
        : null
  const shownError = error ?? liveError

  const paste = async () => {
    setPasteFailed(false)
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim() === "") {
        setPasteFailed(true)
        return
      }
      onWordsChange(
        fillRestoreWords(
          words.map(() => ""),
          0,
          text
        ).words
      )
    } catch {
      setPasteFailed(true)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (analysis.isComplete) onRestore()
      }}
    >
      <FieldGroup>
        <FieldDescription>{t("onboarding.restore.subtitle")}</FieldDescription>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void paste()}
        >
          <ClipboardPaste data-icon="inline-start" />
          {t("onboarding.restore.paste")}
        </Button>
        {pasteFailed ? (
          <FieldError>{t("onboarding.restore.pasteFailed")}</FieldError>
        ) : null}
        <RestoreWordsGrid
          words={words}
          disabled={pending}
          invalid={shownError !== null}
          onPhrasePasted={() => setPasteFailed(false)}
          onWordsChange={onWordsChange}
        />
        <FieldError>{shownError ? t(shownError) : null}</FieldError>
      </FieldGroup>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending || !analysis.isComplete}>
          <KeyRound data-icon="inline-start" />
          {t("onboarding.restore.action")}
        </Button>
      </div>
    </form>
  )
}
