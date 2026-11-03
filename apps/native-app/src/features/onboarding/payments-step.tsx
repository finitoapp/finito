import { czechBankForDraft } from "@payky/app-shared/bank-account-codecs"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * The optional bank account, as fazole.fit's shop account field (Linky's
 * `apps/fazole-app/src/screens/ShopFields.tsx`): the label, the field with
 * the format as its placeholder, and the recognized bank as the hint. A
 * nonblank account turns bank transfers on (onboarding/0003).
 */
export function PaymentsStep({
  iban,
  ibanError,
  pending,
  onIbanChange,
}: {
  readonly iban: string
  readonly ibanError: TranslationKey | null
  readonly pending: boolean
  readonly onIbanChange: (iban: string) => void
}) {
  const { t } = useTranslation()
  const czechBank = czechBankForDraft(iban)
  const bank =
    czechBank === undefined
      ? undefined
      : (czechBank ?? t("settings.fiatBankAccount.iban.unknownBank"))

  return (
    <Field>
      <FieldLabel>{t("onboarding.setup.account.label")}</FieldLabel>
      <Input
        value={iban}
        disabled={pending}
        invalid={ibanError !== null}
        placeholder={t("onboarding.setup.account.placeholder")}
        // The account needs "/" and "-", which numeric phone keyboards lack.
        inputMode="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        onChangeText={onIbanChange}
      />
      {ibanError === null && bank !== undefined ? (
        <FieldDescription>{bank}</FieldDescription>
      ) : null}
      <FieldError>{ibanError === null ? undefined : t(ibanError)}</FieldError>
    </Field>
  )
}
