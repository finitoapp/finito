import type { DefaultPaymentMethod } from "@payky/core/modules/app-settings/app-settings-types"

/**
 * The three ways a bitcoin payment can be received, which Finito offers as
 * one "Bitcoin" method with a wallet to choose (settings/0002): the shared
 * Cashu wallet, the merchant's own Lightning address, or a Spark wallet.
 * At most one of them is the main one at a time; Spark is the one a fresh
 * switch-on picks, for now (settings/0003).
 */
export const bitcoinWallets = ["cashu", "lightningAddress", "spark"] as const
export type BitcoinWallet = (typeof bitcoinWallets)[number]
export const defaultBitcoinWallet: BitcoinWallet = "spark"

export const isBitcoinWallet = (
  method: DefaultPaymentMethod
): method is BitcoinWallet =>
  (bitcoinWallets as ReadonlyArray<DefaultPaymentMethod>).includes(method)

/** A row of Finito's payment-method list: a method, or the three wallets as one. */
export type PaymentMethodGroup =
  | Exclude<DefaultPaymentMethod, BitcoinWallet>
  | "bitcoin"

/**
 * The stored order as the list shows it: every bitcoin wallet folds into
 * the one "bitcoin" row, placed where the first of them sits.
 */
export const groupPaymentMethodOrder = (
  order: ReadonlyArray<DefaultPaymentMethod>
): ReadonlyArray<PaymentMethodGroup> =>
  order
    .map(
      (method): PaymentMethodGroup =>
        isBitcoinWallet(method) ? "bitcoin" : method
    )
    .filter((group, index, groups) => groups.indexOf(group) === index)

/**
 * A list order back into the stored one: "bitcoin" expands to the wallets
 * in the order they already had, so the one in use keeps its place among
 * them.
 */
export const expandPaymentMethodOrder = (
  groups: ReadonlyArray<PaymentMethodGroup>,
  order: ReadonlyArray<DefaultPaymentMethod>
): ReadonlyArray<DefaultPaymentMethod> =>
  groups.flatMap((group) =>
    group === "bitcoin" ? order.filter(isBitcoinWallet) : [group]
  )

/**
 * The stored order after the list's row at `index` swaps with its
 * neighbour; `undefined` when there is none to swap with.
 */
export const movePaymentMethodGroup = (
  order: ReadonlyArray<DefaultPaymentMethod>,
  index: number,
  offset: -1 | 1
): ReadonlyArray<DefaultPaymentMethod> | undefined => {
  const groups = groupPaymentMethodOrder(order)
  const group = groups[index]
  const neighbour = groups[index + offset]
  if (group === undefined || neighbour === undefined) return undefined
  return expandPaymentMethodOrder(
    groups.with(index, neighbour).with(index + offset, group),
    order
  )
}
