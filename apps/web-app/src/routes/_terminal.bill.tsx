import { BillId, createRandomBillId } from "@payky/core/modules/bill/bill-types"
import { TableId } from "@payky/core/modules/table/table-types"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Suspense } from "react"
import { z } from "zod"
import { RouteMessage } from "@/components/route-message.tsx"
import { BillPage } from "@/features/bill/bill-page.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

// `billId` is parsed in the component, not here: a `validateSearch` throw
// on a hand-typed or stale link escapes to the global error boundary, and a
// bad id deserves the same "invalid id" page a bad /payment/<id> gets. A
// broken `tableId` is only a lost table preselection, so it just falls back
// to none.
const BillSearchSchema = z.object({
  billId: z.string().optional(),
  tableId: TableId.optional().catch(undefined),
  /** A code scanned on the home screen; `BillPage` adds it once. */
  scan: z.string().optional().catch(undefined),
})

export const Route = createFileRoute("/_terminal/bill")({
  component: BillRoute,
  validateSearch: (search) => BillSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    // A direct navigation to `/bill` with no `billId` search param at all —
    // every in-app link already includes one (see `pos-overview-page.tsx`'s
    // `NewBillLink`). Redirect here, before the route ever renders, instead
    // of generating an id inside `BillPage` itself: that component can
    // suspend on its very first render (loading the new bill's query), and
    // React retries a suspended initial render from scratch, so a
    // lazily-`useState`-generated id would be regenerated on every retry —
    // an infinite loop that never lets the page commit, leaving the
    // Suspense fallback shown forever.
    if (search.billId === undefined) {
      throw redirect({
        to: "/bill",
        search: {
          billId: createRandomBillId(),
          tableId: search.tableId,
          scan: search.scan,
        },
        replace: true,
      })
    }
  },
  staticData: {
    access: "sell",
    terminalLayout: {
      viewportClassName:
        "h-[calc(100svh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-var(--terminal-banner-height,0px)-var(--waiting-orders-notice-height,0px))] px-3 py-6 lg:max-w-none lg:px-6",
    },
  },
})

function BillRoute() {
  const { t } = useTranslation()
  const { billId, tableId, scan } = Route.useSearch()
  // A well-formed id that has no bill row yet is *not* an error: that is
  // exactly how a new cart starts (see `beforeLoad`). Only an unparseable
  // one is.
  const parsedBillId = BillId.safeParse(billId)

  if (!parsedBillId.success) {
    return <RouteMessage>{t("bill.invalidId")}</RouteMessage>
  }

  return (
    <Suspense fallback={null}>
      <BillPage
        billId={parsedBillId.data}
        initialTableId={tableId}
        initialScanCode={scan}
      />
    </Suspense>
  )
}
