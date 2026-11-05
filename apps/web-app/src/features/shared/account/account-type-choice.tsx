import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { LogIn, Plus } from "lucide-react"
import { VerticalNav } from "@/components/vertical-nav.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * A new account, or one the user already has; where that one is now is the
 * next question (`OpenAccountChoice`, onboarding/0011).
 */
export type AccountChoice = "new" | "existing"

interface AccountChoiceOption {
  readonly value: AccountChoice
  readonly label: TranslationKey
  readonly description: TranslationKey
  readonly icon: typeof Plus
}

const accountChoiceOptions: ReadonlyArray<AccountChoiceOption> = [
  {
    value: "new",
    label: "accountChoice.new.title",
    description: "accountChoice.new.description",
    icon: Plus,
  },
  {
    value: "existing",
    label: "accountChoice.existing.title",
    // Web has no app-to-app source (account/0008).
    description: "accountChoice.existing.description",
    icon: LogIn,
  },
]

/**
 * A signpost, not a selection: picking an option leaves it immediately, so
 * `VerticalNav` rather than a toggle group, which would show the previous
 * answer as pressed when the user comes back. Onboarding's account step and
 * Settings → Accounts both offer it.
 */
export function AccountTypeChoice({
  pending,
  title,
  className,
  onSelect,
}: {
  readonly pending: boolean
  readonly title?: string
  readonly className?: string
  readonly onSelect: (choice: AccountChoice) => void
}) {
  const { t } = useTranslation()

  return (
    <VerticalNav
      title={title}
      className={className}
      items={accountChoiceOptions.map((option) => {
        const Icon = option.icon

        return {
          id: option.value,
          kind: "button" as const,
          icon: <Icon className="text-muted-foreground" />,
          label: (
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t(option.label)}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {t(option.description)}
              </span>
            </span>
          ),
          onClick: () => {
            if (pending) return
            onSelect(option.value)
          },
        }
      })}
    />
  )
}
