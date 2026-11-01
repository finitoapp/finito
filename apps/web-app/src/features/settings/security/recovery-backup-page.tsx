import { splitPhraseInput } from "@payky/app-shared/restore-words"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { CopyIcon, EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { accountAtom, recoveryMnemonicAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { RecoveryVerifyStep } from "@/features/settings/security/recovery-verify-step.tsx"
import { RecoveryWordsGrid } from "@/features/settings/security/recovery-words-grid.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { copyToClipboard } from "@/lib/clipboard.ts"
import { triggerPasswordManagerSeedSave } from "@/platform/password-manager.ts"

const saveResultKeys = {
  saved: "settings.security.mnemonic.savePasswords.saved",
  unsupported: "settings.security.mnemonic.savePasswords.unsupported",
  failed: "settings.security.mnemonic.savePasswords.failed",
} as const

type BackupStep = "intro" | "words" | "verify"

/**
 * The recovery-phrase backup (account/0007): what the phrase is, the words,
 * then the optional check. Leaves for Security when done or skipped; only the
 * check writes "verified".
 */
export function RecoveryBackupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const account = useAtomValue(accountAtom)
  const mnemonic = useAtomValue(recoveryMnemonicAtom)
  const [step, setStep] = useState<BackupStep>("intro")
  const [revealed, setRevealed] = useState(true)

  const leave = () => void navigate({ to: "/settings/security" })
  const copyMnemonic = () => {
    void copyToClipboard(mnemonic, {
      copied: t("settings.security.mnemonic.copied"),
      failed: t("settings.security.mnemonic.copyError"),
    })
  }
  const saveToPasswords = async () => {
    const result = await triggerPasswordManagerSeedSave({
      accountId: account.id,
      accountName: account.name,
      mnemonic,
    })
    const message = t(saveResultKeys[result])
    if (result === "saved") toast.success(message)
    else toast.error(message)
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.security.mnemonic.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.security.mnemonic.title")}</CardTitle>
          {step === "intro" ? (
            <CardDescription>
              {t("settings.security.mnemonic.intro")}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === "intro" ? (
            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep("words")}>
                {t("settings.security.backup.start")}
              </Button>
            </div>
          ) : null}
          {step === "words" ? (
            <>
              <RecoveryWordsGrid
                words={splitPhraseInput(mnemonic)}
                revealed={revealed}
                label={t("settings.security.mnemonic.label")}
              />
              <p className="text-sm text-muted-foreground">
                {t("settings.security.mnemonic.warning")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed((current) => !current)}
                >
                  {revealed ? (
                    <EyeOffIcon data-icon="inline-start" />
                  ) : (
                    <EyeIcon data-icon="inline-start" />
                  )}
                  {t(
                    revealed ? "passwordTextarea.hide" : "passwordTextarea.show"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyMnemonic}
                >
                  <CopyIcon data-icon="inline-start" />
                  {t("settings.security.mnemonic.copy")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveToPasswords()}
                >
                  <KeyRoundIcon data-icon="inline-start" />
                  {t("settings.security.mnemonic.savePasswords")}
                </Button>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="ghost" onClick={leave}>
                  {t("settings.security.verify.skip")}
                </Button>
                <Button type="button" onClick={() => setStep("verify")}>
                  {t("settings.security.backup.continue")}
                </Button>
              </div>
            </>
          ) : null}
          {step === "verify" ? (
            <RecoveryVerifyStep mnemonic={mnemonic} onDone={leave} />
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}
