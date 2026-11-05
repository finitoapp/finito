import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import { CircleCheck, Circle as CircleIcon } from "lucide-react"
import { type ComponentType, useId } from "react"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  BillsIllustration,
  NumpadIllustration,
} from "@/features/onboarding/onboarding-steps/selling-mode-illustrations.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

const sellingModes = {
  numpad: {
    title: "onboarding.selling.numpad.title",
    description: "onboarding.selling.numpad.description",
    Illustration: NumpadIllustration,
  },
  pos: {
    title: "onboarding.selling.pos.title",
    description: "onboarding.selling.pos.description",
    Illustration: BillsIllustration,
  },
} as const satisfies Record<
  TerminalHomeMode,
  {
    readonly title: TranslationKey
    readonly description: TranslationKey
    readonly Illustration: ComponentType
  }
>

/**
 * Onboarding's last step for a new account (onboarding/0012): how the
 * business sells, the keypad's final amount or bills built from items, as
 * two pictured choices of which neither is picked until the merchant picks
 * one, and whether customers may add a tip, on unless switched off. The
 * choice becomes the one mode home offers.
 */
export function SellingStep({
  homeMode,
  tipsEnabled,
  pending,
  onHomeModeChange,
  onTipsEnabledChange,
}: {
  readonly homeMode: TerminalHomeMode | null
  readonly tipsEnabled: boolean
  readonly pending: boolean
  readonly onHomeModeChange: (mode: TerminalHomeMode) => void
  readonly onTipsEnabledChange: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const tipsId = useId()

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label={t("onboarding.selling.title")}
        className="grid grid-cols-2 gap-3"
      >
        {terminalHomeModes.map((mode) => {
          const { title, description, Illustration } = sellingModes[mode]
          const selected = homeMode === mode
          return (
            // biome-ignore lint/a11y/useSemanticElements: a pictured card, not a bare radio input
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => onHomeModeChange(mode)}
              className={cn(
                "relative flex flex-col gap-3 rounded-xl border bg-muted/40 p-3 text-left transition-colors hover:bg-muted disabled:opacity-50",
                selected &&
                  "border-primary bg-primary/10 hover:bg-primary/15 dark:bg-primary/15"
              )}
            >
              <div className="flex aspect-[160/112] w-full items-center justify-center">
                <Illustration />
              </div>
              {selected ? (
                <CircleCheck className="absolute top-2 right-2 size-5 text-primary" />
              ) : (
                <CircleIcon className="absolute top-2 right-2 size-5 text-muted-foreground" />
              )}
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{t(title)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(description)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <Field orientation="horizontal">
        <Switch
          id={tipsId}
          checked={tipsEnabled}
          disabled={pending}
          onCheckedChange={onTipsEnabledChange}
        />
        <FieldContent>
          <FieldLabel htmlFor={tipsId}>
            {t("onboarding.selling.tips.label")}
          </FieldLabel>
          <FieldDescription>
            {t("onboarding.selling.tips.description")}
          </FieldDescription>
        </FieldContent>
      </Field>
    </div>
  )
}
