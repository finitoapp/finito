import { readFileSync } from "node:fs"
import path from "node:path"
import { brandSelfPayOrigins } from "@payky/app-shared/brand"
import { describe, expect, test } from "vitest"

import { appEnv } from "@/core/app-env.ts"

interface HostCondition {
  readonly type: string
  readonly value: string
}

interface VercelConfig {
  readonly redirects?: ReadonlyArray<{
    readonly source: string
    readonly destination: string
    readonly has?: ReadonlyArray<HostCondition>
  }>
  readonly headers: ReadonlyArray<{
    readonly source: string
    readonly has?: ReadonlyArray<HostCondition>
    readonly missing?: ReadonlyArray<HostCondition>
    readonly headers: ReadonlyArray<{
      readonly key: string
      readonly value: string
    }>
  }>
  readonly rewrites: ReadonlyArray<{
    readonly source: string
    readonly destination: string
    readonly has?: ReadonlyArray<HostCondition>
  }>
}

const vercel: VercelConfig = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../vercel.json"), "utf8")
)
const finitoVercel: VercelConfig = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../native-app/vercel.json"),
    "utf8"
  )
)

const matchesHost = (condition: HostCondition | undefined, host: string) =>
  condition?.type === "host" &&
  new RegExp(`^${condition.value}$`, "u").test(host)

describe("the guest page's origin", () => {
  const guestHost = new URL(appEnv.VITE_PAYKY_SELF_PAY_ORIGIN).host

  test("is the only host a rewrite serves the guest page on", () => {
    const toGuestPage = vercel.rewrites.filter(
      ({ destination }) => destination === "/t.html"
    )

    expect(toGuestPage).toHaveLength(1)
    expect(matchesHost(toGuestPage[0]?.has?.[0], guestHost)).toBe(true)
    expect(matchesHost(toGuestPage[0]?.has?.[0], "payky.me")).toBe(false)
  })

  test("sandboxes the guest page on any other host", () => {
    const sandboxed = vercel.headers.find(({ headers }) =>
      headers.some(({ value }) => value.startsWith("sandbox;"))
    )

    expect(sandboxed?.source).toBe("/t(\\.html)?")
    expect(matchesHost(sandboxed?.missing?.[0], guestHost)).toBe(true)
    expect(matchesHost(sandboxed?.missing?.[0], "edge.payky.me")).toBe(false)
  })

  test("sandboxes every other page on the guest host", () => {
    const sandboxed = vercel.headers.find(
      ({ has, headers }) =>
        matchesHost(has?.[0], guestHost) &&
        headers.some(({ value }) => value === "sandbox")
    )
    const covers = (pathname: string) =>
      new RegExp(`^${sandboxed?.source}$`, "u").test(pathname)

    expect(["/", "/index.html", "/settings"].every(covers)).toBe(true)
    expect(["/t", "/t.html"].some(covers)).toBe(false)
  })

  test("lets no site frame the guest page on any host", () => {
    const onEveryHost = vercel.headers.filter(
      ({ source, has, missing }) =>
        source === "/t(\\.html)?" && has === undefined && missing === undefined
    )

    expect(onEveryHost.flatMap(({ headers }) => headers)).toContainEqual({
      key: "Content-Security-Policy",
      value: "frame-ancestors 'none'",
    })
  })

  test("is served on every brand's guest host and on no app's origin", () => {
    const toGuestPage = vercel.rewrites.find(
      ({ destination }) => destination === "/t.html"
    )
    const guestHosts = brandSelfPayOrigins.map((origin) => new URL(origin).host)

    expect(
      guestHosts.every((host) => matchesHost(toGuestPage?.has?.[0], host))
    ).toBe(true)
    expect(matchesHost(toGuestPage?.has?.[0], "app.finito.fit")).toBe(false)
    expect(
      finitoVercel.rewrites.some(({ destination }) =>
        destination.startsWith("/t.html")
      )
    ).toBe(false)
  })

  test("sends a visitor of Finito's guest host to Finito's site", () => {
    const home = vercel.redirects?.find(
      ({ source, has }) =>
        source === "/" && matchesHost(has?.[0], "t.finito.fit")
    )

    expect(home?.destination).toBe("https://finito.fit")
    expect(matchesHost(home?.has?.[0], "t.payky.me")).toBe(false)
  })
})
