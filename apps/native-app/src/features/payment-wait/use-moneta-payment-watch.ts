import { useMonetaPaymentWatchFor } from "@payky/app-shared/moneta-payment-watch"
import type { AccountId } from "@payky/core/modules/account/account-types"
import { syncMonetaTransactions } from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { Platform } from "react-native"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"

/**
 * MONETA's fast speed (moneta/0002), as web's `useMonetaPaymentWatch`; the
 * watch itself is `useMonetaPaymentWatchFor`. The app's web build cannot
 * reach the bank, so it never asks.
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
  const plugins = useEvoluQuery(activeMonetaPluginsQuery).data
  const plugin = plugins.find((plugin) => plugin.accountId === accountId)

  return useMonetaPaymentWatchFor({
    paymentId,
    createdAt,
    payable,
    isNativeRuntime: Platform.OS !== "web",
    pluginToken: plugin?.token ?? null,
    sync: async (range) => {
      await using run = appRun()
      return await run(syncMonetaTransactions(range))
    },
    onFailure: (error) =>
      nativeConsole.debug("MONETA payment watch failed", error),
  })
}
