import { Capacitor } from "@capacitor/core"
import {
  createEvoluExportFilename,
  formatBytes,
  formatExportCreatedAt,
} from "@payky/app-shared/evolu-export"
import { AlertTriangle, Database, Download, Smartphone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { FadeHeader } from "@/components/fade-header.tsx"
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
import { Checkbox } from "@/components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field.tsx"
import { appBrand } from "@/core/app-brand.ts"
import {
  type SavedEvoluExportFile,
  saveEvoluExportFile,
} from "@/features/settings/evolu-export/evolu-export-utils.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

interface ExportState {
  readonly createdAt: Date
  readonly files: ReadonlyArray<SavedEvoluExportFile>
}

type ExportStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "error"; readonly message: string }

export function EvoluExportPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.evoluExport.title")} />
      <div className="mt-8">
        <EvoluExportPanel />
      </div>
    </>
  )
}

function EvoluExportPanel() {
  const { t } = useTranslation()
  const appEvolu = useEvolu()
  const [acceptedWarning, setAcceptedWarning] = useState(false)
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle" })
  const [lastExport, setLastExport] = useState<ExportState | null>(null)
  const canExport = acceptedWarning && status.kind !== "pending"

  const handleExport = async () => {
    if (!canExport) return

    const createdAt = new Date()
    setStatus({ kind: "pending" })

    try {
      const file = await saveEvoluExportFile({
        database: "app",
        bytes: await appEvolu.exportDatabase(),
        filename: createEvoluExportFilename({
          brand: appBrand,
          createdAt,
          database: "app",
        }),
      })

      if (file === null) {
        setStatus({ kind: "idle" })
        return
      }

      setLastExport({ createdAt, files: [file] })
      setStatus({ kind: "idle" })
      toast.success(t("settings.evoluExport.status.success"))
    } catch (exportError) {
      setStatus({ kind: "error", message: formatExportError(exportError) })
      toast.error(t("settings.evoluExport.status.error"))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-destructive" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("settings.evoluExport.warning.title")}</CardTitle>
              <CardDescription>
                {t("settings.evoluExport.warning.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>{t("settings.evoluExport.warning.businessData")}</li>
            <li>{t("settings.evoluExport.warning.payments")}</li>
            <li>{t("settings.evoluExport.warning.walletMetadata")}</li>
            <li>{t("settings.evoluExport.warning.localConfiguration")}</li>
            <li>{t("settings.evoluExport.warning.secrets")}</li>
          </ul>
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
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {t("settings.evoluExport.format.sqlite")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t("settings.evoluExport.format.description")}
                </span>
              </div>
            </FieldSet>

            <Field orientation="horizontal">
              <Checkbox
                id="evolu-export-warning"
                checked={acceptedWarning}
                onCheckedChange={(checked) => {
                  setAcceptedWarning(checked === true)
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor="evolu-export-warning">
                  {t("settings.evoluExport.confirm.label")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.evoluExport.confirm.description")}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {Capacitor.isNativePlatform()
              ? t("settings.evoluExport.destination.capacitor")
              : t("settings.evoluExport.destination.web")}
          </p>
          <Button type="button" onClick={handleExport} disabled={!canExport}>
            <Download data-icon="inline-start" />
            {status.kind === "pending"
              ? t("settings.evoluExport.action.pending")
              : t("settings.evoluExport.action")}
          </Button>
        </CardFooter>
      </Card>

      {lastExport || status.kind === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.evoluExport.status.title")}</CardTitle>
            <CardDescription>
              {status.kind === "error"
                ? t("settings.evoluExport.status.error")
                : lastExport
                  ? t("settings.evoluExport.status.createdAt", {
                      createdAt: formatExportCreatedAt(lastExport.createdAt),
                    })
                  : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {status.kind === "error" ? (
              <p className="text-sm text-destructive">{status.message}</p>
            ) : null}
            {lastExport?.files.map((file) => (
              <ExportedFileRow
                key={`${file.database}:${file.filename}`}
                file={file}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ExportedFileRow({ file }: { readonly file: SavedEvoluExportFile }) {
  const { t } = useTranslation()
  const Icon = file.destination.type === "capacitor" ? Smartphone : Database

  return (
    <article className="rounded-md border bg-muted/20 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {t("settings.evoluExport.database.app")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatBytes(file.bytes.byteLength)}
            </span>
          </div>
          <p className="break-all font-mono text-xs">{file.filename}</p>
        </div>
      </div>
    </article>
  )
}

function formatExportError(error: unknown): string {
  if (error instanceof Error) return error.message

  return String(error)
}
