import type { EetCertificateFile } from "@payky/core/integrations/eet/eet-certificate"
import { fetchPlaygroundCertificates } from "@payky/core/integrations/eet/playground-certificates-client"
import { storeEetCertificate } from "@payky/core/modules/eet/eet-actions"
import { useQuery } from "@tanstack/react-query"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { apiUrl } from "../../../core/native-env.ts"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { eetNativeCrypto } from "../../../platform/eet-crypto"

/**
 * The sandbox's official test certificates, fetched only on request: the
 * response carries their archive password, so it is never cached beyond the
 * query and never logged (the core client leaves response bodies out of
 * its errors).
 */
export function EetOfficialTestCertificates() {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const runToast = useRunToast()
  const toast = useToast()
  const [requested, setRequested] = useState(false)
  const [storingEic, setStoringEic] = useState<string | null>(null)
  const certificatesQuery = useQuery({
    queryKey: ["eet", "playground-certificates"],
    enabled: requested,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      await using run = appRun()
      const result = await run(
        fetchPlaygroundCertificates(
          apiUrl("/api/eet/playground-certificates"),
          eetNativeCrypto
        )
      )
      if (!result.ok) throw result.error
      return result.value
    },
  })

  const store = async (certificate: EetCertificateFile) => {
    setStoringEic(certificate.eic)
    const saved = await runToast(async (run) => {
      await run.ok(
        storeEetCertificate({ certificate, isTestCertificate: true })
      )
    })
    setStoringEic(null)
    if (saved) toast.success(t("settings.eet.certificate.imported"))
  }

  if (!requested) {
    return (
      <YStack gap="2" p="3" rounded="lg" bg="neutral-soft">
        <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
          {t("settings.eet.officialTest.description")}
        </Text>
        <Button
          size="sm"
          label={t("settings.eet.officialTest.show")}
          variant="outline"
          onPress={() => setRequested(true)}
        />
      </YStack>
    )
  }

  if (certificatesQuery.isError) {
    return (
      <Alert variant="warning" icon={TriangleAlert}>
        <AlertTitle>
          {t("settings.eet.officialTest.unavailable.title")}
        </AlertTitle>
        <AlertDescription>
          {t("settings.eet.officialTest.unavailable.description")}
        </AlertDescription>
      </Alert>
    )
  }

  if (certificatesQuery.data === undefined) {
    return (
      <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
        {t("settings.eet.officialTest.loading")}
      </Text>
    )
  }

  return (
    <YStack gap="2">
      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
        {t("settings.eet.officialTest.title")}
      </Text>
      {certificatesQuery.data.map((certificate) => (
        <XStack
          key={certificate.eic}
          items="center"
          gap="3"
          p="3"
          rounded="lg"
          bg="neutral-soft"
        >
          <YStack flex={1}>
            <Text
              fontSize="sm"
              lineHeight="sm"
              fontWeight="600"
              style={{ fontFamily: "monospace" }}
            >
              {certificate.eic}
            </Text>
            {certificate.description === null ? null : (
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {certificate.description}
              </Text>
            )}
          </YStack>
          <Button
            size="sm"
            variant="default"
            label={t("settings.eet.officialTest.useShort")}
            aria-label={t("settings.eet.officialTest.use", {
              name: certificate.eic,
            })}
            disabled={storingEic !== null}
            pending={storingEic === certificate.eic}
            onPress={() => {
              void store(certificate)
            }}
          />
        </XStack>
      ))}
    </YStack>
  )
}
