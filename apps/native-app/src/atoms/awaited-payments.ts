import { createAwaitedPayments } from "@payky/core/background-jobs/awaited-payments"
import { atom } from "jotai"

/**
 * The payments the payment wait screen awaits, one registry per app: the
 * screen registers its payment and the Spark sync job signals it once the
 * payment's record is queued. Held in memory only.
 */
export const awaitedPaymentsAtom = atom(() => createAwaitedPayments())
