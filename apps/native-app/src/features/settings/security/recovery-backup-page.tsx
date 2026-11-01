import { splitPhraseInput } from "@payky/app-shared/restore-words"
import { masterKeyToMnemonic } from "@payky/core/modules/shared/key-derivation"
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { usePreventScreenCapture } from "expo-screen-capture"
import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { AppState } from "react-native"
import { Text, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { RecoveryVerifyStep } from "./recovery-verify-step.tsx"
import { RecoveryWordsGrid } from "./recovery-words-grid.tsx"

type BackupStep = "intro" | "words" | "verify"

/**
 * Web's `RecoveryBackupPage` (account/0007): what the phrase is, the words,
 * then the optional check. The phrase is derived only while its steps show
 * (a zero-lifetime query, never stored or logged), asks for the owner
 * permission to appear, goes back to the intro when the screen unmounts or
 * the app leaves the foreground, blocks screenshots and the recents
 * thumbnail while shown (Android), and is not selectable or copyable: native
 * offers no way out of the screen, only transcription and the verification.
 */
export function RecoveryBackupPage() {
  const { t } = useTranslation()
  const { require } = useRequirePermission()
  const [step, setStep] = useState<BackupStep>("intro")
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      // Anything but "active": Android takes the recents thumbnail when the
      // state turns "inactive", before "background" arrives.
      if (state !== "active") setStep("intro")
    })
    return () => subscription.remove()
  }, [])

  return (
    <Screen>
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
        <CardContent>
          {step === "intro" ? (
            <Button
              label={t("settings.security.backup.start")}
              onPress={() => {
                void (async () => {
                  if (
                    await require("admin", "access.action.revealRecoveryPhrase")
                  ) {
                    setStep("words")
                  }
                })()
              }}
            />
          ) : (
            <RevealedPhrase
              step={step}
              onContinue={() => setStep("verify")}
              onDone={() => router.replace("/settings/security")}
            />
          )}
        </CardContent>
      </Card>
    </Screen>
  )
}

/** Mounted only while shown, so unmounting drops the zero-lifetime query and the phrase with it. */
function RevealedPhrase({
  step,
  onContinue,
  onDone,
}: {
  readonly step: "words" | "verify"
  readonly onContinue: () => void
  readonly onDone: () => void
}) {
  usePreventScreenCapture()
  const { t } = useTranslation()
  const { id, masterKey } = useAtomValue(accountAtom)
  const phrase = useQuery({
    queryKey: ["recovery-phrase", id],
    queryFn: () => masterKeyToMnemonic(masterKey),
    gcTime: 0,
    staleTime: 0,
  })
  const words = phrase.data === undefined ? null : splitPhraseInput(phrase.data)

  if (step === "verify" && words !== null) {
    return <RecoveryVerifyStep words={words} onDone={onDone} />
  }
  return (
    <YStack gap="3">
      <RecoveryWordsGrid words={words} />
      <Text fontSize="sm" color="muted-foreground">
        {t("settings.security.mnemonic.nativeHint")}
      </Text>
      <Text fontSize="sm" color="muted-foreground">
        {t("settings.security.mnemonic.warning")}
      </Text>
      <Button
        label={t("settings.security.backup.continue")}
        onPress={onContinue}
      />
      <Button
        variant="ghost"
        label={t("settings.security.verify.skip")}
        onPress={onDone}
      />
    </YStack>
  )
}
