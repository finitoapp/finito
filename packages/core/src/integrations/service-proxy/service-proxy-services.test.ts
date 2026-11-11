import { describe, expect, test } from "vitest"

import {
  findProxiedServiceForUrl,
  isProxiedService,
  resolveServiceProxyUpstreamUrl,
  serviceProxyEndpointPath,
} from "./service-proxy-services.ts"

describe("resolveServiceProxyUpstreamUrl", () => {
  test("resolves every call the Fio client makes", () => {
    for (const path of [
      "/v1/rest/last/TOKEN/transactions.json",
      "/v1/rest/periods/TOKEN/2026-10-01/2026-10-31/transactions.json",
      "/v1/rest/set-last-date/TOKEN/2026-10-01/",
    ]) {
      expect(resolveServiceProxyUpstreamUrl("fio", path)?.href).toBe(
        `https://fioapi.fio.cz${path}`
      )
    }
  })

  test("resolves every call the MONETA client makes", () => {
    for (const path of [
      "/api/v4/vip/aisp/my/accounts?page=0&size=100",
      "/api/v4/vip/aisp/my/accounts/acc%2F1/transactions?fromDate=2026-10-29&toDate=2026-10-30&page=0&size=100",
    ]) {
      expect(resolveServiceProxyUpstreamUrl("moneta", path)?.href).toBe(
        `https://api.moneta.cz${path}`
      )
    }
  })

  test("refuses a path that leaves the service's origin", () => {
    for (const path of [
      "//evil.example/v1/rest/last/TOKEN/transactions.json",
      "https://evil.example/v1/rest/last/TOKEN/transactions.json",
      "https://fioapi.fio.cz/v1/rest/last/TOKEN/transactions.json",
      "/\\evil.example/v1/rest/last/TOKEN/transactions.json",
      "\\\\evil.example/v1/rest/last/TOKEN/transactions.json",
      "v1/rest/last/TOKEN/transactions.json",
      "",
    ]) {
      expect(resolveServiceProxyUpstreamUrl("fio", path)).toBe(null)
    }
  })

  test("refuses paths outside the calls the client makes", () => {
    for (const path of [
      "/",
      "/v1/rest/by-id/TOKEN/2026/1/transactions.xml",
      "/v1/rest/last/TOKEN/transactions.json?extra=1",
      "/v1/rest/last/TOKEN/transactions.json#fragment",
      "/v1/rest/last/TOKEN/../../import/",
      "/v1/rest/last/%2e%2e/%2e%2e/import/transactions.json",
      "/v1/rest/last/..%2F..%2Fimport/transactions.json",
      "/v1/rest/last/TOKEN%5C..%5Cimport/transactions.json",
    ]) {
      expect(resolveServiceProxyUpstreamUrl("fio", path)).toBe(null)
    }
    expect(
      resolveServiceProxyUpstreamUrl("moneta", "/api/v4/vip/aisp/my/payments")
    ).toBe(null)
    expect(
      resolveServiceProxyUpstreamUrl(
        "moneta",
        "/api/v4/vip/aisp/my/accounts/1/balances"
      )
    ).toBe(null)
  })
})

describe("findProxiedServiceForUrl", () => {
  test("finds the service by the URL's origin", () => {
    expect(
      findProxiedServiceForUrl("https://fioapi.fio.cz/v1/rest/last/T/x")
    ).toBe("fio")
    expect(
      findProxiedServiceForUrl(new URL("https://api.moneta.cz/api/v4/x"))
    ).toBe("moneta")
  })

  test("finds none for another origin or a relative URL", () => {
    expect(
      findProxiedServiceForUrl("https://fioapi.fio.cz.evil.example/")
    ).toBe(null)
    expect(findProxiedServiceForUrl("http://api.moneta.cz/")).toBe(null)
    expect(findProxiedServiceForUrl("/api/proxy/fio")).toBe(null)
  })
})

describe("serviceProxyEndpointPath", () => {
  test("puts each service under /api/proxy", () => {
    expect(serviceProxyEndpointPath("fio")).toBe("/api/proxy/fio")
    expect(serviceProxyEndpointPath("moneta")).toBe("/api/proxy/moneta")
  })
})

describe("isProxiedService", () => {
  test("knows only the registry's own services", () => {
    expect(isProxiedService("fio")).toBe(true)
    expect(isProxiedService("moneta")).toBe(true)
    expect(isProxiedService("toString")).toBe(false)
    expect(isProxiedService("qerko")).toBe(false)
  })
})
