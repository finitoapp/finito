import { createEvoluExportFilename } from "@payky/app-shared/evolu-export"
import { useAtomValue } from "jotai"
import Download from "lucide-react-native/icons/download"
import Info from "lucide-react-native/icons/info"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Platform } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { evoluAtom } from "../../../atoms/evolu.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
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
import { Checkbox } from "../../../components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../../components/ui/field.tsx"
import { appBrand } from "../../../core/app-brand.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { createExportFolder, evoluExportShareIo } from "./evolu-export-io"
import { shareEvoluExport } from "./evolu-export-share.ts"

const warningKeys = [
  "settings.evoluExport.warning.businessData",
  "settings.evoluExport.warning.payments",
  "settings.evoluExport.warning.walletMetadata",
  "settings.evoluExport.warning.localConfiguration",
  "settings.evoluExport.warning.secrets",
] as const

/**
 * Exports the active account's app database through the system share sheet,
 * like web's Evolu Export. The outcome is reported once, as an `Alert` in the
 * export card, where web adds a toast and a status card.
 */
export function EvoluExportPage() {
  const { t } = useTranslation()
  const evolu = useAtomValue(evoluAtom)
  const { require } = useRequirePermission()
  const [acceptedWarning, setAcceptedWarning] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [handedOff, setHandedOff] = useState(false)

  const exportDatabase = async () => {
    if (!acceptedWarning || pending) return
    // Route access alone must not hand out the data: ask before serializing.
    if (!(await require("admin", "access.action.exportDatabase"))) return

    const createdAt = new Date()
    setPending(true)
    setFailed(false)
    setHandedOff(false)
    try {
      const bytes = await evolu.exportDatabase()
      const outcome = await shareEvoluExport({
        io: evoluExportShareIo,
        bytes,
        filename: createEvoluExportFilename({
          brand: appBrand,
          createdAt,
          database: "app",
        }),
        folder: createExportFolder(),
      })
      if (outcome === "unavailable") {
        setFailed(true)
        return
      }
      // expo-sharing resolves the same for a completed share and a dismissed
      // chooser, so the status is neutral (`info`), not a success.
      setHandedOff(true)
    } catch {
      // The error can name paths; the screen shows only the generic failure.
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.evoluExport.title")} />
      <Alert variant="destructive" icon={TriangleAlert}>
        <AlertTitle>{t("settings.evoluExport.warning.title")}</AlertTitle>
        <AlertDescription>
          {t("settings.evoluExport.warning.description")}
          <YStack gap={8} pl={20}>
            {warningKeys.map((key) => (
              <Text
                key={key}
                color="muted-foreground"
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
              >
                {`• ${t(key)}`}
              </Text>
            ))}
          </YStack>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.evoluExport.options.title")}</CardTitle>
          <CardDescription>
            {t("settings.evoluExport.options.description")}
          </CardDescription>
        </CardHeader>
        <CardContent gap={16}>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>
                {t("settings.evoluExport.options.format")}
              </FieldLegend>
              <XStack items="center" gap={8}>
                <Badge
                  variant="outline"
                  label={t("settings.evoluExport.format.sqlite")}
                />
                <Text
                  color="muted-foreground"
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                >
                  {t("settings.evoluExport.format.description")}
                </Text>
              </XStack>
            </FieldSet>

            <Field orientation="horizontal">
              <Checkbox
                checked={acceptedWarning}
                disabled={pending}
                aria-label={t("settings.evoluExport.confirm.label")}
                onCheckedChange={setAcceptedWarning}
              />
              <FieldContent>
                <FieldLabel>
                  {t("settings.evoluExport.confirm.label")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.evoluExport.confirm.description")}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
          <Text
            color="muted-foreground"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
          >
            {t(
              Platform.OS === "web"
                ? "settings.evoluExport.destination.web"
                : "settings.evoluExport.destination.capacitor"
            )}
          </Text>
          {failed ? (
            <Alert variant="destructive" icon={TriangleAlert}>
              <AlertTitle>{t("settings.evoluExport.status.error")}</AlertTitle>
            </Alert>
          ) : handedOff && Platform.OS !== "web" ? (
            // A browser shows its own download; the note fits only native.
            <Alert variant="info" icon={Info}>
              <AlertDescription>
                {t("settings.evoluExport.status.handedOff")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter justify="flex-end">
          <Button
            label={t(
              pending
                ? "settings.evoluExport.action.pending"
                : "settings.evoluExport.action"
            )}
            iconStart={Download}
            disabled={!acceptedWarning}
            pending={pending}
            onPress={() => void exportDatabase()}
          />
        </CardFooter>
      </Card>
    </Screen>
  )
}
