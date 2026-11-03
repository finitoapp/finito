import {
  type BitcoinWallet,
  bitcoinWallets,
  defaultBitcoinWallet,
} from "@payky/app-shared/bitcoin-payment-method"
import {
  saveCashuAccount,
  saveLightningAddressAccount,
  saveSparkAccount,
} from "@payky/core/modules/account/account-actions"
import {
  cashuAccountQuery,
  lightningAddressAccountQuery,
  sparkAccountQuery,
} from "@payky/core/modules/account/account-queries"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useCashuRunToast } from "../../../hooks/use-run-toast.ts"

/** The queries `useBitcoinWallet` reads, for a screen's preload list. */
export const bitcoinWalletQueries = [
  cashuAccountQuery,
  lightningAddressAccountQuery,
  sparkAccountQuery,
]

/**
 * Finito's one Bitcoin method over the three wallet accounts
 * (settings/0002): which wallet is on, and a `select` that turns one on and
 * the others off in one run, or every one off with `null`. A Lightning
 * address can only be selected once one is saved (`hasLightningAddress`);
 * its form saves and selects in one go.
 */
export function useBitcoinWallet() {
  const cashuRunToast = useCashuRunToast()
  const [cashu] = useEvoluQuery(cashuAccountQuery).data
  const [lightningAddress] = useEvoluQuery(lightningAddressAccountQuery).data
  const [spark] = useEvoluQuery(sparkAccountQuery).data

  const enabledWallets = {
    cashu: cashu !== undefined && cashu.isDeleted !== 1,
    lightningAddress:
      lightningAddress !== undefined && lightningAddress.isDeleted !== 1,
    spark: spark !== undefined && spark.isDeleted !== 1,
  } satisfies Record<BitcoinWallet, boolean>
  const enabled = bitcoinWallets.find((wallet) => enabledWallets[wallet])

  const select = (wallet: BitcoinWallet | null): Promise<boolean> =>
    cashuRunToast(async (run) => {
      // Off first, so no moment offers two bitcoin tabs.
      for (const other of bitcoinWallets) {
        if (other !== wallet && enabledWallets[other]) {
          await run.ok(saveWallet[other]({ enabled: false }))
        }
      }
      if (wallet !== null && !enabledWallets[wallet]) {
        await run.ok(saveWallet[wallet]({ enabled: true }))
      }
    })

  return {
    /** The wallet in use, `undefined` while Bitcoin is off. */
    enabled,
    /** The address entered so far, enabled or not. */
    lightningAddress: lightningAddress?.address,
    select,
    /** The switch's "on": the wallet last chosen is not remembered, so the default. */
    enable: () => select(defaultBitcoinWallet),
  }
}

const saveWallet = {
  cashu: saveCashuAccount,
  lightningAddress: saveLightningAddressAccount,
  spark: saveSparkAccount,
} satisfies Record<
  BitcoinWallet,
  (input: { readonly enabled: boolean }) => unknown
>
