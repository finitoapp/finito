import { Suspense } from "react"

import { FadeHeader } from "@/components/fade-header.tsx"
import { ActivityHistorySkeleton } from "@/features/activity/activity-history-skeleton.tsx"
import { BillDetail } from "@/features/activity/bill-detail.tsx"
import { BillHistory } from "@/features/activity/bill-history.tsx"
import {
  PaymentDetail,
  PaymentDetailSkeleton,
} from "@/features/activity/payment-detail.tsx"
import { PaymentHistory } from "@/features/activity/payment-history.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/** The Activity tab's payments list, under `ActivityLayout`'s header and tabs. */
export function PaymentHistoryPage() {
  return (
    <Suspense fallback={<ActivityHistorySkeleton />}>
      <PaymentHistory />
    </Suspense>
  )
}

/** The Activity tab's bills list, under `ActivityLayout`'s header and tabs. */
export function BillHistoryPage() {
  return (
    <Suspense fallback={<ActivityHistorySkeleton />}>
      <BillHistory />
    </Suspense>
  )
}

export function PaymentDetailPage({
  paymentId,
}: {
  readonly paymentId: string
}) {
  const { t } = useTranslation()

  return (
    <>
      <FadeHeader title={t("paymentDetail.title")} />

      <section className="pt-16">
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <PaymentDetail paymentId={paymentId} />
        </Suspense>
      </section>
    </>
  )
}

export function BillDetailPage({
  billId,
  afterEdit,
}: {
  readonly billId: string
  readonly afterEdit?: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <FadeHeader title={t("billDetail.title")} />

      <section className="pt-16">
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <BillDetail billId={billId} afterEdit={afterEdit} />
        </Suspense>
      </section>
    </>
  )
}
