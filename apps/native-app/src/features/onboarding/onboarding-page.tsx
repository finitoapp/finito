import { brandName, paykyBrand } from "@payky/app-shared/brand"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  initialOnboardingFormState,
  type OnboardingStep,
  onboardingFormAtom,
  previousOnboardingStep,
} from "@payky/app-shared/onboarding-form-state"
import {
  createFinishOnboardingInput,
  validateOnboardingForm,
} from "@payky/app-shared/onboarding-utils"
import {
  onboardingAccountTypeOfOpenAccountStep,
  onboardingStepOfOpenAccountStep,
  openAccountStepCopy,
  openAccountStepOfOnboardingStep,
} from "@payky/app-shared/open-account"
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
import { useEffect, useRef, useState } from "react"
import { BackHandler, Platform } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { reloadAppEvoluAtom } from "../../atoms/evolu-counter.ts"
import { FadeHeader } from "../../components/fade-header.tsx"
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
import { fontSize, fontWeight, maxWidth } from "../../theme/tokens.ts"
import { OpenAccountFlow } from "../shared/open-account-flow.tsx"
import { useRestoreAccount } from "../shared/use-restore-account.ts"
import { LanguageSelect } from "./language-select.tsx"
import { PaymentsStep } from "./payments-step.tsx"
import { SellingStep } from "./selling-step.tsx"
import { WelcomeStep } from "./welcome-step.tsx"

/** The steps after the welcome screen head their page, as fazole.fit's do. */
type HeadedStep = Exclude<OnboardingStep, "accountChoice">

/** The setup page's heading; the steps of opening an account share theirs with Settings. */
const stepCopy = (
  step: HeadedStep
): { readonly title: TranslationKey; readonly description: TranslationKey } => {
  const openAccountStep = openAccountStepOfOnboardingStep(step)
  if (step === "selling")
    return {
      title: "onboarding.selling.title",
      description: "onboarding.selling.description",
    }
  return openAccountStep === null
    ? {
        title: "onboarding.setup.title",
        description: "onboarding.payments.description",
      }
    : openAccountStepCopy[openAccountStep]
}

/** fazole.fit's page gutter (`$xl`, 20), wider than other screens' sides. */
const ONBOARDING_PADDING_X = 20

/**
 * Onboarding as fazole.fit's (Linky's `apps/fazole-app/src/screens/
 * WelcomeScreen.tsx`, `SetupScreen.tsx` and `RestoreScreen.tsx`): a welcome
 * screen with the two ways in, a business setup page, and a restore page
 * that also offers the transfer from another device. The steps and the
 * form live in `onboardingFormAtom`, shared with web, so the restore sync
 * page can send a phrase back here.
 */
export function OnboardingPage() {
  const { language, t } = useTranslation()
  const runToast = useRunToast()
  const setLocale = useSetLocale()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [form, setForm] = useAtom(onboardingFormAtom)
  const { step, accountType, iban, businessName, homeMode, tipsEnabled } = form
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
  const sourceApp = brandName(paykyBrand)
  const validation = validateOnboardingForm({ iban, businessName })
  const ibanError: TranslationKey | null =
    submitAttempted && validation.ibanInvalid
      ? "settings.fiatBankAccount.iban.invalid"
      : null
  const pending = finishing || restoring || cancelingSetup
  // A phrase whose relays held nothing (`existingMnemonic`) starts on the
  // setup page with no welcome screen to go back to.
  const previousStep = previousOnboardingStep(step, accountType)
  const canGoBack = previousStep !== null
  const openAccountStep = openAccountStepOfOnboardingStep(step)

  // The appSettings row marks the account as onboarded (same as web): leave
  // so a finished or synced account never finishes again.
  useEffect(() => {
    if (settings !== undefined) router.replace("/")
  }, [settings])

  const businessDetailsInvalid =
    validation.ibanInvalid || validation.businessNameInvalid

  /** The business's name and account checked, on to how it sells. */
  const continueToSelling = () => {
    if (businessDetailsInvalid) {
      setSubmitAttempted(true)
      return
    }
    setForm((current) => ({ ...current, step: "selling" }))
  }

  const finish = async (skipProfile = false) => {
    if (finishingRef.current) return
    // Nothing is preselected: the merchant picks how they sell (onboarding/0012).
    if (homeMode === null) return
    // Validation precedes publishing the name (onboarding/0004, 0006).
    if (businessDetailsInvalid) {
      setSubmitAttempted(true)
      setForm((current) => ({ ...current, step: "payments" }))
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

      // Finito starts on Spark, for now (onboarding/0010).
      const finished = await run(
        finishOnboarding(
          createFinishOnboardingInput({
            iban: validation.iban,
            homeMode,
            tipsEnabled,
          })
        )
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

  /**
   * Each way of opening an account goes back to the chooser, the chooser and
   * the setup page to the welcome screen (`previousOnboardingStep`).
   */
  const goBack = () => {
    if (previousStep === null) return false
    if (finishingRef.current) return true
    setSubmitAttempted(false)
    setRestoreError(null)
    setForm((current) => ({ ...current, step: previousStep }))
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
       * fazole.fit's page: a `sheetWidth` column with a 20 gutter, of which
       * `Screen` pads the first `screenPaddingX`.
       */}
      <YStack
        flex={1}
        gap={20}
        w="100%"
        self="center"
        px={ONBOARDING_PADDING_X - screenPaddingX}
        maxW={
          Platform.OS === "web" ? maxWidth.md - 2 * screenPaddingX : undefined
        }
      >
        {step === "accountChoice" ? (
          <>
            <FadeHeader
              startAddon={null}
              endAddon={<LanguageSelect disabled={pending} />}
            />
            <WelcomeStep
              pending={pending}
              onNew={() =>
                setForm((current) => ({
                  ...current,
                  accountType: "new",
                  step: "payments",
                }))
              }
              onRestore={() =>
                setForm((current) => ({
                  ...current,
                  accountType: "restore",
                  step: "restoreChoice",
                }))
              }
            />
          </>
        ) : (
          <>
            {canGoBack ? (
              <FadeHeader customStartAddonOnClick={goBack} />
            ) : (
              <FadeHeader startAddon={null} />
            )}
            <YStack gap={8}>
              <Text
                fontSize={fontSize["2xl"]}
                lineHeight={fontSize["2xl"]}
                fontWeight={fontWeight.bold}
                role="heading"
                aria-level={1}
              >
                {t(stepCopy(step).title, { sourceApp })}
              </Text>
              <Text color="muted-foreground">
                {t(stepCopy(step).description, { sourceApp })}
              </Text>
            </YStack>

            {step === "payments" ? (
              <YStack gap={20}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("onboarding.setup.name.label")}</FieldLabel>
                    <Input
                      value={businessName}
                      disabled={pending}
                      invalid={
                        submitAttempted && validation.businessNameInvalid
                      }
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
                    {submitAttempted && validation.businessNameInvalid ? (
                      <FieldError>
                        {t("settings.profile.name.invalid")}
                      </FieldError>
                    ) : (
                      <FieldDescription>
                        {t("onboarding.setup.name.hint")}
                      </FieldDescription>
                    )}
                  </Field>
                  <PaymentsStep
                    iban={iban}
                    ibanError={ibanError}
                    pending={pending}
                    onIbanChange={(nextIban) => {
                      setForm((current) => ({ ...current, iban: nextIban }))
                    }}
                  />
                </FieldGroup>
                <Button
                  w="100%"
                  label={t("onboarding.continue")}
                  disabled={pending}
                  onPress={continueToSelling}
                />
              </YStack>
            ) : null}

            {step === "selling" ? (
              <YStack gap={20}>
                <SellingStep
                  homeMode={homeMode}
                  tipsEnabled={tipsEnabled}
                  pending={pending}
                  onHomeModeChange={(nextMode) => {
                    setForm((current) => ({ ...current, homeMode: nextMode }))
                  }}
                  onTipsEnabledChange={(enabled) => {
                    setForm((current) => ({
                      ...current,
                      tipsEnabled: enabled,
                    }))
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
                  w="100%"
                  label={t(
                    profilePublishFailed
                      ? "onboarding.businessName.retry"
                      : "onboarding.finish"
                  )}
                  pending={finishing}
                  disabled={homeMode === null}
                  onPress={() => {
                    void finish()
                  }}
                />
                {profilePublishFailed ? (
                  <Button
                    variant="ghost"
                    w="100%"
                    h="auto"
                    disabled={pending}
                    aria-label={t(
                      "onboarding.businessName.continueWithoutPublishing"
                    )}
                    onPress={() => {
                      void finish(true)
                    }}
                  >
                    <Text
                      flexShrink={1}
                      text="center"
                      fontSize={fontSize.sm}
                      lineHeight={fontSize.sm}
                      fontWeight={fontWeight.bold}
                    >
                      {t("onboarding.businessName.continueWithoutPublishing")}
                    </Text>
                  </Button>
                ) : null}
              </YStack>
            ) : null}

            {openAccountStep === null ? null : (
              <OpenAccountFlow
                step={openAccountStep}
                source="onboarding"
                confirmBeforeAdding={fallbackAccount !== undefined}
                disabled={pending}
                restore={{
                  error: restoreError,
                  pending: restoring,
                  onRestore: (phrase) => {
                    void restore(phrase).then((started) => {
                      if (started) setForm(initialOnboardingFormState)
                    })
                  },
                }}
                onStepChange={(next) => {
                  setRestoreError(null)
                  setForm((current) => ({
                    ...current,
                    accountType: onboardingAccountTypeOfOpenAccountStep[next],
                    step: onboardingStepOfOpenAccountStep[next],
                  }))
                }}
              />
            )}
          </>
        )}

        {fallbackAccount === undefined ? null : (
          <XStack justify="center">
            <Button
              variant="ghost"
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
