import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type CashuPaymentRequestLegs,
  CashuPaymentRequestLegsSchema,
  defaultCashuPaymentRequestLegs,
} from "@payky/core/cashu/cashu-payment-request"
import { setCashuPaymentRequestLegs } from "@payky/core/modules/account/account-actions"
import { cashuAccountQuery } from "@payky/core/modules/account/account-queries"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { OptionToggleGroup } from "../../../components/option-toggle-group.tsx"
import { Screen } from "../../../components/screen.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

export const cashuPaymentQrLabelKeys = {
  both: "settings.cashuAccount.qr.both",
  cashu: "settings.cashuAccount.qr.cashu",
  lightning: "settings.cashuAccount.qr.lightning",
} satisfies Record<CashuPaymentRequestLegs, TranslationKey>

/**
 * What the Cashu wallet's payment QR carries (settings/0003): both legs,
 * the default, or the Cashu request or the Lightning invoice alone. One
 * choice, written the moment it is picked, on the wallet's account row.
 */
export function CashuPaymentQrPage() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [account] = useEvoluQuery(cashuAccountQuery).data
  const legs = useInlineChoice<CashuPaymentRequestLegs>(
    account?.paymentRequestLegs ?? defaultCashuPaymentRequestLegs,
    (next) =>
      runToast(async (run) => {
        await run.ok(setCashuPaymentRequestLegs(next))
      })
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.cashuAccount.qr.title")} />
      <OptionToggleGroup
        value={legs.value}
        options={CashuPaymentRequestLegsSchema.options.map((value) => ({
          value,
          title: t(cashuPaymentQrLabelKeys[value]),
        }))}
        disabled={account === undefined || legs.saving}
        onChange={(next) => void legs.choose(next)}
      />
    </Screen>
  )
}
