import { firstInfinitePageQuery } from "@payky/app-shared/use-infinite-evolu-query"
import { latestBillsQuery } from "@payky/core/modules/bill/bill-queries"
import { latestPaymentsQuery } from "@payky/core/modules/payment/payment-queries"
import { refundSummariesQuery } from "@payky/core/modules/refund/refund-queries"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { evoluAtom } from "../atoms/evolu.ts"

/**
 * What Activity's payments list waits on as it opens: the first page and the
 * refunds' summaries. The list preloads them itself (`usePreloadEvoluQueries`).
 */
export const paymentHistoryQueries = () =>
  [firstInfinitePageQuery(latestPaymentsQuery), refundSummariesQuery] as const

/**
 * Starts loading Activity's payments list as the press that opens it lands,
 * before the navigation renders anything: on a PAX A920Pro the list
 * otherwise suspended once it mounted, and rendered a second time ~270 ms
 * later when its rows came (2026-11-17).
 */
export function usePreloadActivity(): () => void {
  const evolu = useAtomValue(evoluAtom)
  return useCallback(() => {
    // Only warms Evolu's cache: the list reads, and reports, the same
    // queries itself.
    void Promise.allSettled(evolu.loadQueries([...paymentHistoryQueries()]))
  }, [evolu])
}

/** Activity's bills tab's first page, loading as its tab is pressed. */
export function usePreloadBillHistory(): () => void {
  const evolu = useAtomValue(evoluAtom)
  return useCallback(() => {
    void Promise.allSettled([
      evolu.loadQuery(firstInfinitePageQuery(latestBillsQuery)),
    ])
  }, [evolu])
}
