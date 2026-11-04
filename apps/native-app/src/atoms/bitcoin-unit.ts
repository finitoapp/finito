import { atom } from "jotai"

/** How a bitcoin amount is read: as the shop's money, or in sats. */
export type BitcoinUnit = "fiat" | "sats"

/**
 * The unit every bitcoin amount is shown in: the shop's currency at today's
 * rate, until an amount is tapped, which switches all of them to sats, and
 * back. Per session, not stored: the app opens in the merchant's money every
 * time, as Fazole's wallet does, so nobody lands on sats unexpectedly.
 */
export const bitcoinUnitAtom = atom<BitcoinUnit>("fiat")
