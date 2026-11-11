import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { requiredPermission } from "../../../core/route-access.ts"

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8")
const page = read("./privacy-settings-page.tsx")
const card = read("./ai-assistant-card.tsx")
const hook = read("./use-privacy-settings.ts")
const controller = read("../../../components/app/sentry-controller.tsx")
const reporting = read("../../../core/error-reporting.ts")

it("keeps the privacy page free, like web's device consents", () => {
  expect(requiredPermission("/settings/about/privacy")).toBeNull()
})

it("flips errorReportingEnabled on the device row and lets the controller react", () => {
  expect(hook).toContain(
    "errorReportingEnabled: enabled ? sqliteTrue : sqliteFalse"
  )
  expect(hook).toContain("updateDeviceSettings(deviceEvolu")
  expect(page).toContain("settings.setErrorReportingEnabled(!reporting)")
  // The page never touches the SDK; the controller starts and closes it.
  expect(page).not.toMatch(/error-reporting|Sentry/u)
  expect(controller).toContain("enableErrorReporting()")
  expect(controller).toContain("disableErrorReporting()")
  expect(reporting).toContain("void Sentry.close()")
})

it("flips productLookupEnabled on the device row, with no lookup of its own", () => {
  expect(hook).toContain(
    "productLookupEnabled: enabled ? sqliteTrue : sqliteFalse"
  )
  expect(page).toContain("settings.setProductLookupEnabled(!lookup)")
  // The lookup itself arrives with the bill/item screens, not the consent.
  expect(page + hook).not.toMatch(/open-facts|lookupOpenFactsProduct/u)
})

it("offers the three AI access values behind the owner gate", () => {
  for (const value of ['"off"', '"public"', '"all"'])
    expect(card).toContain(`value: ${value}`)
  expect(card).toContain('require("admin", "access.action.aiAccess")')
  expect(card.indexOf("access.action.aiAccess")).toBeLessThan(
    card.indexOf("setAiAssistantAccess(next)")
  )
  expect(hook).toContain(
    "updateDeviceSettings(deviceEvolu, { aiAssistantAccess })"
  )
  expect(page).toContain("<AiAssistantCard />")
})

it("flips serviceProxyEnabled through the core write, with the native note outside the PWA only", () => {
  expect(hook).toContain('"serviceProxyEnabled"')
  expect(hook).toContain("serviceProxyEnabled: isServiceProxyEnabled(row)")
  expect(hook).toContain("setServiceProxyEnabled(deviceEvolu, enabled)")
  expect(page).toContain("settings.setServiceProxyEnabled(!proxy)")
  expect(page).toMatch(
    /Platform\.OS === "web"\s*\?\s*undefined\s*:\s*t\("settings\.privacy\.serviceProxy\.nativeNote"\)/u
  )
  // After the AI assistant, as web's ServiceProxyCard.
  expect(page.indexOf("<AiAssistantCard />")).toBeLessThan(
    page.indexOf("settings.privacy.serviceProxy.title")
  )
})

it("asks for the owner PIN before turning the service proxy on or off", () => {
  expect(page).toContain('require("admin", "access.action.serviceProxy")')
  expect(page.indexOf("access.action.serviceProxy")).toBeLessThan(
    page.indexOf("settings.setServiceProxyEnabled(!proxy)")
  )
  expect(page).toContain('from "../../../core/use-access.ts"')
})
