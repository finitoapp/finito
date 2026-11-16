import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

const plugin = vi.hoisted(() => ({
  isInstalled: vi.fn(async () => ({ installed: true })),
  pay: vi.fn(),
}))

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => plugin,
}))

const { createSwitchioTerminalDep } = await import("./switchio.ts")

const js = readFileSync(new URL("./switchio.ts", import.meta.url), "utf8")
const java = readFileSync(
  new URL(
    "../../../native-shell/android/app/src/main/java/me/payky/SwitchioPlugin.java",
    import.meta.url
  ),
  "utf8"
)

const payment = {
  transactionId: "t1",
  amount: 100,
  tipAmount: 0,
  currencyCode: 203,
}

describe("a launch that never reached SwitchioPay in Payky (payment/0021)", () => {
  it("uses the same rejection codes in the plugin and in JS", () => {
    for (const name of ["NOT_INSTALLED", "LAUNCH_FAILED"]) {
      const code = new RegExp(`SWITCHIO_${name}_CODE = "([^"]+)"`, "u").exec(
        js
      )?.[1]
      expect(code, name).toBe(`SWITCHIO_${name}`)
      expect(java).toContain(`${name}_CODE = "${code}"`)
    }
  })

  it("rejects any launch that threw, not only a missing SwitchioPay", () => {
    const pay = java.slice(java.indexOf("public void pay("))
    const launch = pay.slice(0, pay.indexOf("@ActivityCallback"))
    expect(launch).toContain("catch (ActivityNotFoundException exception)")
    expect(launch).toContain("catch (RuntimeException exception)")
    expect(launch).toContain("LAUNCH_FAILED_CODE")
  })

  it("reads the plugin's failed launch as unavailable, not as an unknown outcome", async () => {
    plugin.pay.mockRejectedValueOnce(
      Object.assign(new Error("failed"), { code: "SWITCHIO_LAUNCH_FAILED" })
    )

    await expect(
      createSwitchioTerminalDep({ demo: false }).switchioTerminal.pay(payment)
    ).resolves.toEqual({
      ok: false,
      error: { type: "SwitchioUnavailable", reason: "launchFailed" },
    })
  })

  it("still reads any other rejection as an unknown outcome", async () => {
    plugin.pay.mockRejectedValueOnce(new Error("bridge dropped"))

    await expect(
      createSwitchioTerminalDep({ demo: false }).switchioTerminal.pay(payment)
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "SwitchioResultUnreadable" },
    })
  })
})

describe("an answer naming another transaction in Payky (payment/0024)", () => {
  it("reads an answer naming another transaction as an unknown outcome", async () => {
    plugin.pay.mockResolvedValueOnce({
      transactionId: payment.transactionId,
      resultCode: -1,
      transactionResult: JSON.stringify({
        transactionId: "t0",
        responseCode: "OK",
      }),
    })

    await expect(
      createSwitchioTerminalDep({ demo: false }).switchioTerminal.pay(payment)
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "SwitchioResultUnreadable" },
    })
  })
})
