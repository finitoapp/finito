import { installPolyfills } from "@evolu/common/polyfills"
import {
  isLandingEetPath,
  isLandingTechPath,
  landingLanguageFromPath,
  readLandingRedirectEnvironment,
} from "@payky/web-shared/landing-redirect"
import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { landingAppEntryUrl, landingSite } from "@/core/landing-site.ts"
import { LandingEetPage } from "@/features/landing/landing-eet-page.tsx"
import { LandingPage } from "@/features/landing/landing-page.tsx"
import { LandingTechPage } from "@/features/landing/landing-tech-page.tsx"
import "@/index.css"

// The contact form's `await using` needs `Symbol.asyncDispose`.
installPolyfills()

const rootElement = document.getElementById("root")

if (rootElement === null) {
  throw new Error("Root element was not found.")
}

const language = landingLanguageFromPath(location.pathname, landingSite.paths)
const Page = isLandingEetPath(location.pathname, landingSite.paths)
  ? LandingEetPage
  : isLandingTechPath(location.pathname, landingSite.paths)
    ? LandingTechPage
    : LandingPage
const page = (
  <StrictMode>
    <Page language={language} />
  </StrictMode>
)

// An app added to the home screen can start at the page it was added from
// rather than at the manifest's start URL, as iOS has done; installed, it
// belongs in the app, in this page's language (landing/0005).
if (readLandingRedirectEnvironment().installedPwa) {
  location.replace(landingAppEntryUrl(language))
} else if (rootElement.firstElementChild !== null) {
  // The build prerenders the page (landing/0002); the dev server serves the
  // template, whose root holds only the placeholder comment.
  hydrateRoot(rootElement, page)
} else {
  createRoot(rootElement).render(page)
}
