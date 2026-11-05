import {
  type OpenAccountSource,
  openAccountChoiceCopy,
  openAccountChoices,
} from "@payky/app-shared/open-account"
import { KeyRound, QrCode, Smartphone } from "lucide-react"
import { VerticalNav } from "@/components/vertical-nav.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

const choiceIcons = {
  fromPayky: Smartphone,
  transfer: QrCode,
  phrase: KeyRound,
} satisfies Record<OpenAccountSource, typeof KeyRound>

/**
 * Where the account is now (onboarding/0011): another device, or the
 * recovery phrase, easiest first. Web has no app-to-app source
 * (account/0008), so Payky is never offered here. A signpost: picking a row
 * leaves for that way at once.
 */
export function OpenAccountChoice({
  pending,
  className,
  onSelect,
}: {
  readonly pending: boolean
  readonly className?: string
  readonly onSelect: (source: OpenAccountSource) => void
}) {
  const { t } = useTranslation()

  return (
    <VerticalNav
      className={className}
      items={openAccountChoices({ canRequestFromPayky: false }).map(
        (source) => {
          const Icon = choiceIcons[source]
          return {
            id: source,
            kind: "button" as const,
            icon: <Icon className="text-muted-foreground" />,
            label: (
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  {t(openAccountChoiceCopy[source].title)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {t(openAccountChoiceCopy[source].description)}
                </span>
              </span>
            ),
            onClick: () => {
              if (pending) return
              onSelect(source)
            },
          }
        }
      )}
    />
  )
}
