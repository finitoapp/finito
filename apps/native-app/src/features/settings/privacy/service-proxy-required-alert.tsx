import { router } from "expo-router"
import ShieldCheck from "lucide-react-native/icons/shield-check"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * Web's `ServiceProxyRequiredAlert`: warns on a bank's settings page that
 * the app's web build cannot reach the bank until the device allows the
 * service proxy, and leads to the privacy settings where it does. The page
 * shows it only while `useCanReachBanks()` is false, which the APK never is.
 */
export function ServiceProxyRequiredAlert({
  title,
  description,
}: {
  /** Both already translated. */
  readonly title: string
  readonly description: string
}) {
  const { t } = useTranslation()

  return (
    <Alert variant="warning" icon={TriangleAlert}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          iconStart={ShieldCheck}
          label={t("settings.privacy.serviceProxy.openPrivacySettings")}
          onPress={() => router.push("/settings/about/privacy")}
        />
      </AlertAction>
    </Alert>
  )
}
