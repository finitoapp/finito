import { ExternalLinkIcon } from "lucide-react"

import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Informational only: the terminal itself is configured in the SwitchioPay
 * app (Comgate POS and similar branded builds), which this app drives
 * through the `switchio.pay.ECR` intent. See
 * `src/core/native/switchio.ts`.
 */
export function CardSwitchioSettingsPage() {
  const { t } = useTranslation()

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
    </>
  )
}
