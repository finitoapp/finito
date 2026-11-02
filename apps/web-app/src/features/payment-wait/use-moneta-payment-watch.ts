import { Capacitor } from "@capacitor/core"
import { useMonetaPaymentWatchFor } from "@payky/app-shared/moneta-payment-watch"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { syncMonetaTransactions } from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConsole } from "@/hooks/use-console.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * MONETA's fast speed (moneta/0002) on the web app's native shell; the
 * watch itself is `useMonetaPaymentWatchFor`. A browser cannot reach the
 * bank, so it never asks.
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

  return useMonetaPaymentWatchFor({
    paymentId,
    createdAt,
    payable,
    isNativeRuntime: Capacitor.isNativePlatform(),
    pluginToken: plugin?.token ?? null,
    sync: async (range) => {
      await using run = appRun()
      return await run(syncMonetaTransactions(range))
    },
    onFailure: (error) => console.debug("MONETA payment watch failed", error),
  })
}
