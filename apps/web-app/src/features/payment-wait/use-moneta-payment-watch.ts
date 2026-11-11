import { useMonetaPaymentWatchFor } from "@payky/app-shared/moneta-payment-watch"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { syncMonetaTransactions } from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useCanReachBanks } from "@/hooks/use-service-proxy.ts"

/**
 * MONETA's fast speed (moneta/0010) wherever this device can reach the bank:
 * the native shell, or a browser through the service proxy it allowed. The
 * watch itself is `useMonetaPaymentWatchFor`; a browser without the proxy
 * never asks.
 */
export function useMonetaPaymentWatch({
  paymentId,
  accountId,
  createdAt,
  payable,
}: {
  readonly paymentId: PaymentId
  readonly accountId: AccountId
  readonly createdAt: string | null
  readonly payable: boolean
}) {
  const appRun = useAppRun()
  const console = useConsole()
  const { data: plugins } = useEvoluQuery(activeMonetaPluginsQuery)
  const plugin = plugins.find((plugin) => plugin.accountId === accountId)
  const canReachBank = useCanReachBanks()

  return useMonetaPaymentWatchFor({
    paymentId,
    createdAt,
    payable,
    canReachBank,
    pluginToken: plugin?.token ?? null,
    sync: async (range) => {
      await using run = appRun()
      return await run(syncMonetaTransactions(range))
    },
    onFailure: (error) => console.debug("MONETA payment watch failed", error),
  })
}
