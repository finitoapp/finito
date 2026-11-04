import { fetchLnurlPayMetadata } from "@payky/core/integrations/lnurl/lnurl-pay-client"
import { fetchYadioBtcExchangeRate } from "@payky/core/integrations/yadio/yadio-client"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { useAppRun } from "./use-app-run.ts"
import { useAsyncValue } from "./use-async-value.ts"
import { useEvoluQuery } from "./use-evolu-query.ts"

const RATE_TTL_MS = 60_000
const rates = new Map<string, { readonly at: number; readonly rate: number }>()

/**
 * The shop's fiat currency and today's BTC rate, so the screens can read a
 * sats amount in the shop's money (`useBitcoinAmount`). The rate is a
 * display aid only, what moves is always sats, and stays `null` while it
 * loads or when Yadio is unreachable.
 */
export function useBtcFiat() {
  const appRun = useAppRun()
  const [settings] = useEvoluQuery(settingsQuery).data
  const currency = getFiatCurrency(settings)
  const { data: rate, failed: rateFailed } = useAsyncValue(
    `rate:${currency}`,
    async () => {
      const cached = rates.get(currency)
      if (cached !== undefined && Date.now() - cached.at < RATE_TTL_MS) {
        return cached.rate
      }
      await using run = appRun()
      const result = await run(fetchYadioBtcExchangeRate(currency))
      if (!result.ok) throw new Error("Failed to load the BTC exchange rate")
      rates.set(currency, { at: Date.now(), rate: result.value.exchangeRate })
      return result.value.exchangeRate
    }
  )

  return {
    currency,
    rate,
    /** The rate could not be loaded (Yadio unreachable or refused). */
    rateFailed,
  }
}

/** The LNURL-pay metadata behind a Lightning address, `null` waiting for one. */
export function useLnurlPayMetadata(address: string | null) {
  const appRun = useAppRun()
  return useAsyncValue(address, async () => {
    await using run = appRun()
    const result = await run(fetchLnurlPayMetadata({ address: address ?? "" }))
    if (!result.ok) throw new Error("Failed to load LNURL-pay metadata")
    return result.value
  })
}
