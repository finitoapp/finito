import {
  createFakeEetResponder,
  type FakeEetResponder,
} from "@payky/core/testing/eet-fake-responder"
import {
  createTestCertificate,
  createTestPkcs12,
} from "@payky/core/testing/eet-test-certificates"
import type { Language } from "@payky/web-shared/landing-redirect"
import { expect, type Page, type Route } from "@playwright/test"
import { fakeEetProductionUrl } from "./eet-endpoints.ts"
import { translate } from "./i18n.ts"
import { fillInlineField, toggleInlineSwitch } from "./inline-edit.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./navigation.ts"

export const eetCertificatePassword = "generated-e2e-password"
export const eetTestEic = "CZ1234567890"

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-expose-headers": "x-global-transaction-id",
}

export interface FakeEet {
  readonly playground: FakeEetResponder
  readonly production: FakeEetResponder
  readonly setUnreachable: (unreachable: boolean) => void
  readonly stopAnswering: () => void
  readonly unansweredRequestCount: () => number
}

type FakeEetConnection = "answering" | "refusing" | "hanging"

const fulfillFrom =
  (
    responder: FakeEetResponder,
    connection: () => FakeEetConnection,
    leaveUnanswered: () => void
  ) =>
  async (route: Route): Promise<void> => {
    const request = route.request()
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    if (connection() === "refusing") {
      await route.abort("connectionrefused")
      return
    }
    if (connection() === "hanging") {
      leaveUnanswered()
      return
    }

    try {
      const response = await responder.fetch(request.url(), {
        method: "POST",
        headers: { "content-type": "text/xml; charset=utf-8" },
        body: request.postData() ?? "",
      })
      await route.fulfill({
        status: response.status,
        headers: {
          ...corsHeaders,
          "content-type": "text/xml; charset=utf-8",
          "x-global-transaction-id":
            response.headers.get("x-global-transaction-id") ?? "",
        },
        body: await response.text(),
      })
    } catch {
      await route.abort("failed")
    }
  }

export async function routeFakeEet(page: Page): Promise<FakeEet> {
  const playground = await createFakeEetResponder({ test: true })
  const production = await createFakeEetResponder({ test: false })
  let connection: FakeEetConnection = "answering"
  let unansweredRequests = 0
  const currentConnection = () => connection
  const leaveUnanswered = () => {
    unansweredRequests += 1
  }

  await page.route(
    "https://pg.trzbyeet.gov.cz/**",
    fulfillFrom(playground, currentConnection, leaveUnanswered)
  )
  await page.route(
    `${new URL(fakeEetProductionUrl).origin}/**`,
    fulfillFrom(production, currentConnection, leaveUnanswered)
  )

  return {
    playground,
    production,
    setUnreachable: (next) => {
      connection = next ? "refusing" : "answering"
    },
    stopAnswering: () => {
      connection = "hanging"
    },
    unansweredRequestCount: () => unansweredRequests,
  }
}

export async function createEetCertificateFile(
  eic: string = eetTestEic
): Promise<{ readonly name: string; readonly buffer: Buffer }> {
  const certificate = await createTestCertificate({
    subject: { commonName: eic, description: "generated e2e taxpayer" },
    validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  })
  const p12 = await createTestPkcs12({
    ...certificate,
    password: eetCertificatePassword,
  })

  return { name: `${eic}.p12`, buffer: Buffer.from(p12) }
}

export async function importEetCertificate(
  page: Page,
  language: Language,
  file: { readonly name: string; readonly buffer: Buffer }
): Promise<void> {
  await page
    .getByLabel(translate(language, "settings.eet.certificate.file.label"))
    .setInputFiles({ ...file, mimeType: "application/x-pkcs12" })
  await page
    .getByLabel(translate(language, "settings.eet.certificate.password.label"))
    .fill(eetCertificatePassword)
  await page
    .getByRole("button", {
      name: translate(language, "settings.eet.certificate.import"),
    })
    .click()
  await expect(page.getByTestId("eet-certificate-eic")).toHaveText(
    file.name.replace(".p12", "")
  )
}

export async function enableEetWithGeneratedCertificate(
  page: Page,
  language: Language
): Promise<void> {
  await gotoPage(page, "/settings/eet", language, "settings.eet.title")
  await importEetCertificate(page, language, await createEetCertificateFile())
  await fillInlineField(
    page,
    page.getByLabel(translate(language, "settings.eet.establishment.label")),
    "24"
  )
  await toggleInlineSwitch(page, "settings.eet.enabled.label")
  await waitForLocalWriteToSettle(page)
}

export async function selectEetSandbox(
  page: Page,
  language: Language,
  { confirm }: { readonly confirm: boolean }
): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(
        translate(language, "settings.eet.environment.playground.title")
      ),
    })
    .click()
  await page
    .getByRole("button", {
      name: translate(
        language,
        confirm
          ? "settings.eet.environment.sandboxConfirm.confirm"
          : "settings.eet.environment.sandboxConfirm.cancel"
      ),
    })
    .click()
  await waitForLocalWriteToSettle(page)
}

export async function seedEetSaleFromAnotherDevice(
  page: Page,
  paymentId: string,
  minutesAgo: number
): Promise<string> {
  await page.waitForFunction(
    () => typeof window.__e2eSeedEetSaleFromAnotherDevice === "function"
  )
  const cashRegisterId = await page.evaluate(
    ([id, minutes]) => window.__e2eSeedEetSaleFromAnotherDevice?.(id, minutes),
    [paymentId, minutesAgo] as const
  )
  if (cashRegisterId === undefined) {
    throw new Error("The e2e bridge is not mounted.")
  }
  return cashRegisterId
}
