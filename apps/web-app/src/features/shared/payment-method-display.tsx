import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import {
  AtSignIcon,
  BanknoteIcon,
  BitcoinIcon,
  CoinsIcon,
  CreditCardIcon,
  LandmarkIcon,
  type LucideIcon,
  NfcIcon,
  ZapIcon,
} from "lucide-react"
import { QerkoIcon } from "@/components/qerko-icon.tsx"

/**
 * How the method that actually settled a payment (its claimed transaction's
 * `kind`) renders — as the payment detail's "Paid by" label and as the
 * activity list's per-row icon.
 */
export const paymentMethodIcon = {
  cashRegister: BanknoteIcon,
  iban: LandmarkIcon,
  onchain: BitcoinIcon,
  cardSwitchio: CreditCardIcon,
  qerkoTerminal: NfcIcon,
  qerkoPayment: QerkoIcon,
  spark: ZapIcon,
  cashu: CoinsIcon,
  lightningAddress: AtSignIcon,
} satisfies Record<AccountTransactionKind, LucideIcon>
