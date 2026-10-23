import {
  fiatBankAccountQuery,
  sparkAccountQuery,
} from "@payky/core/modules/account/account-queries"
import { activeFioPluginsQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { selfPayPublishResultsByTagQuery } from "@payky/core/modules/table-self-pay/table-self-pay-queries"
import {
  deriveGuestsCannotPayReason,
  findNewestViewPublish,
  type GuestsCannotPayReason,
  parseSelfPayPublishResults,
  pickSelfPayAccounts,
} from "@payky/core/modules/table-self-pay/table-self-pay-reach-utils"
import { deriveSelfPayViewTag } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"

/** Native counterpart of web's `useGuestsCannotPayReason`. */
export function useGuestsCannotPayReason(
  viewKey: Uint8Array
): GuestsCannotPayReason | null {
  const { data: bankAccounts } = useEvoluQuery(fiatBankAccountQuery)
  const { data: sparkAccounts } = useEvoluQuery(sparkAccountQuery)
  const { data: activeFioPlugins } = useEvoluQuery(activeFioPluginsQuery)
  const { data: activeMonetaPlugins } = useEvoluQuery(activeMonetaPluginsQuery)
  const { data: publishResults } = useEvoluQuery(
    selfPayPublishResultsByTagQuery(
      NonEmptyString255(deriveSelfPayViewTag(viewKey))
    )
  )

  return deriveGuestsCannotPayReason({
    accounts: pickSelfPayAccounts({
      bankAccount: bankAccounts[0],
      sparkAccount: sparkAccounts[0],
      activeBankPlugins: [...activeFioPlugins, ...activeMonetaPlugins],
    }),
    lastPublish: findNewestViewPublish(
      parseSelfPayPublishResults(publishResults)
    ),
  })
}
