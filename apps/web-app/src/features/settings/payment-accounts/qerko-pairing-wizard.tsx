import { useTimestamp } from "@dedalik/use-react"
import { brandName } from "@payky/app-shared/brand"
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
} from "@payky/app-shared/qerko-terminal-flow"
import {
  type QerkoCountry,
  type QerkoEnvironment,
  QerkoEnvironmentSchema,
  requestQerkoPairing,
} from "@payky/core/integrations/qerko/qerko-client"
import { completeQerkoPairing } from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { ChevronDown, LoaderCircle } from "lucide-react"
import { useId, useState } from "react"
import { Alert, AlertDescription } from "@/components/reui/alert.tsx"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
} from "@/components/reui/stepper.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { appBrand } from "@/core/app-brand.ts"
import { QerkoTerminalChooser } from "@/features/settings/payment-accounts/qerko-terminal-chooser.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatCountdown } from "@/lib/format-utils.ts"

type Phase = "company" | "code" | "terminal"

const stepByPhase = {
  company: 1,
  code: 2,
  terminal: 3,
} satisfies Record<Phase, number>

interface PairingRequest {
  readonly pairingRequestId: string
  readonly resendAt: number
}

/**
 * The first-time pairing with Qerko (qerko/0001), on one page: the company,
 * the code Qerko e-mails to it, and the terminal this device pays on. Pairing
 * itself saves the key, which turns the screen behind this one into the
 * paired view; `onPaired` lets that screen keep this wizard up until the
 * terminal is chosen.
 */
export function QerkoPairingWizard({
  onPaired,
  onFinished,
}: {
  readonly onPaired: () => void
  /** The terminal chosen, or nothing when the merchant chose later. */
  readonly onFinished: (terminalId?: string) => void
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
  const now = useTimestamp({ interval: 1000 })
  const companyId = useId()
  const codeId = useId()

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
    await using run = appRun()
    const result = await run(
      completeQerkoPairing({
        environment,
        pairingRequestId: request.pairingRequestId,
        code,
        // The name the API key gets in Qerko's list of keys.
        name: brandName(appBrand),
      })
    )
    setPending(false)
    if (result.ok) {
      onPaired()
      setPhase("terminal")
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
        <Stepper
          value={stepByPhase[phase]}
          orientation="horizontal"
          aria-hidden="true"
        >
          <StepperNav>
            {[1, 2, 3].map((step) => (
              <StepperItem key={step} step={step}>
                <StepperIndicator className="size-2 bg-muted-foreground/30 data-[state=active]:bg-primary data-[state=completed]:bg-primary" />
                {step < 3 ? <StepperSeparator className="w-6" /> : null}
              </StepperItem>
            ))}
          </StepperNav>
        </Stepper>
        <CardTitle>
          {phase === "company"
            ? t("settings.qerkoTerminal.unpaired.title")
            : phase === "code"
              ? t("settings.qerkoTerminal.code.title")
              : t("settings.qerkoTerminal.terminals.title")}
        </CardTitle>
        <CardDescription>
          {phase === "company"
            ? t("settings.qerkoTerminal.unpaired.description")
            : phase === "code"
              ? t("settings.qerkoTerminal.code.instructions")
              : t("settings.qerkoTerminal.terminals.description")}
        </CardDescription>
      </CardHeader>

      {phase === "company" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void requestCode()
          }}
        >
          <CardContent>
            <FieldGroup>
              <Field data-invalid={invalidCompany}>
                <FieldLabel htmlFor={companyId}>
                  {t(
                    "settings.qerkoTerminal.company.identificationNumber.label"
                  )}
                </FieldLabel>
                <Input
                  id={companyId}
                  value={identificationNumber}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={invalidCompany}
                  onChange={(event) => {
                    setIdentificationNumber(event.target.value)
                  }}
                />
                <FieldError>
                  {invalidCompany
                    ? t(
                        "settings.qerkoTerminal.company.identificationNumber.invalid"
                      )
                    : null}
                </FieldError>
              </Field>
              <Field>
                <FieldLabel>
                  {t("settings.qerkoTerminal.company.country.label")}
                </FieldLabel>
                <Select<QerkoCountry>
                  items={Object.fromEntries(
                    qerkoCountryOptions.map((option) => [
                      option,
                      t(qerkoCountryLabelKeys[option]),
                    ])
                  )}
                  value={country}
                  onValueChange={(next) => {
                    if (next !== null) setCountry(next)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {qerkoCountryOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(qerkoCountryLabelKeys[option])}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Collapsible>
                <CollapsibleTrigger className="group/advanced-options flex w-full items-center justify-between text-left text-sm font-medium">
                  {t("settings.qerkoTerminal.advanced")}
                  <ChevronDown
                    className="size-4 transition-transform group-data-[panel-open]/advanced-options:rotate-180"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden h-(--collapsible-panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0">
                  <div className="min-h-0 pt-5">
                    <Field>
                      <FieldLabel>
                        {t("settings.qerkoTerminal.environment.label")}
                      </FieldLabel>
                      <Select<QerkoEnvironment>
                        items={Object.fromEntries(
                          QerkoEnvironmentSchema.options.map((option) => [
                            option,
                            t(qerkoEnvironmentLabelKeys[option]),
                          ])
                        )}
                        value={environment}
                        onValueChange={(next) => {
                          if (next !== null) setEnvironment(next)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {QerkoEnvironmentSchema.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {t(qerkoEnvironmentLabelKeys[option])}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        {t("settings.qerkoTerminal.environment.description")}
                      </FieldDescription>
                    </Field>
                  </div>
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
          <CardFooter className="justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {t("settings.qerkoTerminal.requestCode")}
            </Button>
          </CardFooter>
        </form>
      ) : null}

      {phase === "code" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void confirmCode()
          }}
        >
          <CardContent className="flex flex-col gap-4">
            <Field data-invalid={message !== null}>
              <FieldLabel htmlFor={codeId}>
                {t("settings.qerkoTerminal.code.label")}
              </FieldLabel>
              <InputOTP
                id={codeId}
                value={code}
                maxLength={QERKO_CODE_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                containerClassName="justify-center gap-2"
                onChange={setCode}
              >
                <InputOTPGroup>
                  {Array.from({ length: QERKO_CODE_LENGTH }, (_, slot) => (
                    <InputOTPSlot
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                      key={slot}
                      index={slot}
                      aria-invalid={message !== null}
                      className="size-12 font-mono text-2xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldError>
                {message === null ? null : t(message.key, message.params)}
              </FieldError>
            </Field>
            <p className="text-sm text-muted-foreground tabular-nums">
              {resendIn > 0
                ? t("settings.qerkoTerminal.code.resendIn", {
                    time: formatCountdown(resendIn),
                  })
                : null}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || resendIn > 0}
              onClick={() => {
                void requestCode()
              }}
            >
              {t("settings.qerkoTerminal.code.resend")}
            </Button>
            <span className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setMessage(null)
                  setPhase("company")
                }}
              >
                {t("settings.qerkoTerminal.code.back")}
              </Button>
              <Button
                type="submit"
                disabled={pending || !isQerkoCodeComplete(code)}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : null}
                {t("settings.qerkoTerminal.code.confirm")}
              </Button>
            </span>
          </CardFooter>
        </form>
      ) : null}

      {phase === "terminal" ? (
        <CardContent>
          <QerkoTerminalChooser
            enableAccount
            onChosen={onFinished}
            onSkip={() => {
              onFinished()
            }}
          />
        </CardContent>
      ) : null}
    </Card>
  )
}
