import { fetchLnurlVerify } from "@payky/core/integrations/lnurl/lnurl-pay-client"
import { router, useLocalSearchParams } from "expo-router"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Linking } from "react-native"
import { Text, YStack } from "tamagui"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { QrCode } from "../../../components/qr-code.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SuccessPanel } from "../../../components/success-panel.tsx"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useAsyncValue } from "../../../hooks/use-async-value.ts"
import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, shape } from "../../../theme/tokens.ts"

const VERIFY_POLL_INTERVAL_MS = 2_000

// Falls back to "" (read as "nothing given") instead of throwing on a stale
// or hand-typed link; a verify URL must be an https URL.
const InvoiceParamsSchema = z.object({
  invoice: z.string().trim().min(1).catch(""),
  verify: z
    .string()
    .trim()
    .refine(
      (value) => z.url({ protocol: /^https$/u }).safeParse(value).success,
      "Expected a valid verify URL."
    )
    .catch(""),
})

/** The route: the invoice and its LNURL verify URL come from the amount page. */
export function DonationsInvoiceRoute() {
  const params = useLocalSearchParams<{ invoice?: string; verify?: string }>()
  const { invoice, verify } = InvoiceParamsSchema.parse({
    invoice: params.invoice ?? "",
    verify: params.verify ?? "",
  })
  return <DonationsInvoiceSettingsPage invoice={invoice} verify={verify} />
}

function DonationsInvoiceSettingsPage({
  invoice,
  verify,
}: {
  readonly invoice: string
  readonly verify: string
}) {
  const appRun = useAppRun()
  const copy = useCopyToClipboard()
  const { t } = useTranslation()
  const canVerify = invoice.length > 0 && verify.length > 0

  const verification = useAsyncValue(
    canVerify ? `donation-verify:${verify}` : null,
    async () => {
      await using run = appRun()
      const result = await run(fetchLnurlVerify({ verifyUrl: verify }))
      if (!result.ok) throw new Error("Failed to verify donation invoice")
      return result.value
    },
    {
      refetchMs: VERIFY_POLL_INTERVAL_MS,
      done: (data) => data.settled,
    }
  )
  const paid = verification.data?.settled === true

  if (paid) {
    return (
      <Screen>
        <FadeHeader title={t("settings.donations.title")} />
        <Card>
          <CardContent>
            <YStack minH={448} items="center" justify="center">
              <SuccessPanel
                title={t("settings.donations.invoice.verify.paid")}
                description={t(
                  "settings.donations.invoice.verify.paid.description"
                )}
                actions={
                  <Button
                    size="lg"
                    flex={1}
                    label={t("settings.donations.invoice.backToSettings")}
                    onPress={() => router.dismissTo("/settings")}
                  />
                }
              />
            </YStack>
          </CardContent>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.donations.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.donations.invoice.title")}</CardTitle>
          <CardDescription>
            {invoice.length === 0
              ? t("settings.donations.invoice.missing")
              : t("settings.donations.invoice.description")}
          </CardDescription>
        </CardHeader>
        {invoice.length > 0 ? (
          <CardContent>
            <YStack items="center" gap={16}>
              <YStack
                w="100%"
                aspectRatio={1}
                items="center"
                justify="center"
                rounded={shape.control}
                bg="neutral-soft"
                p={16}
                style={{ backgroundColor: "#fff" }}
                aria-label={invoice}
              >
                <QrCode value={invoice} />
              </YStack>
              {/* Polling goes on after a failure, so it needs no retry. */}
              {!canVerify ? null : verification.failed ? (
                <YStack w="100%">
                  <Alert variant="destructive" icon={TriangleAlert}>
                    <AlertDescription>
                      {t("settings.donations.invoice.verify.error")}
                    </AlertDescription>
                  </Alert>
                </YStack>
              ) : (
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  color="muted-foreground"
                  aria-live="polite"
                >
                  {t("settings.donations.invoice.verify.waiting")}
                </Text>
              )}
              <Button
                label={t("settings.donations.invoice.copy")}
                variant="outline"
                onPress={() =>
                  void copy(invoice, {
                    copied: t("settings.donations.invoice.copied"),
                    failed: t("settings.donations.invoice.copyFailed"),
                  })
                }
              />
            </YStack>
          </CardContent>
        ) : null}
      </Card>
      {/* The screen's main action, full width below the card. */}
      {invoice.length > 0 ? (
        <Button
          size="lg"
          label={t("settings.donations.invoice.openWallet")}
          onPress={() => {
            void Linking.openURL(`lightning:${invoice}`)
          }}
        />
      ) : null}
    </Screen>
  )
}
