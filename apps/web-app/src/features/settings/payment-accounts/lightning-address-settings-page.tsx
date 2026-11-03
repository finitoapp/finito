import {
  lightningAddressProbeErrorKeys,
  parseLightningAddressInput,
} from "@payky/app-shared/lightning-address-form"
import { probeLightningAddress } from "@payky/core/integrations/lnurl/lnurl-pay-client"
import { saveLightningAddressAccount } from "@payky/core/modules/account/account-actions"
import { lightningAddressAccountQuery } from "@payky/core/modules/account/account-queries"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The merchant's own Lightning wallet (lightning-address/0001). Saving probes
 * the address first and refuses one whose invoices carry no LUD-21 verify
 * (lightning-address/0003); a different address saves a new account
 * (lightning-address/0006).
 */
export function LightningAddressSettingsPage() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const inputId = useId()
  const { data: accountData } = useEvoluQuery(lightningAddressAccountQuery)
  const [account] = accountData
  const [draft, setDraft] = useState<string | null>(null)
  const { pending, saved, error, setError, resetSaved, submit } =
    useSettingsForm()
  const value = draft ?? account?.address ?? ""
  // Entering the first address is what setting the method up means, so it
  // enables the account; after that the switch on the overview owns it.
  const enabled = account === undefined || account.isDeleted !== 1

  return (
    <>
      <div className="h-6" />
      <FadeHeader
        title={t("settings.paymentAccounts.method.lightningAddress")}
      />
      <FormCard
        title={t("settings.lightningAddress.form.title")}
        description={t("settings.lightningAddress.form.description")}
        savedMessage={saved ? t("settings.lightningAddress.saved") : null}
        submitLabel={t("settings.lightningAddress.submit")}
        pending={pending}
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          resetSaved()

          const parsed = parseLightningAddressInput(value)
          if (!parsed.ok) {
            setError(parsed.errorKey)
            return
          }

          void submit(async () => {
            const outcome = { refused: false }
            const done = await runToast(async (run) => {
              const probe = await run(
                probeLightningAddress({ address: parsed.address })
              )
              if (!probe.ok) {
                outcome.refused = true
                setError(lightningAddressProbeErrorKeys[probe.error.type])
                return
              }
              await run.ok(
                saveLightningAddressAccount({
                  enabled,
                  address: parsed.address,
                })
              )
              setDraft(null)
            })
            return done && !outcome.refused
          })
        }}
      >
        <FieldGroup>
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor={inputId}>
              {t("settings.lightningAddress.address.label")}
            </FieldLabel>
            <Input
              id={inputId}
              value={value}
              placeholder={t("settings.lightningAddress.address.placeholder")}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              aria-invalid={error !== null}
              onChange={(event) => {
                setDraft(event.currentTarget.value)
                setError(null)
                resetSaved()
              }}
            />
            <FieldDescription>
              {t("settings.lightningAddress.address.description")}
            </FieldDescription>
            <FieldError>{error === null ? null : t(error)}</FieldError>
          </Field>
        </FieldGroup>
      </FormCard>
    </>
  )
}
