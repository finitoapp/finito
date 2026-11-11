import { Link } from "@tanstack/react-router"
import { ShieldCheck, TriangleAlert } from "lucide-react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Warns on a bank's settings page that this browser cannot reach the bank
 * until the device allows the service proxy, and leads to the privacy
 * settings where it does. The page shows it only while `useCanReachBanks()`
 * is false.
 */
export function ServiceProxyRequiredAlert({
  title,
  description,
}: {
  readonly title: string
  readonly description: string
}) {
  const { t } = useTranslation()

  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertAction>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={<Link to="/settings/about/privacy" />}
        >
          <ShieldCheck data-icon="inline-start" />
          {t("settings.privacy.serviceProxy.openPrivacySettings")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
