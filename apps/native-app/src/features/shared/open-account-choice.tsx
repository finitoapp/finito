import { brandName, paykyBrand } from "@payky/app-shared/brand"
import {
  type OpenAccountSource,
  openAccountChoiceCopy,
  openAccountChoices,
} from "@payky/app-shared/open-account"
import type { LucideIcon } from "lucide-react-native"
import KeyRound from "lucide-react-native/icons/key-round"
import QrCode from "lucide-react-native/icons/qr-code"
import Smartphone from "lucide-react-native/icons/smartphone"
import { Text, YStack } from "tamagui"
import { Icon } from "../../components/ui/icon.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useCanRequestAccountFromPayky } from "./use-can-request-account-from-payky.ts"

const choiceIcons = {
  fromPayky: Smartphone,
  transfer: QrCode,
  phrase: KeyRound,
} satisfies Record<OpenAccountSource, LucideIcon>

/**
 * Where the account is now (onboarding/0011): Payky on this phone when it
 * was detected, another device, the recovery phrase — easiest first. A
 * signpost: picking a row leaves for that way at once.
 */
export function OpenAccountChoice({
  disabled = false,
  onSelect,
}: {
  readonly disabled?: boolean
  readonly onSelect: (source: OpenAccountSource) => void
}) {
  const { t } = useTranslation()
  const canRequestFromPayky = useCanRequestAccountFromPayky()
  const sourceApp = brandName(paykyBrand)

  return (
    <VerticalNav
      testID="open-account-choice"
      items={openAccountChoices({ canRequestFromPayky }).map((source) => ({
        id: source,
        kind: "button" as const,
        icon: <Icon icon={choiceIcons[source]} color="muted-foreground" />,
        label: (
          <YStack gap="1">
            <Text fontWeight="600">
              {t(openAccountChoiceCopy[source].title, { sourceApp })}
            </Text>
            <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
              {t(openAccountChoiceCopy[source].description)}
            </Text>
          </YStack>
        ),
        disabled,
        onPress: () => onSelect(source),
      }))}
    />
  )
}
