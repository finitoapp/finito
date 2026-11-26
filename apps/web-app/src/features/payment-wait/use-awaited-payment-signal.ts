import {
  type AwaitedPaymentSource,
  awaitedPaymentFor,
} from "@payky/app-shared/awaited-payment"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { awaitedPaymentsAtom } from "@/atoms/awaited-payments.ts"

/**
 * Registers the pending payment with the Spark sync job and returns whether
 * the job has signaled its record, before Evolu commits it, so the screen
 * can show Paid at once. Native's twin is `useAwaitedPaymentSignal`.
 */
export function useAwaitedPaymentSignal(
  payment: AwaitedPaymentSource | undefined,
  pending: boolean
): boolean {
  const awaitedPayments = useAtomValue(awaitedPaymentsAtom)
  const [recordedId, setRecordedId] = useState<PaymentId | null>(null)
  const id = payment?.id
  const sparkAccountId = payment?.sparkAccountId ?? null
  const amountSats = payment?.amountSats ?? null
  const lnInvoice = payment?.lnInvoice ?? null
  const sparkInvoice = payment?.sparkInvoice ?? null
  // Keyed by the values, not the row object each query result rebuilds.
  const awaited = useMemo(
    () =>
      id === undefined
        ? null
        : awaitedPaymentFor(
            { id, sparkAccountId, amountSats, lnInvoice, sparkInvoice },
            pending
          ),
    [id, sparkAccountId, amountSats, lnInvoice, sparkInvoice, pending]
  )

  useEffect(() => {
    if (awaited === null) return
    const registration = awaitedPayments.await(awaited, () =>
      setRecordedId(awaited.paymentId)
    )
    return () => registration[Symbol.dispose]()
  }, [awaitedPayments, awaited])

  return id !== undefined && recordedId === id
}
