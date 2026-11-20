import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { updateSettings } from "../app-settings/app-settings-actions.ts"
import { saveFioPlugin } from "../fio-plugin/fio-plugin-actions.ts"
import { connectMonetaPlugin } from "../moneta-plugin/moneta-plugin-actions.ts"
import {
  IbanSchema,
  NonEmptyString255,
  NonEmptyStringSchema,
  PositiveInteger,
} from "../shared/schema.ts"
import {
  createSelfPayTestContext,
  loadSelfPayTestView,
  openSelfPayBill,
  type SelfPayTestContext,
} from "./table-self-pay-test-fixtures.ts"

const openBankSyncedBill = async (context: SelfPayTestContext) => {
  await openSelfPayBill(context, { lines: [{ name: "Pizza", amount: 10_100 }] })
  await using run = testCreateRun(context.deps)
  await run.ok(
    saveFioPlugin({
      accountId: context.ibanAccountId,
      numberOfSecondsBetweenChecks: PositiveInteger(60),
      isActive: sqliteTrue,
    })
  )
}

describe("the payee guests see", () => {
  test("is no one while the owner has chosen no name, never the account's name", async () => {
    await using context = await createSelfPayTestContext()
    await openBankSyncedBill(context)

    const { view } = await loadSelfPayTestView(context)

    expect(view.payee).toBe(null)
    expect(view.bank?.accountName).toBe("")
    expect(JSON.stringify(view)).not.toContain("Bistro")
  })

  test("is the name the owner chose for guests", async () => {
    await using context = await createSelfPayTestContext()
    await openBankSyncedBill(context)
    await using run = testCreateRun(context.deps)
    await run.ok(
      updateSettings({ selfPayGuestName: NonEmptyString255("Kavárna U Lípy") })
    )

    const { view } = await loadSelfPayTestView(context)

    expect(view.payee).toBe("Kavárna U Lípy")
    expect(view.bank?.accountName).toBe("Kavárna U Lípy")
    expect(JSON.stringify(view)).not.toContain("Bistro")
  })
})

describe("the bank account guests pay to", () => {
  test("is offered while MONETA syncs it, as while Fio does", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const iban = IbanSchema.decode("CZ6508000000192000145399")

    expect((await loadSelfPayTestView(context)).view.bank).toBe(null)

    await using run = testCreateRun({
      ...context.deps,
      fetch: async () =>
        Response.json({
          accounts: [{ id: "bank-account-1", identification: { iban } }],
        }),
    })
    await run.orThrow(
      connectMonetaPlugin({
        accountId: context.ibanAccountId,
        iban,
        token: NonEmptyStringSchema.decode("moneta-token"),
      })
    )

    expect((await loadSelfPayTestView(context)).view.bank?.iban).toBe(iban)
  })
})
