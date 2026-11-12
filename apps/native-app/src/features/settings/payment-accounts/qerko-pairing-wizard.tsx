import { brandName } from "@payky/app-shared/brand"
import { formatCountdown } from "@payky/app-shared/format-text"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  defaultQerkoCountry,
  defaultQerkoEnvironment,
  describeQerkoPairingFailure,
  isQerkoCodeComplete,
  parseQerkoIdentificationNumber,
  QERKO_CODE_LENGTH,
  qerkoCountryLabelKeys,
  qerkoCountryOptions,
  qerkoEnvironmentLabelKeys,
  qerkoPairingCopyKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import {
  type QerkoCountry,
  type QerkoEnvironment,
  QerkoEnvironmentSchema,
  type QerkoRole,
  requestQerkoPairing,
} from "@payky/core/integrations/qerko/qerko-client"
import { completeQerkoPairing } from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"
import { type ReactNode, useEffect, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../../components/ui/input-otp.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
} from "../../../components/ui/stepper.tsx"
import { appBrand } from "../../../core/app-brand.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

type Phase = "company" | "code" | "last"

const stepByPhase = {
  company: 1,
  code: 2,
  last: 3,
} satisfies Record<Phase, number>

const codeSlots = Array.from({ length: QERKO_CODE_LENGTH }, (_, slot) => slot)

interface PairingRequest {
  readonly pairingRequestId: string
  readonly resendAt: number
}

/**
 * The first-time pairing with Qerko, as web's `QerkoPairingWizard`: the
 * company, the code Qerko e-mails to it, and a last step that depends on what
 * `qerkoRole` is paired for (qerko/0007) — the terminal this device pays on,
 * or which device serves Qerko payments. Pairing saves the key, which turns
 * the screen behind this one into the paired view; `onPairing` runs as the
 * code is sent, before that write, so that screen keeps this wizard up through
 * the last step.
 */
export function QerkoPairingWizard({
  qerkoRole: role,
  onPairing,
  lastStep,
}: {
  readonly qerkoRole: QerkoRole
  readonly onPairing: () => void
  readonly lastStep: ReactNode
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const [phase, setPhase] = useState<Phase>("company")
  const [identificationNumber, setIdentificationNumber] = useState("")
  const [country, setCountry] = useState<QerkoCountry>(defaultQerkoCountry)
  const [environment, setEnvironment] = useState<QerkoEnvironment>(
    defaultQerkoEnvironment
  )
  const [request, setRequest] = useState<PairingRequest | null>(null)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<{
    readonly key: TranslationKey
    readonly params?: { readonly count: number }
  } | null>(null)
  const [invalidCompany, setInvalidCompany] = useState(false)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const copy = qerkoPairingCopyKeys[role]

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const requestCode = async () => {
    const parsed = parseQerkoIdentificationNumber(identificationNumber)
    if (parsed === null) {
      setInvalidCompany(true)
      return
    }
    setInvalidCompany(false)
    setPending(true)
    setMessage(null)
    await using run = appRun()
    const result = await run(
      requestQerkoPairing({
        role,
        environment,
        identificationNumber: parsed,
        country,
      })
    )
    setPending(false)
    if (!result.ok) {
      setMessage({ key: "settings.qerkoTerminal.error.unreachable" })
      return
    }
    setRequest({
      pairingRequestId: result.value.pairingRequestId,
      resendAt: Date.now() + result.value.resendAvailableInSeconds * 1000,
    })
    setCode("")
    setPhase("code")
  }

  const confirmCode = async () => {
    if (request === null) return
    setPending(true)
    setMessage(null)
    // Before the key is saved, not after: the saved key reaches the screen's
    // query, and re-renders it, before this confirmation returns.
    onPairing()
    await using run = appRun()
    const result = await run(
      completeQerkoPairing({
        role,
        environment,
        pairingRequestId: request.pairingRequestId,
        code,
        // The name the API key gets in Qerko's list of keys.
        name: brandName(appBrand),
      })
    )
    setPending(false)
    if (result.ok) {
      setPhase("last")
      return
    }

    const failure = describeQerkoPairingFailure(result.error)
    setMessage({
      key: failure.key,
      ...(failure.attemptsLeft === null
        ? {}
        : { params: { count: failure.attemptsLeft } }),
    })
    setCode("")
    if (failure.restart) {
      setRequest(null)
      setPhase("company")
    }
  }

  const resendIn = request === null ? 0 : Math.max(0, request.resendAt - now)

  return (
    <Card>
      <CardHeader>
        <Stepper value={stepByPhase[phase]}>
          <StepperNav>
            {[1, 2, 3].map((step) => (
              <StepperItem key={step} step={step} last={step === 3}>
                <StepperIndicator
                  size={8}
                  inactiveColor="muted-foreground-30"
                />
                {step < 3 ? <StepperSeparator /> : null}
              </StepperItem>
            ))}
          </StepperNav>
        </Stepper>
        <CardTitle>
          {phase === "company"
            ? t("settings.qerkoTerminal.unpaired.title")
            : phase === "code"
              ? t("settings.qerkoTerminal.code.title")
              : t(copy.lastStepTitle)}
        </CardTitle>
        <CardDescription>
          {phase === "company"
            ? t(copy.unpairedDescription)
            : phase === "code"
              ? t("settings.qerkoTerminal.code.instructions")
              : t(copy.lastStepDescription)}
        </CardDescription>
      </CardHeader>

      {phase === "company" ? (
        <>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>
                  {t(
                    "settings.qerkoTerminal.company.identificationNumber.label"
                  )}
                </FieldLabel>
                <Input
                  value={identificationNumber}
                  keyboardType="number-pad"
                  autoComplete="off"
                  invalid={invalidCompany}
                  onChangeText={setIdentificationNumber}
                />
                <FieldError>
                  {invalidCompany
                    ? t(
                        "settings.qerkoTerminal.company.identificationNumber.invalid"
                      )
                    : undefined}
                </FieldError>
              </Field>
              <YStack gap="2">
                <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                  {t("settings.qerkoTerminal.company.country.label")}
                </Text>
                <Select
                  value={country}
                  onValueChange={(next) => {
                    const parsed = qerkoCountryOptions.find(
                      (option) => option === next
                    )
                    if (parsed !== undefined) setCountry(parsed)
                  }}
                  items={Object.fromEntries(
                    qerkoCountryOptions.map((option) => [
                      option,
                      t(qerkoCountryLabelKeys[option]),
                    ])
                  )}
                >
                  <SelectTrigger
                    fullWidth
                    aria-label={t(
                      "settings.qerkoTerminal.company.country.label"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    title={t("settings.qerkoTerminal.company.country.label")}
                  >
                    {qerkoCountryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(qerkoCountryLabelKeys[option])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </YStack>

              <Collapsible>
                <CollapsibleTrigger>
                  <AdvancedSettingsLabel
                    label={t("settings.qerkoTerminal.advanced")}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent pt="4">
                  <YStack gap="2">
                    <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                      {t("settings.qerkoTerminal.environment.label")}
                    </Text>
                    <Select
                      value={environment}
                      onValueChange={(next) => {
                        const parsed = QerkoEnvironmentSchema.safeParse(next)
                        if (parsed.success) setEnvironment(parsed.data)
                      }}
                      items={Object.fromEntries(
                        QerkoEnvironmentSchema.options.map((option) => [
                          option,
                          t(qerkoEnvironmentLabelKeys[option]),
                        ])
                      )}
                    >
                      <SelectTrigger
                        fullWidth
                        aria-label={t(
                          "settings.qerkoTerminal.environment.label"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        title={t("settings.qerkoTerminal.environment.label")}
                      >
                        {QerkoEnvironmentSchema.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(qerkoEnvironmentLabelKeys[option])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {t("settings.qerkoTerminal.environment.description")}
                    </FieldDescription>
                  </YStack>
                </CollapsibleContent>
              </Collapsible>

              {message !== null ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(message.key, message.params)}
                  </AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              label={t("settings.qerkoTerminal.requestCode")}
              pending={pending}
              onPress={() => {
                void requestCode()
              }}
            />
          </CardFooter>
        </>
      ) : null}

      {phase === "code" ? (
        <>
          <CardContent gap={16}>
            <Field>
              <FieldLabel>{t("settings.qerkoTerminal.code.label")}</FieldLabel>
              <InputOTP
                value={code}
                maxLength={QERKO_CODE_LENGTH}
                autoFocus
                aria-label={t("settings.qerkoTerminal.code.label")}
                onChange={(next) => setCode(next.replace(/\D/gu, ""))}
              >
                <InputOTPGroup>
                  {codeSlots.map((slot) => (
                    <InputOTPSlot
                      key={slot}
                      index={slot}
                      first={slot === 0}
                      last={slot === QERKO_CODE_LENGTH - 1}
                      invalid={message !== null}
                      size="lg"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldError>
                {message === null ? undefined : t(message.key, message.params)}
              </FieldError>
            </Field>
            {resendIn > 0 ? (
              <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
                {t("settings.qerkoTerminal.code.resendIn", {
                  time: formatCountdown(resendIn),
                })}
              </Text>
            ) : null}
          </CardContent>
          <CardFooter gap={8}>
            <Button
              variant="outline"
              label={t("settings.qerkoTerminal.code.resend")}
              disabled={pending || resendIn > 0}
              onPress={() => {
                void requestCode()
              }}
            />
            <Button
              variant="outline"
              label={t("settings.qerkoTerminal.code.back")}
              disabled={pending}
              onPress={() => {
                setMessage(null)
                setPhase("company")
              }}
            />
            <Button
              label={t("settings.qerkoTerminal.code.confirm")}
              pending={pending}
              disabled={!isQerkoCodeComplete(code)}
              onPress={() => {
                void confirmCode()
              }}
            />
          </CardFooter>
        </>
      ) : null}

      {phase === "last" ? <CardContent>{lastStep}</CardContent> : null}
    </Card>
  )
}

function AdvancedSettingsLabel({ label }: { readonly label: string }) {
  return (
    <XStack items="center" justify="space-between" w="100%">
      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
        {label}
      </Text>
      <CollapsibleChevron color="muted-foreground" />
    </XStack>
  )
}
