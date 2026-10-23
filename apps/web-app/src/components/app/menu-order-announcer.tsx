import { newMenuOrderAnnouncements } from "@payky/app-shared/menu-order-announcement"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import type { MenuOrderId } from "@payky/core/modules/menu-order/menu-order-types"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function MenuOrderAnnouncer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
      toast.success(message, {
        action: {
          label: t("orders.announced.open"),
          onClick: () => {
            void navigate({ to: "/orders" })
          },
        },
      })
    }
  }, [orders, tables, navigate, t])

  return null
}
