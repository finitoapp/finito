import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { AiAssistantCard } from "@/features/settings/privacy/ai-assistant-card.tsx"
import { ErrorReportingCard } from "@/features/settings/privacy/error-reporting-card.tsx"
import { ProductLookupCard } from "@/features/settings/privacy/product-lookup-card.tsx"
import { ServiceProxyCard } from "@/features/settings/privacy/service-proxy-card.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

export function PrivacySettingsPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.about.privacy.title")} />

      <div className="flex flex-col gap-5">
        {/* The consents come first; the policy below explains what they send. */}
        <ErrorReportingCard />
        <ProductLookupCard />
        <AiAssistantCard />
        <ServiceProxyCard />
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.about.privacy.heading")}</CardTitle>
            <CardDescription>
              {t("settings.about.privacy.summary")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {t("settings.about.privacy.body")}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
