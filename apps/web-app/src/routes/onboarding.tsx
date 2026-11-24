import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { LandingLanguageSchema } from "@payky/web-shared/landing-redirect"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { evoluAtom } from "@/atoms/evolu.ts"
import { OnboardingPage } from "@/features/onboarding/onboarding-page.tsx"

const OnboardingSearchSchema = z.object({
  /** The language of the landing page the visitor came from (landing/0003). */
  lang: LandingLanguageSchema.optional().catch(undefined),
})

export const Route = createFileRoute("/onboarding")({
  component: OnboardingRoute,
  validateSearch: (search) => OnboardingSearchSchema.parse(search),
  // In front of the page, not only at the end of its submit: onboarding shows
  // the recovery phrase and can remove the active account (account/0005).
  beforeLoad: async ({ context }) => {
    const evolu = await context.jotaiStore.get(evoluAtom)
    const settings = await evolu.loadQuery(settingsQuery)
    if (settings.length > 0) {
      throw redirect({ to: "/", replace: true })
    }
  },
})

function OnboardingRoute() {
  const { lang } = Route.useSearch()
  return <OnboardingPage landingLanguage={lang} />
}
