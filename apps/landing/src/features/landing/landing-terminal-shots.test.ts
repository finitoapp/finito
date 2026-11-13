import { terminalShotNames } from "@payky/doc-mockups/terminal-shots"
import { describe, expect, test, vi } from "vitest"

// The page exists on Finito's landing only (landing/0015).
vi.mock("@/core/app-env.ts", () => ({
  appEnv: {
    PAYKY_LANDING_BRAND: "finito",
    VITE_PAYKY_API_BASE_URL: undefined,
  },
}))

const { terminalShots } = await import(
  "@/features/landing/landing-terminal-shots.ts"
)
const { terminalPageShots, terminalSwitchioPaySteps } = await import(
  "@/features/landing/landing-terminal-page.tsx"
)
const { renderLandingDocument } = await import("@/landing-server.tsx")
const { landingResources } = await import("@/core/landing-site.ts")

const template = `<!doctype html><html lang="cs"><head><!--landing-head--></head><body><div id="root"><!--landing-app--></div></body></html>`

describe("the card terminal documentation's screenshots", () => {
  // Generated from the real app into apps/native-app/docs/terminal by
  // apps/native-app/scripts/generate-terminal-screenshots.ts.
  test.each(["en", "cs", "sk"] as const)(
    "has every screenshot in %s",
    (language) => {
      expect(
        terminalShotNames.filter(
          (name) => terminalShots[language][name] === undefined
        )
      ).toEqual([])
    }
  )

  test("shows every screenshot on the page", () => {
    expect([...new Set(terminalPageShots)].sort()).toEqual(
      [...terminalShotNames].sort()
    )
  })

  test("stands a placeholder in for SwitchioPay's own screens", () => {
    const body = renderLandingDocument(template, "cs", "terminal").split(
      "<body>"
    )[1]

    expect(terminalSwitchioPaySteps.length).toBeGreaterThan(0)
    expect(body?.match(/data-switchio-pay-placeholder=""/gu)).toHaveLength(
      terminalSwitchioPaySteps.length
    )
    for (const label of terminalSwitchioPaySteps) {
      expect(body).toContain(landingResources.cs[label])
    }
  })
})
