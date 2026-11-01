import { createEvoluExportFilename } from "@payky/app-shared/evolu-export"
import { useAtomValue } from "jotai"
import Download from "lucide-react-native/icons/download"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Platform } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { evoluAtom } from "../../../atoms/evolu.ts"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
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
import { Icon } from "../../../components/ui/icon.tsx"
import { appBrand } from "../../../core/app-brand.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { createExportFolder, evoluExportShareIo } from "./evolu-export-io"
import { shareEvoluExport } from "./evolu-export-share.ts"

const warningKeys = [
  "settings.evoluExport.warning.businessData",
  "settings.evoluExport.warning.payments",
  "settings.evoluExport.warning.walletMetadata",
  "settings.evoluExport.warning.localConfiguration",
  "settings.evoluExport.warning.secrets",
] as const

/** Exports the active account's app database through the system share sheet, like web's Evolu Export. */
export function EvoluExportPage() {
  const { t } = useTranslation()
  const evolu = useAtomValue(evoluAtom)
  const toast = useToast()
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
        toast.error(t("settings.evoluExport.status.error"))
        return
      }
      // expo-sharing resolves the same for a completed share and a dismissed
      // chooser, so show a neutral status instead of success (the toast has no
      // neutral variant).
      setHandedOff(true)
    } catch {
      // The error can name paths; the screen shows only the generic failure.
      setFailed(true)
      toast.error(t("settings.evoluExport.status.error"))
    } finally {
      setPending(false)
    }
  }

  return (
    <Screen>
      <FadeHeader title={t("settings.evoluExport.title")} />
      <YStack gap="4">
        <Card>
          <CardHeader>
            <XStack gap="3" items="flex-start">
              <Icon icon={TriangleAlert} color="destructive" />
              <YStack gap="1" flex={1}>
                <CardTitle>{t("settings.evoluExport.warning.title")}</CardTitle>
                <CardDescription>
                  {t("settings.evoluExport.warning.description")}
                </CardDescription>
              </YStack>
            </XStack>
          </CardHeader>
          <CardContent>
            <YStack gap="1" pl="5">
              {warningKeys.map((key) => (
                <Text
                  key={key}
                  color="muted-foreground"
                  fontSize="sm"
                  lineHeight="sm"
                >
                  {`• ${t(key)}`}
                </Text>
              ))}
            </YStack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.evoluExport.options.title")}</CardTitle>
            <CardDescription>
              {t("settings.evoluExport.options.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>
                  {t("settings.evoluExport.options.format")}
                </FieldLegend>
                <XStack items="center" gap="2">
                  <Badge
                    variant="secondary"
                    label={t("settings.evoluExport.format.sqlite")}
                  />
                  <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
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
          </CardContent>
          <CardFooter flexDirection="column" items="stretch" gap="3">
            <Text color="muted-foreground" aria-live="polite">
              {t(
                Platform.OS === "web"
                  ? "settings.evoluExport.destination.web"
                  : "settings.evoluExport.destination.capacitor"
              )}
            </Text>
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

        {/* A browser shows its own download; the share-sheet note fits only native. */}
        {(handedOff && Platform.OS !== "web") || failed ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.evoluExport.status.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {failed ? (
                <Text color="destructive" role="alert">
                  {t("settings.evoluExport.status.error")}
                </Text>
              ) : (
                <Text color="muted-foreground">
                  {t("settings.evoluExport.status.handedOff")}
                </Text>
              )}
            </CardContent>
          </Card>
        ) : null}
      </YStack>
    </Screen>
  )
}
