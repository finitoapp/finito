import { setSelfPayRelayActive } from "@payky/core/modules/table-self-pay/table-self-pay-actions"
import { selfPayPublishResultsQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  findNewestPublishOfEachView,
  findRelaysThatRefusedLastPublish,
} from "@payky/core/modules/table-self-pay/table-self-pay-reach-utils"
import {
  parseSelfPayRelay,
  type SelfPayRelaySetting,
} from "@payky/core/modules/table-self-pay/table-self-pay-relay-utils"
import { Plus, TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { appEnv } from "@/core/app-env.ts"
import { useSelfPayRelays } from "@/features/shared/use-self-pay-relays.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

export function SelfPayRelayCard() {
  const { t } = useTranslation()
  const { relays } = useSelfPayRelays()
  const activeCount = relays.filter((relay) => relay.isActive).length
  const { data: publishResults } = useEvoluQuery(selfPayPublishResultsQuery)
  const refusedRelays = findRelaysThatRefusedLastPublish(
    findNewestPublishOfEachView(publishResults)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.security.selfPayRelays.title")}</CardTitle>
        <CardDescription>
          {t("settings.security.selfPayRelays.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          <ul className="divide-y rounded-lg border">
            {relays.map((relay) => (
              <SelfPayRelayItem
                key={relay.url}
                relay={relay}
                isLastActive={relay.isActive && activeCount === 1}
                refusedLastPublish={refusedRelays.has(relay.url)}
              />
            ))}
          </ul>
          {activeCount === 1 ? (
            <p className="-mt-3 text-xs text-muted-foreground">
              {t("settings.security.selfPayRelays.lastActive")}
            </p>
          ) : null}
          <SelfPayRelayAddForm />
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          {t("settings.security.selfPayRelays.footer")}
        </p>
      </CardFooter>
    </Card>
  )
}

function SelfPayRelayItem({
  relay,
  isLastActive,
  refusedLastPublish,
}: {
  readonly relay: SelfPayRelaySetting
  readonly isLastActive: boolean
  readonly refusedLastPublish: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const scheme = "wss://"
  const host = relay.url.startsWith(scheme)
    ? relay.url.slice(scheme.length)
    : relay.url

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p
          className={cn(
            "font-mono text-sm font-medium break-all",
            !relay.isActive && "text-muted-foreground"
          )}
        >
          {host}
        </p>
        {relay.isDefault ? (
          <Badge variant="secondary">
            {t("settings.security.selfPayRelays.default")}
          </Badge>
        ) : null}
        {refusedLastPublish ? (
          <Badge variant="destructive" className="dark:text-red-300">
            <TriangleAlertIcon data-icon="inline-start" />
            {t("settings.security.selfPayRelays.refused")}
          </Badge>
        ) : null}
      </div>
      <Switch
        aria-label={t("settings.security.selfPayRelays.toggle", {
          url: relay.url,
        })}
        checked={relay.isActive}
        disabled={isLastActive}
        onCheckedChange={(checked) => {
          void runToast(async (run) => {
            await run.ok(
              setSelfPayRelayActive({
                url: relay.url,
                isActive: checked,
              })
            )
          })
        }}
      />
    </li>
  )
}

function SelfPayRelayAddForm() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const urlInputId = useId()
  const [url, setUrl] = useState("")
  const [isInvalid, setIsInvalid] = useState(false)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const relay = parseSelfPayRelay(url)
        if (relay === null) {
          setIsInvalid(true)
          return
        }
        setUrl("")
        void runToast(async (run) => {
          await run.ok(setSelfPayRelayActive({ url: relay, isActive: true }))
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={isInvalid}>
          <FieldLabel htmlFor={urlInputId}>
            {t("settings.security.selfPayRelays.url.label")}
          </FieldLabel>
          <Input
            id={urlInputId}
            value={url}
            aria-invalid={isInvalid}
            autoComplete="off"
            inputMode="url"
            placeholder={appEnv.VITE_PAYKY_SELF_PAY_RELAYS[0]}
            onChange={(event) => {
              setUrl(event.currentTarget.value)
              setIsInvalid(false)
            }}
          />
          <FieldDescription>
            {t("settings.security.selfPayRelays.url.description")}
          </FieldDescription>
          <FieldError>
            {isInvalid
              ? t("settings.security.selfPayRelays.url.invalid")
              : null}
          </FieldError>
        </Field>
      </FieldGroup>
      <div className="mt-4 flex justify-end">
        <Button type="submit">
          <Plus data-icon="inline-start" />
          {t("settings.security.selfPayRelays.add")}
        </Button>
      </div>
    </form>
  )
}
