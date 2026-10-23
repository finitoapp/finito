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
import Plus from "lucide-react-native/icons/plus"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { nativeEnv } from "../../../core/native-env.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { useSelfPayRelays } from "../../shared/use-self-pay-relays.ts"

/** The relays self-pay publishes through, as web's `SelfPayRelayCard`. */
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
        <YStack gap="5">
          <YStack
            rounded="lg"
            borderWidth={1}
            borderColor="border-color"
            overflow="hidden"
          >
            {relays.map((relay, index) => (
              <SelfPayRelayItem
                key={relay.url}
                relay={relay}
                first={index === 0}
                isLastActive={relay.isActive && activeCount === 1}
                refusedLastPublish={refusedRelays.has(relay.url)}
              />
            ))}
          </YStack>
          {activeCount === 1 ? (
            <Text
              mt={-12}
              fontSize="xs"
              lineHeight="xs"
              color="muted-foreground"
            >
              {t("settings.security.selfPayRelays.lastActive")}
            </Text>
          ) : null}
          <SelfPayRelayAddForm />
        </YStack>
      </CardContent>
      <CardFooter>
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {t("settings.security.selfPayRelays.footer")}
        </Text>
      </CardFooter>
    </Card>
  )
}

function SelfPayRelayItem({
  relay,
  first,
  isLastActive,
  refusedLastPublish,
}: {
  readonly relay: SelfPayRelaySetting
  readonly first: boolean
  readonly isLastActive: boolean
  readonly refusedLastPublish: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const choice = useInlineChoice(relay.isActive, (isActive) =>
    runToast(async (run) => {
      await run.ok(setSelfPayRelayActive({ url: relay.url, isActive }))
    })
  )
  const scheme = "wss://"
  const host = relay.url.startsWith(scheme)
    ? relay.url.slice(scheme.length)
    : relay.url

  return (
    <XStack
      testID={`self-pay-relay-${relay.url}`}
      items="center"
      justify="space-between"
      gap="3"
      p="3"
      borderTopWidth={first ? 0 : 1}
      borderColor="border-color"
    >
      <XStack flex={1} minW={0} flexWrap="wrap" items="center" gap="2">
        <Text
          fontSize="sm"
          lineHeight="sm"
          fontWeight="500"
          color={relay.isActive ? "color" : "muted-foreground"}
          style={{ fontFamily: "monospace" }}
        >
          {host}
        </Text>
        {relay.isDefault ? (
          <Badge
            variant="secondary"
            label={t("settings.security.selfPayRelays.default")}
          />
        ) : null}
        {refusedLastPublish ? (
          <Badge
            variant="destructive"
            icon={TriangleAlert}
            label={t("settings.security.selfPayRelays.refused")}
            testID="self-pay-relay-refused"
          />
        ) : null}
      </XStack>
      <Switch
        aria-label={t("settings.security.selfPayRelays.toggle", {
          url: relay.url,
        })}
        checked={choice.value}
        disabled={isLastActive}
        onCheckedChange={(checked) => {
          void choice.choose(checked)
        }}
      />
    </XStack>
  )
}

function SelfPayRelayAddForm() {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [url, setUrl] = useState("")
  const [isInvalid, setIsInvalid] = useState(false)

  const submit = () => {
    const relay = parseSelfPayRelay(url)
    if (relay === null) {
      setIsInvalid(true)
      return
    }
    setUrl("")
    void runToast(async (run) => {
      await run.ok(setSelfPayRelayActive({ url: relay, isActive: true }))
    })
  }

  return (
    <YStack gap="4">
      <FieldGroup>
        <Field>
          <FieldLabel>
            {t("settings.security.selfPayRelays.url.label")}
          </FieldLabel>
          <Input
            value={url}
            invalid={isInvalid}
            onChangeText={(next) => {
              setUrl(next)
              setIsInvalid(false)
            }}
            placeholder={nativeEnv.EXPO_PUBLIC_PAYKY_SELF_PAY_RELAYS[0]}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
          />
          <FieldDescription>
            {t("settings.security.selfPayRelays.url.description")}
          </FieldDescription>
          <FieldError>
            {isInvalid
              ? t("settings.security.selfPayRelays.url.invalid")
              : undefined}
          </FieldError>
        </Field>
      </FieldGroup>
      <XStack justify="flex-end">
        <Button
          label={t("settings.security.selfPayRelays.add")}
          iconStart={Plus}
          onPress={submit}
        />
      </XStack>
    </YStack>
  )
}
