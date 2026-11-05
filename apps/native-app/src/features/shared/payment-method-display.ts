import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import type { LucideIcon } from "lucide-react-native"
import AtSign from "lucide-react-native/icons/at-sign"
import Banknote from "lucide-react-native/icons/banknote"
import Bitcoin from "lucide-react-native/icons/bitcoin"
import Coins from "lucide-react-native/icons/coins"
import CreditCard from "lucide-react-native/icons/credit-card"
import Landmark from "lucide-react-native/icons/landmark"
import Nfc from "lucide-react-native/icons/nfc"
import Zap from "lucide-react-native/icons/zap"
import { QerkoIcon } from "../../components/qerko-icon.tsx"

/**
 * How the method that actually settled a payment (its claimed transaction's
 * `kind`) renders, as web's `payment-method-display.tsx`: the payment
 * detail's "Paid by" label and the activity list's per-row icon.
 */
export const paymentMethodIcon = {
  cashRegister: Banknote,
  iban: Landmark,
  onchain: Bitcoin,
  cardSwitchio: CreditCard,
  qerkoTerminal: Nfc,
  qerkoPayment: QerkoIcon,
  spark: Zap,
  cashu: Coins,
  lightningAddress: AtSign,
} satisfies Record<AccountTransactionKind, LucideIcon>
