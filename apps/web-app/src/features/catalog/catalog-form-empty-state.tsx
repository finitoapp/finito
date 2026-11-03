import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { FadeHeader } from "@/components/fade-header.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Shown by a settings edit form when the route's id doesn't parse or matches
 * no row. Keeps the page's own header so the screen doesn't collapse to a
 * bare sentence.
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
    <>
      <div className="h-6" />
      <FadeHeader title={t(titleKey)} />
      <p className="mt-16 px-6 text-center text-muted-foreground">
        {t(messageKey)}
      </p>
    </>
  )
}
