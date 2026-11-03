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
import { ActivityTabs } from "@/features/shared/activity-tabs.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/** The Activity tab's payments list, header and tabs included. */
export function PaymentHistoryPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("activity.title")} startAddon={null} />

      <section className="flex flex-col gap-8">
        <ActivityTabs active="payments" />
        <Suspense fallback={<ActivityHistorySkeleton />}>
          <PaymentHistory />
        </Suspense>
      </section>
    </>
  )
}

/** The Activity tab's bills list, header and tabs included. */
export function BillHistoryPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("activity.title")} startAddon={null} />

      <section className="flex flex-col gap-8">
        <ActivityTabs active="bills" />
        <Suspense fallback={<ActivityHistorySkeleton />}>
          <BillHistory />
        </Suspense>
      </section>
    </>
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

export function BillDetailPage({ billId }: { readonly billId: string }) {
  const { t } = useTranslation()

  return (
    <>
      <FadeHeader title={t("billDetail.title")} />

      <section className="pt-16">
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <BillDetail billId={billId} />
        </Suspense>
      </section>
    </>
  )
}
