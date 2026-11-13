import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { retitleIndexHtml, retitleWebManifest } from "./web-export-title.ts"

const publicFile = (file: string) =>
  readFileSync(new URL(`../../public/${file}`, import.meta.url), "utf8")

describe("retitleIndexHtml", () => {
  test("names the page and its home-screen title", () => {
    const html = retitleIndexHtml(publicFile("index.html"), "Finito edge")
    expect(html).toContain("<title>Finito edge</title>")
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-title" content="Finito edge" />'
    )
    expect(html).not.toMatch(/>Finito<|content="Finito"/u)
  })

  test("escapes the title", () => {
    expect(
      retitleIndexHtml(
        '<title>x</title><meta name="apple-mobile-web-app-title" content="x" />',
        'a<"&'
      )
    ).toBe(
      '<title>a&lt;&quot;&amp;</title><meta name="apple-mobile-web-app-title" content="a&lt;&quot;&amp;" />'
    )
  })

  test.each([
    [
      "the title",
      '<meta name="apple-mobile-web-app-title" content="Finito" />',
    ],
    ["the home-screen title", "<title>Finito</title>"],
  ])("fails when the page has no %s", (_, html) => {
    expect(() => retitleIndexHtml(html, "Finito dev")).toThrow(
      /expected exactly one/u
    )
  })

  test("fails on a second title rather than leave one unchanged", () => {
    expect(() =>
      retitleIndexHtml(
        '<title>a</title><title>b</title><meta name="apple-mobile-web-app-title" content="a" />',
        "Finito dev"
      )
    ).toThrow(/has 2 <title> elements/u)
  })
})

describe("retitleWebManifest", () => {
  test("names the app and keeps every other field", () => {
    const source = JSON.parse(publicFile("manifest.webmanifest"))
    expect(
      JSON.parse(
        retitleWebManifest(publicFile("manifest.webmanifest"), "Finito prev")
      )
    ).toEqual({ ...source, name: "Finito prev", short_name: "Finito prev" })
  })

  test.each([
    ["no short_name", '{"name":"Finito"}'],
    ["no name", '{"short_name":"Finito"}'],
    ["not JSON", "{"],
  ])("fails on a manifest with %s", (_, text) => {
    expect(() => retitleWebManifest(text, "Finito dev")).toThrow(
      /manifest.webmanifest has no name to set/u
    )
  })
})
