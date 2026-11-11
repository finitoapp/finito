import { Capacitor } from "@capacitor/core"
import { Power, PowerOff } from "lucide-react"

import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import {
  useServiceProxyEnabled,
  useSetServiceProxyEnabled,
} from "@/hooks/use-service-proxy.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The device's consent to the proxy for services a browser cannot call
 * directly (Fio, MONETA). Shown in the native app too, with a note that it
 * calls the banks directly and never uses the proxy. Changing it takes
 * `admin` (service-proxy/0001), as the AI data access does.
 */
export function ServiceProxyCard() {
  const { t } = useTranslation()
  const enabled = useServiceProxyEnabled()
  const setEnabled = useSetServiceProxyEnabled()
  const { require } = useRequirePermission()
  const Icon = enabled ? PowerOff : Power

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.privacy.serviceProxy.title")}</CardTitle>
        <CardDescription>
          {t("settings.privacy.serviceProxy.description")}
        </CardDescription>
        {Capacitor.isNativePlatform() ? (
          <CardDescription>
            {t("settings.privacy.serviceProxy.nativeNote")}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <Badge variant={enabled ? "secondary" : "outline"}>
          {enabled
            ? t("settings.privacy.serviceProxy.enabled")
            : t("settings.privacy.serviceProxy.disabled")}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          // On or off, it decides where the bank tokens go, on a `free` page.
          onClick={() => {
            void (async () => {
              if (await require("admin", "access.action.serviceProxy")) {
                setEnabled(!enabled)
              }
            })()
          }}
        >
          <Icon data-icon="inline-start" />
          {enabled
            ? t("settings.privacy.serviceProxy.disable")
            : t("settings.privacy.serviceProxy.enable")}
        </Button>
      </CardContent>
    </Card>
  )
}
