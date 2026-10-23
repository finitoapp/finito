import { newMenuOrderAnnouncements } from "@payky/app-shared/menu-order-announcement"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import type { MenuOrderId } from "@payky/core/modules/menu-order/menu-order-types"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { router } from "expo-router"
import { useEffect, useRef } from "react"
import { useAccess } from "../../core/use-access.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

/** Web's `MenuOrderAnnouncer`, for an onboarded account. */
export function MenuOrderAnnouncer() {
  const { accountId } = useAccess()
  const [settings] = useEvoluQuery(settingsQuery).data

  if (settings === undefined) return null
  return <NewOrderToasts key={accountId} />
}

function NewOrderToasts() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: orders } = useEvoluQuery(menuOrdersToServeQuery)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const announcedRef = useRef<ReadonlySet<MenuOrderId> | null>(null)

  useEffect(() => {
    const announced = announcedRef.current
    announcedRef.current = new Set(orders.map(({ id }) => id))

    for (const message of newMenuOrderAnnouncements({
      announced,
      orders,
      tables,
      t,
    })) {
      toast.withAction(message, {
        label: t("orders.announced.open"),
        onPress: () => router.push("/orders"),
      })
    }
  }, [orders, tables, t, toast])

  return null
}
