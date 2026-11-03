import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  getOnboardingSteps,
  initialOnboardingFormState,
  type OnboardingStep,
  onboardingFormAtom,
} from "@payky/app-shared/onboarding-form-state"
import {
  createFinishOnboardingInput,
  validateOnboardingForm,
} from "@payky/app-shared/onboarding-utils"
import {
  accountListQuery,
  removeDeviceAccount,
  selectAccount,
} from "@payky/core/evolu/device-account"
import { getDeviceLocaleForLanguage } from "@payky/core/evolu/device-client"
import { publishNostrProfileName } from "@payky/core/integrations/nostr/nostr-client"
import {
  finishOnboarding,
  requireNotOnboarded,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { router } from "expo-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import { useEffect, useRef, useState } from "react"
import { BackHandler, Platform } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { reloadAppEvoluAtom } from "../../atoms/evolu-counter.ts"
import { Screen, screenPaddingX } from "../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import { useConfirm } from "../../hooks/use-confirm.ts"
import {
  useDeviceEvoluQuery,
  useEvoluQuery,
} from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useSetLocale, useTranslation } from "../../hooks/use-translation.ts"
import { maxWidth } from "../../theme/tokens.ts"
import { AccountTransferTarget } from "../shared/account-transfer-target.tsx"
import { RestoreAccountStep } from "../shared/restore-account-step.tsx"
import { useRestoreAccount } from "../shared/use-restore-account.ts"
import { AccountChoiceStep } from "./account-choice-step.tsx"
import { LanguageSelect } from "./language-select.tsx"
import { PaymentsStep } from "./payments-step.tsx"

const headingKeys = {
  accountChoice: "onboarding.title",
  payments: "onboarding.payments.title",
  restore: "onboarding.restore.title",
  transfer: "accountTransfer.target.title",
} satisfies Record<OnboardingStep, TranslationKey>
const descriptionKeys = {
  accountChoice: "onboarding.accountChoice.description",
  payments: "onboarding.payments.description",
  restore: "onboarding.restore.description",
  transfer: "accountTransfer.target.description",
} satisfies Record<OnboardingStep, TranslationKey>

/** Web's onboarding `px-6`, wider than other screens' sides. */
const ONBOARDING_PADDING_X = 24

export function OnboardingPage() {
  const { language, t } = useTranslation()
  const runToast = useRunToast()
  const setLocale = useSetLocale()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [form, setForm] = useAtom(onboardingFormAtom)
  const { step, accountType, iban, businessName } = form
  // Validate only on submission, so an unfinished account number shows no
  // error while it is still being typed (as on web).
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  // A second tap before the first finishes must not start another run;
  // `finishOnboarding` refuses an onboarded account too, this saves the wait.
  const finishingRef = useRef(false)
  const {
    pending: restoring,
    error: restoreError,
    setError: setRestoreError,
    restore,
  } = useRestoreAccount("onboarding")
  const [profilePublishFailed, setProfilePublishFailed] = useState(false)
  const [cancelingSetup, setCancelingSetup] = useState(false)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const reloadAppEvolu = useSetAtom(reloadAppEvoluAtom)
  const confirm = useConfirm()
  const deviceAccounts = useDeviceEvoluQuery(accountListQuery).data
  // Set when this account was added from Settings > Accounts (not this
  // device's very first one): onboarding offers the way back to it instead
  // of being a one-way trap, as on web. `undefined` on a first-run device.
  const fallbackAccount = deviceAccounts
    .filter((account) => account.id !== activeAccount.id)
    .sort((a, b) => b.lastUseAt - a.lastUseAt)[0]
  const validation = validateOnboardingForm({ iban, businessName })
  const ibanError: TranslationKey | null =
    submitAttempted && validation.ibanInvalid
      ? "settings.fiatBankAccount.iban.invalid"
      : null
  const steps = getOnboardingSteps(accountType)
  const stepIndex = steps.indexOf(step)
  const pending = finishing || restoring || cancelingSetup

  // The appSettings row marks the account as onboarded (same as web): leave
  // so a finished or synced account never finishes again.
  useEffect(() => {
    if (settings !== undefined) router.replace("/")
  }, [settings])

  const finish = async (skipProfile = false) => {
    if (finishingRef.current) return
    // Validation precedes publishing the name (onboarding/0004, 0006).
    if (validation.ibanInvalid || validation.businessNameInvalid) {
      setSubmitAttempted(true)
      return
    }
    finishingRef.current = true
    setFinishing(true)
    await runToast(async (run) => {
      const allowed = await run(requireNotOnboarded())
      if (!allowed.ok) return "onboarding.alreadyOnboarded"

      if (!skipProfile && validation.businessName !== null) {
        const published = await run(
          publishNostrProfileName({ name: validation.businessName })
        )
        if (!published.ok) {
          setProfilePublishFailed(true)
          return
        }
      }
      setProfilePublishFailed(false)
      // The language may have been switched while reading; the formatting
      // locale follows the one that survived, once (as web does).
      setLocale(getDeviceLocaleForLanguage(language))

      const finished = await run(
        finishOnboarding(createFinishOnboardingInput(validation.iban))
      )
      if (!finished.ok) return "onboarding.alreadyOnboarded"
      setForm(initialOnboardingFormState)
      router.replace("/")
    })
    finishingRef.current = false
    setFinishing(false)
  }

  const cancelSetup = async () => {
    if (fallbackAccount === undefined) return
    setCancelingSetup(true)
    try {
      const confirmed = await confirm({
        title: t("onboarding.cancelSetup.confirm.title"),
        description: t("onboarding.cancelSetup.confirm.description", {
          name: fallbackAccount.name,
        }),
        confirmLabel: t("onboarding.cancelSetup.confirm.confirm"),
        cancelLabel: t("onboarding.cancelSetup.confirm.cancel"),
      })
      if (!confirmed) return
      // The account being onboarded has no data of its own yet, so
      // discarding it loses nothing. Reloading the app Evolu reads the
      // fallback account's settings, and the effect above leaves for home
      // once it sees that account is onboarded.
      removeDeviceAccount(deviceEvolu, activeAccount.id)
      selectAccount(deviceEvolu, fallbackAccount.id)
      setForm(initialOnboardingFormState)
      reloadAppEvolu()
    } finally {
      setCancelingSetup(false)
    }
  }

  const goBack = () => {
    const previous = steps[stepIndex - 1]
    if (previous === undefined) return false
    if (finishingRef.current) return true
    setSubmitAttempted(false)
    setRestoreError(null)
    setForm((current) => ({ ...current, step: previous }))
    return true
  }

  // Android's back button walks the steps before it leaves the screen. The
  // web export has no such button, and react-native-web's BackHandler only
  // warns that it is unsupported.
  // biome-ignore lint/correctness/useExhaustiveDependencies: goBack closes over the current step
  useEffect(() => {
    if (Platform.OS === "web") return
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      goBack
    )
    return () => subscription.remove()
  }, [step, accountType])

  return (
    <Screen>
      {/*
       * Web's onboarding column, `max-w-md px-6`: 448 px with its 24 px
       * sides, of which `Screen` pads the first `screenPaddingX`.
       */}
      <YStack
        gap="6"
        w="100%"
        self="center"
        px={ONBOARDING_PADDING_X - screenPaddingX}
        maxW={
          Platform.OS === "web" ? maxWidth.md - 2 * screenPaddingX : undefined
        }
      >
        <XStack items="center" minH={32}>
          {stepIndex > 0 ? (
            <Button
              label={t("onboarding.back")}
              iconStart={ChevronLeft}
              variant="ghost"
              disabled={pending}
              onPress={() => {
                goBack()
              }}
            />
          ) : null}
          <LanguageSelect disabled={pending} />
        </XStack>

        <YStack gap="8" py="6">
          <YStack gap="2">
            <Text
              fontSize="2xl"
              lineHeight="2xl"
              fontWeight="600"
              role="heading"
              aria-level={1}
            >
              {t(headingKeys[step])}
            </Text>
            <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
              {t(descriptionKeys[step])}
            </Text>
          </YStack>

          {step === "accountChoice" ? (
            <AccountChoiceStep
              pending={pending}
              onSelect={(nextAccountType) => {
                const nextSteps = getOnboardingSteps(nextAccountType)
                setForm((current) => ({
                  ...current,
                  accountType: nextAccountType,
                  step: nextSteps[1] ?? current.step,
                }))
              }}
            />
          ) : null}

          {step === "payments" ? (
            <YStack gap="8">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("onboarding.businessName.label")}</FieldLabel>
                  <Input
                    value={businessName}
                    disabled={pending}
                    invalid={submitAttempted && validation.businessNameInvalid}
                    autoComplete="organization"
                    placeholder={t("onboarding.businessName.placeholder")}
                    onChangeText={(nextName) => {
                      setProfilePublishFailed(false)
                      setForm((current) => ({
                        ...current,
                        businessName: nextName,
                      }))
                    }}
                  />
                  <FieldDescription>
                    {t("onboarding.businessName.description")}
                  </FieldDescription>
                  <FieldError>
                    {submitAttempted && validation.businessNameInvalid
                      ? t("settings.profile.name.invalid")
                      : undefined}
                  </FieldError>
                </Field>
              </FieldGroup>
              <PaymentsStep
                iban={iban}
                ibanError={ibanError}
                pending={pending}
                onIbanChange={(nextIban) => {
                  setForm((current) => ({ ...current, iban: nextIban }))
                }}
              />
              {profilePublishFailed ? (
                <Alert variant="destructive">
                  <AlertTitle>
                    {t("onboarding.businessName.publishFailed.title")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("onboarding.businessName.publishFailed.description")}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                size="lg"
                w="100%"
                label={t(
                  profilePublishFailed
                    ? "onboarding.businessName.retry"
                    : iban.trim() === ""
                      ? "onboarding.finishWithoutBankTransfer"
                      : "onboarding.finish"
                )}
                pending={finishing}
                onPress={() => {
                  void finish()
                }}
              />
              {profilePublishFailed ? (
                <Button
                  variant="outline"
                  w="100%"
                  h="auto"
                  minH={44}
                  py={10}
                  disabled={pending}
                  aria-label={t(
                    "onboarding.businessName.continueWithoutPublishing"
                  )}
                  onPress={() => {
                    void finish(true)
                  }}
                >
                  <Text flexShrink={1} textAlign="center">
                    {t("onboarding.businessName.continueWithoutPublishing")}
                  </Text>
                </Button>
              ) : null}
            </YStack>
          ) : null}

          {step === "restore" ? (
            <RestoreAccountStep
              error={restoreError}
              pending={restoring}
              submitFullWidth
              onTransfer={() =>
                setForm((current) => ({ ...current, step: "transfer" }))
              }
              onRestore={(phrase) => {
                void restore(phrase).then((started) => {
                  if (started) setForm(initialOnboardingFormState)
                })
              }}
            />
          ) : null}

          {step === "transfer" ? (
            <AccountTransferTarget
              source="onboarding"
              confirmBeforeAdding={fallbackAccount !== undefined}
              onRestoreWithPhrase={() =>
                setForm((current) => ({
                  ...current,
                  accountType: "restore",
                  step: "restore",
                }))
              }
            />
          ) : null}
        </YStack>

        {fallbackAccount === undefined ? null : (
          <XStack>
            <Button
              variant="ghost"
              size="sm"
              label={t("onboarding.cancelSetup")}
              disabled={pending}
              onPress={() => void cancelSetup()}
            />
          </XStack>
        )}
      </YStack>
    </Screen>
  )
}
