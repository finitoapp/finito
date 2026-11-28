import {
  cashuAccountQuery,
  enabledPaymentMethodAccountsQuery,
} from "@payky/core/modules/account/account-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { eetSettingsQuery } from "@payky/core/modules/eet/eet-queries"
import { activeFioPluginsQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import { activeMonetaPluginsQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import {
  paymentClaimsQuery,
  paymentRequestQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { evoluAtom } from "../atoms/evolu.ts"

/**
 * Everything the payment's screen waits on as it opens: the payment and its
 * claims, the methods offered, and what the bank and Qerko tabs read (the
 * bank QR's recipient among it), so
 * whichever tab opens first finds its data in too. The screen preloads them
 * itself (`usePreloadEvoluQueries`).
 */
export const paymentWaitQueries = (paymentId: PaymentId) =>
  [
    paymentRequestQuery(paymentId),
    paymentClaimsQuery(paymentId),
    enabledPaymentMethodAccountsQuery,
    cashuAccountQuery,
    settingsQuery,
    eetSettingsQuery,
    qerkoPluginQuery("standard"),
    activeFioPluginsQuery,
    activeMonetaPluginsQuery,
    legalEntityQuery,
    qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
  ] as const

/**
 * Starts loading the payment's screen as the code that opens it runs,
 * before the navigation renders anything, as `usePreloadActivity` does for
 * Activity: a screen that suspends on mount commits an empty fallback,
 * renders again once its rows come, and React holds a nested boundary's
 * reveal back up to 300 ms.
 */
export function usePreloadPaymentWait(): (paymentId: PaymentId) => void {
  const evolu = useAtomValue(evoluAtom)
  return useCallback(
    (paymentId: PaymentId) => {
      // Only warms Evolu's cache: the screen reads, and reports, the same
      // queries itself.
      void Promise.allSettled(
        evolu.loadQueries([...paymentWaitQueries(paymentId)])
      )
    },
    [evolu]
  )
}
