import { useNow } from "@payky/app-shared/use-now"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  findUsableSelfPayRate,
  type SelfPaySignedRate,
  selfPayRateChangesAt,
} from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import type { SelfPayLiveness } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"

export const useUsableSelfPayRate = (
  liveness: SelfPayLiveness | null,
  currency: string | null
): SelfPaySignedRate | null => {
  const now = useNow(
    currency === null
      ? []
      : selfPayRateChangesAt(liveness, currency).map((moment) =>
          TimestampMs(moment * 1000)
        )
  )
  return currency === null
    ? null
    : findUsableSelfPayRate(
        liveness,
        currency,
        Math.floor(now.getTime() / 1000)
      )
}
