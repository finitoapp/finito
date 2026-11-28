import { QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { queryClient } from "@/core/query-client.ts"
import { ProfileSettingsPage } from "./profile-settings-page.tsx"

const state = vi.hoisted(() => ({
  profile: "pending" as "pending" | "suspended" | "error" | "loaded",
  identityPending: false,
  publicName: null as string | null,
  publishedName: "Cafe" as string | null,
  pending: new Promise<never>(() => {}),
}))

vi.mock("@/components/fade-header.tsx", () => ({
  FadeHeader: ({ title }: { readonly title: string }) => <h2>{title}</h2>,
}))
vi.mock("@/hooks/use-translation.ts", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("@/hooks/use-app-run.ts", () => ({ useAppRun: () => vi.fn() }))
vi.mock("@/hooks/use-evolu-query.ts", () => ({
  useEvoluQuery: () => ({ data: [{ publicName: state.publicName }] }),
}))
vi.mock("@/hooks/use-nostr-profile.ts", () => ({
  useNostrIdentity: () => {
    if (state.identityPending) throw state.pending
    return { pubkey: "public-key", npub: "npub1localidentity" }
  },
  useActiveNostrProfile: () => {
    if (state.profile === "suspended") throw state.pending
    return {
      isPending: state.profile === "pending",
      isError: state.profile === "error",
      isFetching: false,
      data: {
        name: state.publishedName,
        picture: "https://example.com/avatar.png",
        metadata: {},
      },
    }
  },
}))

const renderPage = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ProfileSettingsPage />
    </QueryClientProvider>
  )

describe("ProfileSettingsPage", () => {
  beforeEach(() => {
    state.profile = "pending"
    state.identityPending = false
    state.publicName = null
    state.publishedName = "Cafe"
  })

  it.each(["pending", "suspended"] as const)(
    "keeps the page and local public key visible while the profile is %s",
    (status) => {
      state.profile = status
      const html = renderPage()
      expect(html).toContain("settings.profile.description")
      expect(html).toContain("settings.profile.picture.label")
      expect(html).toContain("settings.profile.name.label")
      expect(html).toContain("npub1localidentity")
      expect(html).toContain("settings.profile.npub.copy")
      expect(html.match(/data-slot="skeleton"/g)).toHaveLength(2)
      expect(html).toMatch(/<button[^>]*disabled/)
      expect(html).not.toContain("<input")
    }
  )

  it("keeps the shell and labels visible while the local identity suspends", () => {
    state.identityPending = true
    const html = renderPage()
    expect(html).toContain("settings.profile.description")
    expect(html).toContain("settings.profile.picture.label")
    expect(html).toContain("settings.profile.name.label")
    expect(html).toContain("settings.profile.npub.label")
    expect(html.match(/data-slot="skeleton"/g)).toHaveLength(3)
  })

  it("shows retry and preserves labels and the public key after a failed read", () => {
    state.profile = "error"
    const html = renderPage()
    expect(html).toContain('role="alert"')
    expect(html).toContain("settings.profile.loadFailed")
    expect(html).toContain("settings.profile.retry")
    expect(html).toContain("settings.profile.picture.label")
    expect(html).toContain("settings.profile.name.label")
    expect(html).toContain("npub1localidentity")
    expect(html).not.toContain('data-slot="skeleton"')
    expect(html).not.toContain("<input")
  })

  it("replaces the placeholders with the loaded editor", () => {
    state.profile = "loaded"
    const html = renderPage()
    expect(html).toContain('value="Cafe"')
    expect(html).toContain('src="https://example.com/avatar.png"')
    expect(html).toContain('type="file"')
    expect(html).not.toContain('data-slot="skeleton"')
  })

  it("edits the stored public name over the published one and offers either", () => {
    state.profile = "loaded"
    state.publicName = "Linden Café"
    const html = renderPage()
    expect(html).toContain('value="Linden Café"')
    expect(html).toContain("settings.profile.name.differs")
    expect(html).toContain("settings.profile.name.publish")
    expect(html).toContain("settings.profile.name.usePublished")
  })

  it("offers to publish a stored public name the profile does not carry", () => {
    state.profile = "loaded"
    state.publicName = "Linden Café"
    state.publishedName = null
    const html = renderPage()
    expect(html).toContain("settings.profile.name.unpublished")
    expect(html).toContain("settings.profile.name.publish")
    expect(html).not.toContain("settings.profile.name.usePublished")
  })

  it("shows no notice when the profile publishes the stored name", () => {
    state.profile = "loaded"
    state.publicName = "Cafe"
    const html = renderPage()
    expect(html).not.toContain("settings.profile.name.publish")
  })
})
