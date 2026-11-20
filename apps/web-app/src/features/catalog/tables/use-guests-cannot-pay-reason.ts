import { sqliteTrue } from "@evolu/common"
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
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

function useSelfPayAccounts() {
  const { data: bankAccounts } = useEvoluQuery(fiatBankAccountQuery)
  const { data: sparkAccounts } = useEvoluQuery(sparkAccountQuery)
  const { data: activeFioPlugins } = useEvoluQuery(activeFioPluginsQuery)
  const { data: activeMonetaPlugins } = useEvoluQuery(activeMonetaPluginsQuery)

  return pickSelfPayAccounts({
    bankAccount: bankAccounts[0],
    sparkAccount: sparkAccounts[0],
    activeBankPlugins: [...activeFioPlugins, ...activeMonetaPlugins],
  })
}

export function useGuestsHaveNoPaymentMethod(): boolean {
  return (
    deriveGuestsCannotPayReason({
      accounts: useSelfPayAccounts(),
      lastPublish: null,
    }) === "noPaymentMethod"
  )
}

export function useBankReachesGuests(): boolean {
  return useSelfPayAccounts().bank !== null
}

export function useBankAccountIsOn(): boolean {
  const {
    data: [bankAccount],
  } = useEvoluQuery(fiatBankAccountQuery)
  return bankAccount !== undefined && bankAccount.isDeleted !== sqliteTrue
}

export function useGuestsCannotPayReason(
  viewKey: Uint8Array
): GuestsCannotPayReason | null {
  const accounts = useSelfPayAccounts()
  const { data: publishResults } = useEvoluQuery(
    selfPayPublishResultsByTagQuery(
      NonEmptyString255(deriveSelfPayViewTag(viewKey))
    )
  )

  return deriveGuestsCannotPayReason({
    accounts,
    lastPublish: findNewestViewPublish(
      parseSelfPayPublishResults(publishResults)
    ),
  })
}
