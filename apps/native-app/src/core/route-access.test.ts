import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  isTerminalRoute,
  requiredPermission,
  routeAccess,
} from "./route-access.ts"

const appDir = join(import.meta.dirname, "../../app")

/**
 * `app/bill.tsx` is `/bill`, `app/x/index.tsx` is `/x`, `[id]` is `:id`, and
 * a group such as `(tabs)` adds nothing to the path.
 */
const routeFiles = (readdirSync(appDir, { recursive: true }) as string[])
  .filter(
    (file) =>
      file.endsWith(".tsx") &&
      !file.split("/").some((part) => part.startsWith("+")) &&
      !file.endsWith("_layout.tsx")
  )
  .map((file) => {
    const path = `/${file
      .replace(/\.tsx$/, "")
      .replace(/\([^/]+\)\//g, "")
      .replace(/(^|\/)index$/, "")
      .replace(/\[(\w+)\]/g, ":$1")}`
    return path
  })

describe("native route access", () => {
  it("has a table entry for every route file and no entry without one", () => {
    expect([...routeFiles].sort()).toEqual(Object.keys(routeAccess).sort())
  })

  it("treats an unknown path as owner-only", () => {
    expect(requiredPermission("/nope")).toBe("admin")
    expect(requiredPermission("/settings/accounts/open")).toBe("admin")
    expect(requiredPermission("/diagnostics")).toBe("admin")
    expect(requiredPermission("/")).toBe("sell")
    expect(requiredPermission("/bill")).toBe("sell")
    expect(requiredPermission("/onboarding")).toBeNull()
    expect(requiredPermission("/restore-account")).toBeNull()
    expect(requiredPermission("/settings/access/add-device")).toBe("admin")
    expect(requiredPermission("/settings/accounts")).toBe("admin")
    expect(requiredPermission("/settings/eet")).toBe("admin")
    expect(requiredPermission("/settings/assistant")).toBe("activity")
    expect(requiredPermission("/settings/support")).toBe("settings")
    expect(requiredPermission("/settings/debug-console")).toBe("admin")
    expect(requiredPermission("/activity/stats")).toBe("stats")
    expect(requiredPermission("/orders")).toBeNull()
    expect(requiredPermission("/settings/demo-data")).toBe("admin")
    expect(requiredPermission("/settings/donations")).toBeNull()
    expect(requiredPermission("/settings/donations-invoice")).toBeNull()
  })

  it("lets a shift lead close the card terminal's batch, while its settings stay owner-only", () => {
    expect(requiredPermission("/settings/card-closure")).toBe("confirm")
    expect(requiredPermission("/settings/card-closure/abc123")).toBe("confirm")
    expect(requiredPermission("/settings/payment-accounts")).toBe("admin")
    expect(requiredPermission("/settings/payment-accounts/card-switchio")).toBe(
      "admin"
    )
  })

  it("matches a dynamic segment and prefers the static sibling", () => {
    expect(requiredPermission("/payment/tip")).toBe("sell")
    expect(requiredPermission("/payment/abc123")).toBe("sell")
    expect(requiredPermission("/payment/abc123/extra")).toBe("admin")
    expect(requiredPermission("/payment/")).toBe("admin")
    expect(requiredPermission("/activity")).toBe("activity")
    expect(requiredPermission("/activity/bills")).toBe("activity")
    expect(requiredPermission("/activity/abc123")).toBe("activity")
    expect(requiredPermission("/activity/bills/abc123")).toBe("activity")
    expect(requiredPermission("/activity/abc123/refund")).toBe("refund")
    expect(requiredPermission("/activity/abc123/refunds/def456")).toBe(
      "activity"
    )
    expect(requiredPermission("/activity/bills/refund")).toBe("activity")
    expect(requiredPermission("/withdraw")).toBe("admin")
    expect(requiredPermission("/withdraw/new")).toBe("admin")
    expect(requiredPermission("/withdraw/abc123")).toBe("admin")
    expect(requiredPermission("/cashu-withdraw")).toBe("admin")
    expect(requiredPermission("/cashu-withdraw/new")).toBe("admin")
    expect(requiredPermission("/cashu-withdraw/abc123")).toBe("admin")
    expect(requiredPermission("/settings")).toBeNull()
    expect(requiredPermission("/settings/about")).toBeNull()
    expect(requiredPermission("/settings/about/terms")).toBeNull()
    expect(requiredPermission("/settings/language")).toBeNull()
    expect(requiredPermission("/settings/theme")).toBeNull()
    expect(requiredPermission("/notifications")).toBeNull()
    expect(requiredPermission("/settings/home-screen")).toBe("settings")
    expect(requiredPermission("/settings/profile")).toBe("admin")
    expect(requiredPermission("/settings/security")).toBe("admin")
    expect(requiredPermission("/settings/evolu-export")).toBe("admin")
    expect(requiredPermission("/settings/tax-rates")).toBe("settings")
    expect(requiredPermission("/settings/tips")).toBe("settings")
    expect(requiredPermission("/settings/payment-number-series")).toBe(
      "settings"
    )
    expect(requiredPermission("/settings/items")).toBe("catalog")
    expect(requiredPermission("/settings/items/new")).toBe("catalog")
    expect(requiredPermission("/settings/items/abc123")).toBe("catalog")
    expect(requiredPermission("/settings/items/abc123/extra")).toBe("admin")
    expect(requiredPermission("/settings/tables")).toBe("catalog")
    expect(requiredPermission("/settings/tables/new")).toBe("catalog")
    expect(requiredPermission("/settings/tables/abc123")).toBe("catalog")
    expect(requiredPermission("/settings/access")).toBe("admin")
    expect(requiredPermission("/settings/access/add-device")).toBe("admin")
    expect(requiredPermission("/settings/accounts")).toBe("admin")
    expect(requiredPermission("/settings/eet")).toBe("admin")
    expect(requiredPermission("/settings/assistant")).toBe("activity")
    expect(requiredPermission("/settings/support")).toBe("settings")
    expect(requiredPermission("/settings/debug-console")).toBe("admin")
    expect(requiredPermission("/activity/stats")).toBe("stats")
    expect(requiredPermission("/settings/demo-data")).toBe("admin")
    expect(requiredPermission("/settings/donations")).toBeNull()
    expect(requiredPermission("/settings/donations-invoice")).toBeNull()
    expect(requiredPermission("/settings/payment-accounts")).toBe("admin")
    expect(requiredPermission("/settings/payment-accounts/iban")).toBe("admin")
    expect(
      requiredPermission("/settings/payment-accounts/iban/fio-plugin")
    ).toBe("admin")
    expect(
      requiredPermission("/settings/payment-accounts/iban/moneta-plugin")
    ).toBe("admin")
    expect(requiredPermission("/settings/payment-accounts/spark")).toBe("admin")
    expect(
      requiredPermission("/settings/payment-accounts/spark/transactions")
    ).toBe("admin")
    expect(requiredPermission("/settings/payment-accounts/card-switchio")).toBe(
      "admin"
    )
    expect(
      requiredPermission("/settings/payment-accounts/qerko-terminal")
    ).toBe("admin")
    expect(requiredPermission("/settings/payment-accounts/cashu")).toBe("admin")
    expect(
      requiredPermission("/settings/payment-accounts/lightning-address")
    ).toBe("admin")
  })

  it("keeps an account that is not onboarded off the terminal routes only", () => {
    expect(isTerminalRoute("/")).toBe(true)
    expect(isTerminalRoute("/settings/accounts")).toBe(true)
    expect(isTerminalRoute("/activity/abc")).toBe(true)
    expect(isTerminalRoute("/nope")).toBe(true)
    expect(isTerminalRoute("/onboarding")).toBe(false)
    expect(isTerminalRoute("/restore-account")).toBe(false)
    expect(isTerminalRoute("/error")).toBe(false)
    expect(isTerminalRoute("/e2e/offline")).toBe(false)
    expect(isTerminalRoute("/settings/accounts/open")).toBe(true)
    expect(isTerminalRoute("/diagnostics")).toBe(false)
  })
})
