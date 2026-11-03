import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { Text } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { Screen } from "../../components/screen.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * Shown by a settings edit screen when the route's id doesn't parse or
 * matches no row, as web's `CatalogFormEmptyState`.
 */
export function CatalogFormEmptyState({
  titleKey,
  messageKey,
}: {
  readonly titleKey: TranslationKey
  readonly messageKey: TranslationKey
}) {
  const { t } = useTranslation()
  return (
    <Screen>
      <FadeHeader title={t(titleKey)} />
      <Text color="muted-foreground" text="center">
        {t(messageKey)}
      </Text>
    </Screen>
  )
}
