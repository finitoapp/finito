import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import {
  disableEet,
  type EetProductionUnavailableError,
  type EetTestCertificateBlocksProductionError,
  enableEet,
  saveEetEstablishmentId,
  saveEetTipOwner,
  selectEetEnvironment,
} from "@payky/core/modules/eet/eet-actions"
import {
  type EetConfigurationGap,
  type EetEnvironment,
  type EetEstablishmentId,
  EetEstablishmentIdSchema,
  type EetTipOwner,
} from "@payky/core/modules/eet/eet-types"
import { findEetConfigurationGaps } from "@payky/core/modules/eet/eet-utils"
import {
  FlaskConicalIcon,
  LandmarkIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { FadeHeader } from "@/components/fade-header.tsx"
import { OptionToggleGroup } from "@/components/option-toggle-group.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field.tsx"
import { EetCertificateCard } from "@/features/settings/eet/eet-certificate-card.tsx"
import { EetTestCard } from "@/features/settings/eet/eet-test-card.tsx"
import { EetUnconfirmedSalesCard } from "@/features/settings/eet/eet-unconfirmed-sales-card.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { InlineEditToggleGroup } from "@/features/shared/forms/inline-edit-toggle-group.tsx"
import { useEetSettings } from "@/features/shared/use-eet-settings.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const establishmentIdCodec = z.codec(
  z.string(),
  EetEstablishmentIdSchema.nullable(),
  {
    decode: (value) => value.trim(),
    encode: (value) => value ?? "",
  }
)

const configurationGapKeys = {
  certificate: "settings.eet.gap.certificate",
  certificateExpired: "settings.eet.gap.certificateExpired",
  establishment: "settings.eet.gap.establishment",
} satisfies Record<EetConfigurationGap, TranslationKey>

const environmentErrorKeys = {
  EetProductionUnavailableError:
    "settings.eet.environment.productionUnavailable",
  EetTestCertificateBlocksProductionError:
    "settings.eet.environment.testCertificateBlocksProduction",
} satisfies Record<
  (
    | EetProductionUnavailableError
    | EetTestCertificateBlocksProductionError
  )["type"],
  TranslationKey
>

export function EetSettingsPage() {
  const { t } = useTranslation()
  const eet = useEetSettings()
  const now = useNow([eet.settings?.validTo ?? null])
  const gaps = findEetConfigurationGaps({
    validTo: eet.settings?.validTo ?? null,
    establishmentId: eet.settings?.establishmentId ?? null,
    now,
  })

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.eet.title")} />
      <div className="flex flex-col gap-5">
        <EetReportingCard
          establishmentId={eet.settings?.establishmentId ?? null}
          isEnabled={eet.isEnabled}
          gaps={gaps}
        />
        <EetTipCard tipOwner={eet.tipOwner} />
        <EetEnvironmentCard
          environment={eet.environment}
          isProductionAvailable={eet.isProductionAvailable}
          isTestCertificate={eet.isTestCertificate}
        />
        <EetCertificateCard environment={eet.environment} />
        <EetTestCard environment={eet.environment} gaps={gaps} />
        <EetUnconfirmedSalesCard />
      </div>
    </>
  )
}

function EetReportingCard({
  establishmentId,
  isEnabled,
  gaps,
}: {
  readonly establishmentId: EetEstablishmentId | null
  readonly isEnabled: boolean
  readonly gaps: ReadonlyArray<EetConfigurationGap>
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const cannotEnable = !isEnabled && gaps.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.eet.reporting.title")}</CardTitle>
        <CardDescription>
          {t("settings.eet.reporting.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <InlineEditField
            label={t("settings.eet.establishment.label")}
            description={t("settings.eet.establishment.description")}
            inputMode="numeric"
            defaultValue={establishmentId}
            codec={establishmentIdCodec}
            errorKey="settings.eet.establishment.invalid"
            onSave={async (next) => {
              if (next === null) return
              await using run = appRun()
              await run.ok(saveEetEstablishmentId(next))
            }}
          />
          <InlineEditSwitch
            label={t("settings.eet.enabled.label")}
            description={
              cannotEnable
                ? t("settings.eet.enabled.missing", {
                    missing: gaps
                      .map((gap) => t(configurationGapKeys[gap]))
                      .join(", "),
                  })
                : t("settings.eet.enabled.description")
            }
            defaultValue={isEnabled}
            disabled={cannotEnable}
            onSave={async (checked) => {
              await using run = appRun()
              if (!checked) {
                await run.ok(disableEet())
                return undefined
              }
              const result = await run(enableEet())
              return result.ok ? undefined : "settings.eet.enabled.incomplete"
            }}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function EetTipCard({ tipOwner }: { readonly tipOwner: EetTipOwner }) {
  const { t } = useTranslation()
  const appRun = useAppRun()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.eet.tip.title")}</CardTitle>
        <CardDescription>{t("settings.eet.tip.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <InlineEditToggleGroup<EetTipOwner>
          label={t("settings.eet.tip.label")}
          description={t("settings.eet.tip.note")}
          defaultValue={tipOwner}
          options={[
            {
              value: "business",
              icon: StoreIcon,
              title: t("settings.eet.tip.business.title"),
              description: t("settings.eet.tip.business.description"),
            },
            {
              value: "employees",
              icon: UsersIcon,
              title: t("settings.eet.tip.employees.title"),
              description: t("settings.eet.tip.employees.description"),
            },
          ]}
          onSave={async (next) => {
            await using run = appRun()
            await run.ok(saveEetTipOwner(next))
          }}
        />
      </CardContent>
    </Card>
  )
}

function EetEnvironmentCard({
  environment,
  isProductionAvailable,
  isTestCertificate,
}: {
  readonly environment: EetEnvironment
  readonly isProductionAvailable: boolean
  readonly isTestCertificate: boolean
}) {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const runToast = useRunToast()
  const [pending, setPending] = useState(false)

  const productionDescription = !isProductionAvailable
    ? t("settings.eet.environment.productionUnavailable")
    : isTestCertificate
      ? t("settings.eet.environment.testCertificateBlocksProduction")
      : t("settings.eet.environment.production.description")

  const select = async (next: EetEnvironment) => {
    if (next === environment) return
    if (next === "playground") {
      const confirmed = await confirm({
        title: t("settings.eet.environment.sandboxConfirm.title"),
        description: t("settings.eet.environment.sandboxConfirm.description"),
        confirmLabel: t("settings.eet.environment.sandboxConfirm.confirm"),
        cancelLabel: t("settings.eet.environment.sandboxConfirm.cancel"),
      })
      if (!confirmed) return
    }

    setPending(true)
    const saved = await runToast(async (run) => {
      const result = await run(selectEetEnvironment(next))
      return result.ok ? undefined : environmentErrorKeys[result.error.type]
    })
    setPending(false)
    if (saved) toast.success(t("settings.eet.environment.saved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.eet.environment.title")}</CardTitle>
        <CardDescription>
          {t("settings.eet.environment.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel className="sr-only">
            {t("settings.eet.environment.title")}
          </FieldLabel>
          <OptionToggleGroup<EetEnvironment>
            value={environment}
            disabled={pending}
            options={[
              {
                value: "production",
                icon: LandmarkIcon,
                title: t("settings.eet.environment.production.title"),
                description: productionDescription,
              },
              {
                value: "playground",
                icon: FlaskConicalIcon,
                title: t("settings.eet.environment.playground.title"),
                description: t(
                  "settings.eet.environment.playground.description"
                ),
              },
            ]}
            onChange={(next) => {
              void select(next)
            }}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
