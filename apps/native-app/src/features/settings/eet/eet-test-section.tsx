import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  EetDeliveryOutcome,
  EetSubmission,
} from "@payky/core/integrations/eet/eet-client"
import { sendEetTestMessage } from "@payky/core/modules/eet/eet-actions"
import type {
  EetConfigurationGap,
  EetEnvironment,
} from "@payky/core/modules/eet/eet-types"
import { useAtomValue } from "jotai"
import PlugZap from "lucide-react-native/icons/plug-zap"
import Receipt from "lucide-react-native/icons/receipt"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

type EetTestKind = "verification" | "sale"

const outcomeTitleKeys = {
  accepted: "settings.eet.test.outcome.accepted",
  verified: "settings.eet.test.outcome.verified",
  retry: "settings.eet.test.outcome.failed",
  rejected: "settings.eet.test.outcome.failed",
} satisfies Record<EetDeliveryOutcome["type"], TranslationKey>

/**
 * Sends a verification or (sandbox only) a test sale and shows what EET
 * answered. Never touches a real sale, so a failure here cannot block checkout.
 */
export function EetTestSection({
  environment,
  gaps,
}: {
  readonly environment: EetEnvironment
  readonly gaps: ReadonlyArray<EetConfigurationGap>
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const deviceId = useAtomValue(accountAtom).device.id
  const [pending, setPending] = useState(false)
  const [submission, setSubmission] = useState<EetSubmission | null>(null)
  const canSend = gaps.length === 0 && !pending

  const send = async (kind: EetTestKind) => {
    setPending(true)
    setSubmission(null)
    await runToast(async (run) => {
      const result = await run(sendEetTestMessage({ kind, deviceId }))
      if (!result.ok) return "settings.eet.test.unavailable"
      setSubmission(result.value)
      return undefined
    })
    setPending(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.eet.test.title")}</CardTitle>
        <CardDescription>{t("settings.eet.test.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <YStack gap="4">
          <XStack gap="2" flexWrap="wrap">
            <Button
              label={t("settings.eet.test.connection")}
              variant="outline"
              iconStart={PlugZap}
              disabled={!canSend}
              pending={pending}
              onPress={() => {
                void send("verification")
              }}
            />
            {environment === "playground" ? (
              <Button
                label={t("settings.eet.test.sale")}
                variant="outline"
                iconStart={Receipt}
                disabled={!canSend}
                onPress={() => {
                  void send("sale")
                }}
              />
            ) : null}
          </XStack>
          {submission === null ? null : (
            <EetTestResult submission={submission} />
          )}
        </YStack>
      </CardContent>
    </Card>
  )
}

function EetTestResult({ submission }: { readonly submission: EetSubmission }) {
  const { t } = useTranslation()
  const { outcome } = submission
  const isSuccess = outcome.type === "accepted" || outcome.type === "verified"

  return (
    <YStack
      gap="2"
      p="3"
      rounded="lg"
      bg="neutral-soft"
      testID="eet-test-result"
    >
      <Text fontWeight="700" color={isSuccess ? "success" : "destructive"}>
        {t(outcomeTitleKeys[outcome.type])}
      </Text>
      {outcome.type === "accepted" ? (
        <Text fontSize="xs" lineHeight="xs" testID="eet-test-pok">
          {t("settings.eet.test.pok", { pok: outcome.pok })}
        </Text>
      ) : null}
      {outcome.type === "retry" || outcome.type === "rejected" ? (
        <Text>
          {outcome.code === null
            ? outcome.message
            : t("settings.eet.test.errorCode", {
                code: String(outcome.code),
                message: outcome.message,
              })}
        </Text>
      ) : null}
      <RawMessage
        label={t("settings.eet.test.rawRequest")}
        value={submission.rawRequest}
      />
      <RawMessage
        label={t("settings.eet.test.rawResponse")}
        value={submission.rawResponse}
      />
    </YStack>
  )
}

/** A collapsed XML message, selectable once opened. */
function RawMessage({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | null
}) {
  if (value === null) return null

  return (
    <Collapsible>
      <CollapsibleTrigger flexDirection="row" items="center" gap="1">
        <Text
          fontSize="xs"
          lineHeight="xs"
          fontWeight="600"
          color="muted-foreground"
        >
          {label}
        </Text>
        <CollapsibleChevron size={14} color="muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent
        mt="2"
        maxH={256}
        overflow="scroll"
        rounded="md"
        bg="muted"
        p="2"
      >
        <Text fontSize={11} userSelect="text">
          {value}
        </Text>
      </CollapsibleContent>
    </Collapsible>
  )
}
