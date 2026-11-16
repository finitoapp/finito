import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { FadeHeader } from "../../components/fade-header.tsx"
import { NotFoundCard } from "../../components/not-found-card.tsx"
import { Screen } from "../../components/screen.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * Shown by a settings edit screen when the route's id doesn't parse or
 * matches no row, as web's `CatalogFormEmptyState`: the missing row's
 * `NotFoundCard` under the screen's title.
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
      <NotFoundCard messageKey={messageKey} />
    </Screen>
  )
}
