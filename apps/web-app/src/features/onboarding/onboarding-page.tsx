import type { Language, TranslationKey } from "@payky/app-shared/i18n/resources"
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
import {
  getNostrIdentity,
  publishNostrProfileName,
} from "@payky/core/integrations/nostr/nostr-client"
import {
  finishOnboarding as finishOnboardingTask,
  requireNotOnboarded,
} from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { markAppEntered } from "@payky/web-shared/landing-redirect"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import { ChevronLeft } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { PhoneViewport } from "@/components/phone-viewport.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { LanguageSelect } from "@/features/onboarding/language-select.tsx"
import { AccountChoiceStep } from "@/features/onboarding/onboarding-steps/account-choice-step.tsx"
import { PaymentsStep } from "@/features/onboarding/onboarding-steps/payments-step.tsx"
import { SellingStep } from "@/features/onboarding/onboarding-steps/selling-step.tsx"
import { OpenAccountFlow } from "@/features/shared/account/open-account-flow.tsx"
import { useRestoreAccount } from "@/features/shared/account/use-restore-account.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useSetLocale } from "@/hooks/use-locale.ts"
import { nostrProfileQueryKey } from "@/hooks/use-nostr-profile.ts"
import { useReloadAppEvolu } from "@/hooks/use-reload-app-evolu.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSetLanguage, useTranslation } from "@/hooks/use-translation.ts"

/** The steps that are not part of opening an existing account. */
type OwnStep = Extract<OnboardingStep, "accountChoice" | "payments" | "selling">

const ownStepCopy = {
  accountChoice: {
    title: "onboarding.title",
    description: "onboarding.accountChoice.description",
  },
  payments: {
    title: "onboarding.payments.title",
    description: "onboarding.payments.description",
  },
  selling: {
    title: "onboarding.selling.title",
    description: "onboarding.selling.description",
  },
} as const satisfies Record<
  OwnStep,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

export function OnboardingPage({
  landingLanguage,
}: {
  readonly landingLanguage?: Language
}) {
  const runToast = useRunToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setLocale = useSetLocale()
  const { language, t } = useTranslation()
  const setLanguage = useSetLanguage()
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const [settings] = settingsData
  const [form, setForm] = useAtom(onboardingFormAtom)
  const [finishing, setFinishing] = useState(false)
  // Validate only on submission, so an unfinished account number does not
  // show an error while the merchant is still typing it.
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [cancelingSetup, setCancelingSetup] = useState(false)
  const {
    words: restoreWords,
    pending: restoring,
    error: restoreError,
    setWords: setRestoreWords,
    restore,
  } = useRestoreAccount()
  const ibanInputId = useId()
  const businessNameInputId = useId()
  const [profilePublishFailed, setProfilePublishFailed] = useState(false)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const activeAccount = useAtomValue(accountAtom)
  const reloadAppEvolu = useReloadAppEvolu()
  const confirm = useConfirmDialog()
  const { data: deviceAccounts } = useDeviceEvoluQuery(accountListQuery)

  // Set when this account was created from Settings > App Account > Create
  // account (not this device's very first account): lets onboarding offer a
  // way back to it instead of being a one-way trap. `undefined` on a
  // genuinely first-run device, where there is nothing to fall back to.
  const fallbackAccount = deviceAccounts
    .filter((account) => account.id !== activeAccount.id)
    .sort((a, b) => b.lastUseAt - a.lastUseAt)[0]

  const { step, accountType, businessName, iban, homeMode, tipsEnabled } = form
  const onboardingSteps = getOnboardingSteps(accountType)
  const pending = finishing || restoring || cancelingSetup

  const validation = validateOnboardingForm({ iban, businessName })
  const nameInvalid = validation.businessNameInvalid
  const ibanError: TranslationKey | null =
    submitAttempted && validation.ibanInvalid
      ? "settings.fiatBankAccount.iban.invalid"
      : null

  // Having reached the app once, this browser no longer gets the landing
  // page instead of onboarding (landing/0001).
  useEffect(markAppEntered, [])

  // A visitor arriving from the landing page continues in its language; a
  // device that already has an account keeps its own (landing/0003), and the
  // effect below takes it to the app. The parameter is dropped once read, so
  // a reload or Back does not undo a language picked here meanwhile.
  useEffect(() => {
    if (landingLanguage === undefined || settings !== undefined) return
    setLanguage(landingLanguage)
    void navigate({ to: "/onboarding", search: {}, replace: true })
  }, [landingLanguage, navigate, setLanguage, settings])

  useEffect(() => {
    // The appSettings row's existence marks the account as onboarded. The row
    // can also appear mid-form when a restored account's data arrives late
    // — leaving then keeps the synced settings intact.
    if (settings !== undefined) {
      void navigate({ to: "/", replace: true })
    }
  }, [navigate, settings])

  const stepIndex = onboardingSteps.indexOf(step)
  const canGoBack = stepIndex > 0 && !pending

  const goBack = () => {
    const previousStep = onboardingSteps[stepIndex - 1]
    if (previousStep) {
      setSubmitAttempted(false)
      setForm((current) => ({ ...current, step: previousStep }))
    }
  }

  const businessDetailsInvalid = validation.ibanInvalid || nameInvalid

  /** The business's name and account checked, on to how it sells. */
  const continueToSelling = () => {
    if (businessDetailsInvalid) {
      setSubmitAttempted(true)
      return
    }
    setForm((current) => ({ ...current, step: "selling" }))
  }

  const finishOnboarding = async (skipProfile = false) => {
    if (pending) return
    // Nothing is preselected: the merchant picks how they sell
    // (onboarding/0012). The recovery phrase is not asked about: it stays
    // in Settings > Security (onboarding/0002).
    if (homeMode === null) return
    if (businessDetailsInvalid) {
      setSubmitAttempted(true)
      setForm((current) => ({ ...current, step: "payments" }))
      return
    }

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
        const identity = getNostrIdentity(activeAccount.masterKey)
        queryClient.setQueryData(
          nostrProfileQueryKey(identity.pubkey),
          published.value
        )
      }
      setProfilePublishFailed(false)
      // The header's language picker changes the wizard's own text as often as
      // the user likes; the device locale (number/money formatting) follows
      // from the language that survived to here, once, so switching back and
      // forth while reading never leaves the wrong regional format applied.
      setLocale(getDeviceLocaleForLanguage(language))

      const finished = await run(
        finishOnboardingTask(
          createFinishOnboardingInput({
            iban: validation.iban,
            homeMode,
            tipsEnabled,
          })
        )
      )
      // An onboarded account leaves through the redirect effect above.
      if (!finished.ok) return "onboarding.alreadyOnboarded"
      setForm(initialOnboardingFormState)
      await navigate({ to: "/", replace: true })
    })

    setFinishing(false)
  }

  const restoreExistingAccount = async () => {
    if (!(await restore())) {
      return
    }

    setForm(initialOnboardingFormState)
    await navigate({ to: "/restore-account", search: { source: "onboarding" } })
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

      // The account being onboarded here has no data of its own yet, so
      // discarding it loses nothing — unlike `finishOnboarding`'s
      // `navigate`, no explicit redirect is needed: reloading the app Evolu
      // client re-derives `settings` for the now-active fallback account,
      // and the effect above navigates away from /onboarding once it sees
      // that account is already onboarded.
      removeDeviceAccount(deviceEvolu, activeAccount.id)
      selectAccount(deviceEvolu, fallbackAccount.id)
      setForm(initialOnboardingFormState)
      reloadAppEvolu()
    } finally {
      setCancelingSetup(false)
    }
  }

  const openAccountStep = openAccountStepOfOnboardingStep(step)
  const copy =
    openAccountStep !== null
      ? openAccountStepCopy[openAccountStep]
      : step === "accountChoice"
        ? ownStepCopy.accountChoice
        : step === "selling"
          ? ownStepCopy.selling
          : ownStepCopy.payments

  return (
    <main className="min-h-svh bg-background text-foreground">
      <PhoneViewport className="max-w-md px-6 py-6 sm:py-10">
        <div className="flex h-8 shrink-0 items-center justify-end gap-3">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="-ml-2.5 mr-auto"
              disabled={!canGoBack}
              onClick={goBack}
            >
              <ChevronLeft data-icon="inline-start" />
              {t("onboarding.back")}
            </Button>
          ) : null}
          <LanguageSelect disabled={pending} />
        </div>

        <div className="flex flex-col gap-8 py-6 sm:py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {t(copy.title)}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(copy.description)}
            </p>
          </header>

          {step === "accountChoice" ? (
            <AccountChoiceStep
              pending={pending}
              onSelect={(choice) => {
                setForm((current) =>
                  choice === "new"
                    ? { ...current, accountType: "new", step: "payments" }
                    : {
                        ...current,
                        accountType: "restore",
                        step: "restoreChoice",
                      }
                )
              }}
            />
          ) : null}

          {step === "payments" ? (
            <form
              className="flex flex-col gap-8"
              onSubmit={(event) => {
                event.preventDefault()
                continueToSelling()
              }}
            >
              <FieldGroup>
                <Field data-invalid={submitAttempted && nameInvalid}>
                  <FieldLabel htmlFor={businessNameInputId}>
                    {t("onboarding.businessName.label")}
                  </FieldLabel>
                  <Input
                    id={businessNameInputId}
                    value={businessName}
                    disabled={pending}
                    autoComplete="organization"
                    placeholder={t("onboarding.businessName.placeholder")}
                    aria-invalid={submitAttempted && nameInvalid}
                    aria-describedby={
                      submitAttempted && nameInvalid
                        ? `${businessNameInputId}-error`
                        : `${businessNameInputId}-description`
                    }
                    onChange={(event) => {
                      setProfilePublishFailed(false)
                      setForm((current) => ({
                        ...current,
                        businessName: event.currentTarget.value,
                      }))
                    }}
                  />
                  <FieldDescription id={`${businessNameInputId}-description`}>
                    {t("onboarding.businessName.description")}
                  </FieldDescription>
                  <FieldError id={`${businessNameInputId}-error`}>
                    {submitAttempted && nameInvalid
                      ? t("settings.profile.name.invalid")
                      : null}
                  </FieldError>
                </Field>
              </FieldGroup>
              <PaymentsStep
                iban={iban}
                ibanError={ibanError}
                ibanInputId={ibanInputId}
                pending={pending}
                onIbanChange={(nextIban) => {
                  setForm((current) => ({ ...current, iban: nextIban }))
                }}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full min-h-11"
                disabled={pending}
              >
                {t("onboarding.continue")}
              </Button>
            </form>
          ) : null}

          {step === "selling" ? (
            <form
              className="flex flex-col gap-8"
              onSubmit={(event) => {
                event.preventDefault()
                void finishOnboarding()
              }}
            >
              <SellingStep
                homeMode={homeMode}
                tipsEnabled={tipsEnabled}
                pending={pending}
                onHomeModeChange={(nextMode) => {
                  setForm((current) => ({ ...current, homeMode: nextMode }))
                }}
                onTipsEnabledChange={(enabled) => {
                  setForm((current) => ({ ...current, tipsEnabled: enabled }))
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
                type="submit"
                size="lg"
                className="w-full min-h-11"
                disabled={pending || homeMode === null}
              >
                {t(
                  profilePublishFailed
                    ? "onboarding.businessName.retry"
                    : "onboarding.finish"
                )}
              </Button>
              {profilePublishFailed ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11 h-auto whitespace-normal"
                  disabled={pending}
                  onClick={() => void finishOnboarding(true)}
                >
                  {t("onboarding.businessName.continueWithoutPublishing")}
                </Button>
              ) : null}
            </form>
          ) : null}

          {openAccountStep === null ? null : (
            <OpenAccountFlow
              step={openAccountStep}
              source="onboarding"
              confirmBeforeAdding={fallbackAccount !== undefined}
              chooserClassName="border shadow-none"
              restore={{
                error: restoreError,
                words: restoreWords,
                pending,
                onWordsChange: setRestoreWords,
                onRestore: () => {
                  void restoreExistingAccount()
                },
              }}
              onStepChange={(next) => {
                setForm((current) => ({
                  ...current,
                  accountType: onboardingAccountTypeOfOpenAccountStep[next],
                  step: onboardingStepOfOpenAccountStep[next],
                }))
              }}
            />
          )}
        </div>

        {fallbackAccount ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={pending}
            onClick={() => void cancelSetup()}
          >
            {t("onboarding.cancelSetup")}
          </Button>
        ) : null}
      </PhoneViewport>
    </main>
  )
}
