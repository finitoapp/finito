import { waitingMenuOrdersNotice } from "@payky/app-shared/menu-order-announcement"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { router, usePathname } from "expo-router"
import { useEffect } from "react"
import { toast } from "tamagui/unstyled"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { Toast } from "../ui/toast.tsx"

const WAITING_ORDERS_TOAST_ID = "menu-orders-waiting"

/** Web's `MenuOrderAnnouncer`, for an onboarded account. */
export function MenuOrderAnnouncer() {
  const [settings] = useEvoluQuery(settingsQuery).data

  if (settings === undefined) return null
  return <WaitingOrdersToast />
}

function WaitingOrdersToast() {
  const { t } = useTranslation()
  const onOrders = usePathname() === "/orders"
  const { data: orders } = useEvoluQuery(menuOrdersToServeQuery)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const notice = onOrders
    ? null
    : waitingMenuOrdersNotice({ orders, tables, t })

  useEffect(() => {
    if (notice === null) {
      toast.dismiss(WAITING_ORDERS_TOAST_ID)
      return
    }
    toast.custom(
      () => (
        <Toast
          variant="default"
          message={notice}
          action={{
            label: t("orders.announced.open"),
            onPress: () => router.push("/orders"),
          }}
        />
      ),
      {
        id: WAITING_ORDERS_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      }
    )
  }, [notice, t])

  useEffect(
    () => () => {
      toast.dismiss(WAITING_ORDERS_TOAST_ID)
    },
    []
  )

  return null
}
