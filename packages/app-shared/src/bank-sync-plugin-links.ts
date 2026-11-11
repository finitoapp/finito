import { type SqliteBoolean, sqliteTrue } from "@evolu/common"
import { isMonetaBankIban } from "@payky/core/modules/shared/iban-utils"
import type { Iban } from "@payky/core/modules/shared/schema"

/**
 * Which bank's plugin the fiat bank account screen links to, and whether the
 * MONETA one reads as on. Each bank's link shows for its own IBANs, and for
 * as long as a plugin of it is set up: one connected before the IBAN moved
 * to another bank must stay reachable, to switch it off or disconnect it.
 * The MONETA plugin is on only while it is active for the IBAN its token was
 * checked against (moneta/0009).
 */
export const bankSyncPluginLinks = ({
  iban,
  monetaPlugin,
  hasFioPlugin,
}: {
  readonly iban: Iban | null
  readonly monetaPlugin:
    | { readonly isActive: SqliteBoolean | null; readonly iban: Iban | null }
    | undefined
  readonly hasFioPlugin: boolean
}): {
  readonly showsMonetaPlugin: boolean
  readonly showsFioPlugin: boolean
  readonly isMonetaPluginOn: boolean
} => {
  const isMonetaIban = iban !== null && isMonetaBankIban(iban)
  return {
    showsMonetaPlugin: isMonetaIban || monetaPlugin !== undefined,
    showsFioPlugin: !isMonetaIban || hasFioPlugin,
    isMonetaPluginOn:
      monetaPlugin !== undefined &&
      monetaPlugin.isActive === sqliteTrue &&
      monetaPlugin.iban === iban,
  }
}
