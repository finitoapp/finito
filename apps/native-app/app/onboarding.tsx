import { LanguageSchema } from "@payky/app-shared/i18n/language-schema"
import { useLocalSearchParams } from "expo-router"
import { OnboardingPage } from "../src/features/onboarding/onboarding-page.tsx"

/**
 * Onboarding, with the landing page's language when a landing link opened
 * it (`/onboarding?lang=cs`, landing/0003); any other value is ignored.
 */
export default function OnboardingRoute() {
  const { lang } = useLocalSearchParams<{ lang?: string }>()
  const landingLanguage = LanguageSchema.safeParse(lang)
  return (
    <OnboardingPage
      landingLanguage={
        landingLanguage.success ? landingLanguage.data : undefined
      }
    />
  )
}
