import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { setCardSwitchioAutoLaunch } from "@payky/core/modules/account/account-actions"
import { cardSwitchioAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  type CardSwitchioAutoLaunch,
  CardSwitchioAutoLaunchSchema,
  defaultCardSwitchioAutoLaunch,
} from "@payky/core/modules/account/account-types"
import { ExternalLinkIcon } from "lucide-react"

import { FadeHeader } from "@/components/fade-header.tsx"
import { OptionToggleGroup } from "@/components/option-toggle-group.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { useInlineChoice } from "@/features/shared/forms/inline-edit-save.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const cardAutoLaunchLabelKeys = {
  open: {
    title: "settings.cardSwitchioAccount.autoLaunch.open.title",
    description: "settings.cardSwitchioAccount.autoLaunch.open.description",
  },
  select: {
    title: "settings.cardSwitchioAccount.autoLaunch.select.title",
    description: "settings.cardSwitchioAccount.autoLaunch.select.description",
  },
  button: {
    title: "settings.cardSwitchioAccount.autoLaunch.button.title",
    description: "settings.cardSwitchioAccount.autoLaunch.button.description",
  },
} satisfies Record<
  CardSwitchioAutoLaunch,
  { readonly title: TranslationKey; readonly description: TranslationKey }
>

/**
 * The terminal itself is configured in the SwitchioPay
 * app (Comgate POS and similar branded builds), which this app drives
 * through the `switchio.pay.ECR` intent. See
 * `src/core/native/switchio.ts`. This screen says what it needs and when
 * the payment screen opens it (payment/0033).
 */
export function CardSwitchioSettingsPage() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [account] = useEvoluQuery(cardSwitchioAccountQuery).data
  const autoLaunch = useInlineChoice<CardSwitchioAutoLaunch>(
    account?.autoLaunch ?? defaultCardSwitchioAutoLaunch,
    async (next) => {
      await runToast(async (run) => {
        if (account === undefined) return
        await run.ok(
          setCardSwitchioAutoLaunch({ accountId: account.id, autoLaunch: next })
        )
      })
    }
  )

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.paymentAccounts.method.cardSwitchio")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cardSwitchioAccount.info.title")}</CardTitle>
          <CardDescription>
            {t("settings.cardSwitchioAccount.info.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <ul className="list-disc space-y-2 pl-5">
            <li>{t("settings.cardSwitchioAccount.info.switchioPay")}</li>
            <li>{t("settings.cardSwitchioAccount.info.contract")}</li>
          </ul>
          <p className="text-muted-foreground">
            {t("settings.cardSwitchioAccount.nativeRuntimeWarning")}
          </p>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href="https://switchio.com/try-softpos/"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <ExternalLinkIcon />
            {t("settings.cardSwitchioAccount.info.switchioPayLink")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {t("settings.cardSwitchioAccount.autoLaunch.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.cardSwitchioAccount.autoLaunch.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={autoLaunch.value}
            options={CardSwitchioAutoLaunchSchema.options.map((value) => ({
              value,
              title: t(cardAutoLaunchLabelKeys[value].title),
              description: t(cardAutoLaunchLabelKeys[value].description),
            }))}
            disabled={account === undefined || autoLaunch.saving}
            onChange={(next) => void autoLaunch.choose(next)}
          />
        </CardContent>
      </Card>
    </>
  )
}
