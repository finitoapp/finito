import type { DeviceAccountId } from "@payky/core/evolu/device-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { TransportAddForm } from "@/features/shared/evolu-transports/transport-add-form.tsx"
import { TransportToggleList } from "@/features/shared/evolu-transports/transport-toggle-list.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

interface EvoluTransportCardProps {
  readonly accountId: DeviceAccountId
  /** A demo account never syncs, so its relays cannot be switched on. */
  readonly isDemo: boolean
}

export function EvoluTransportCard({
  accountId,
  isDemo,
}: EvoluTransportCardProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.security.transports.title")}</CardTitle>
        <CardDescription>
          {t("settings.security.transports.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          {isDemo ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.security.transports.demo")}
            </p>
          ) : null}
          <TransportToggleList accountId={accountId} disabled={isDemo} />
          {isDemo ? null : <TransportAddForm accountId={accountId} />}
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          {t("settings.security.transports.footer")}
        </p>
      </CardFooter>
    </Card>
  )
}
