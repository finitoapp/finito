import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { IbanSchema } from "@payky/core/modules/shared/schema"
import { describe, expect, it } from "vitest"
import { bankSyncPluginLinks } from "./bank-sync-plugin-links.ts"

const monetaIban = IbanSchema.parse("CZ3806000000002123456789")
const fioIban = IbanSchema.parse("CZ6508000000192000145399")

describe("bankSyncPluginLinks", () => {
  it("links only the bank of the IBAN while no plugin is set up", () => {
    expect(
      bankSyncPluginLinks({
        iban: monetaIban,
        monetaPlugin: undefined,
        hasFioPlugin: false,
      })
    ).toEqual({
      showsMonetaPlugin: true,
      showsFioPlugin: false,
      isMonetaPluginOn: false,
    })
    expect(
      bankSyncPluginLinks({
        iban: fioIban,
        monetaPlugin: undefined,
        hasFioPlugin: false,
      })
    ).toMatchObject({ showsMonetaPlugin: false, showsFioPlugin: true })
    expect(
      bankSyncPluginLinks({
        iban: null,
        monetaPlugin: undefined,
        hasFioPlugin: false,
      })
    ).toMatchObject({ showsMonetaPlugin: false, showsFioPlugin: true })
  })

  it("keeps a set-up plugin reachable after the IBAN moved to another bank", () => {
    expect(
      bankSyncPluginLinks({
        iban: fioIban,
        monetaPlugin: { isActive: sqliteTrue, iban: monetaIban },
        hasFioPlugin: false,
      })
    ).toEqual({
      showsMonetaPlugin: true,
      showsFioPlugin: true,
      isMonetaPluginOn: false,
    })
    expect(
      bankSyncPluginLinks({
        iban: monetaIban,
        monetaPlugin: undefined,
        hasFioPlugin: true,
      })
    ).toMatchObject({ showsMonetaPlugin: true, showsFioPlugin: true })
  })

  it("reads the MONETA plugin as on only while active for the account's IBAN", () => {
    const on = (isActive: typeof sqliteTrue | typeof sqliteFalse) =>
      bankSyncPluginLinks({
        iban: monetaIban,
        monetaPlugin: { isActive, iban: monetaIban },
        hasFioPlugin: false,
      }).isMonetaPluginOn
    expect(on(sqliteTrue)).toBe(true)
    expect(on(sqliteFalse)).toBe(false)
  })
})
