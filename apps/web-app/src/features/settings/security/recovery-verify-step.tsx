import {
  checkVerifyAnswers,
  pickVerifyIndexes,
} from "@payky/app-shared/recovery-backup"
import { markRecoveryPhraseVerified } from "@payky/core/modules/app-settings/app-settings-actions"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The optional backup check (account/0009): three random words of the phrase.
 * A wrong answer says so without naming which word. `onDone` runs after a
 * successful check and after a skip alike.
 */
export function RecoveryVerifyStep({
  mnemonic,
  onDone,
}: {
  readonly mnemonic: string
  readonly onDone: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [indexes] = useState(() => pickVerifyIndexes())
  const [answers, setAnswers] = useState<ReadonlyArray<string>>(() =>
    indexes.map(() => "")
  )
  const [wrong, setWrong] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!checkVerifyAnswers(mnemonic, indexes, answers)) {
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-base font-medium">
        {t("settings.security.verify.title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("settings.security.verify.description", {
          slots: indexes.map((index) => index + 1).join(", "),
        })}
      </p>
      <div className="grid gap-2">
        {indexes.map((slot, position) => (
          <div key={slot} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {slot + 1}
            </span>
            <Input
              value={answers[position] ?? ""}
              aria-label={t("onboarding.restore.wordLabel", {
                index: slot + 1,
              })}
              aria-invalid={wrong}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => {
                const value = event.currentTarget.value
                setWrong(false)
                setAnswers((current) =>
                  current.map((answer, i) => (i === position ? value : answer))
                )
              }}
            />
          </div>
        ))}
        {wrong ? (
          <p role="alert" className="text-sm text-destructive">
            {t("settings.security.verify.wrong")}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("settings.security.verify.skip")}
        </Button>
        <Button type="submit">{t("settings.security.verify.submit")}</Button>
      </div>
    </form>
  )
}
