import { waitingMenuOrdersNotice } from "@payky/app-shared/menu-order-announcement"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { toast } from "sonner"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

const WAITING_ORDERS_TOAST_ID = "menu-orders-waiting"

const measureWaitingOrdersNotice = (text: HTMLSpanElement | null) => {
  const notice = text?.closest<HTMLElement>(".waiting-orders-notice")
  if (notice === null || notice === undefined) return
  const rootStyle = document.documentElement.style
  const observer = new ResizeObserver(() => {
    rootStyle.setProperty(
      "--waiting-orders-notice-height",
      `calc(${notice.offsetHeight.toString()}px + 1rem)`
    )
  })
  observer.observe(notice)
  return () => {
    observer.disconnect()
    rootStyle.removeProperty("--waiting-orders-notice-height")
  }
}

export function MenuOrderAnnouncer() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const onOrders = useLocation({
    select: (location) => location.pathname === "/orders",
  })
  const { data: orders } = useEvoluQuery(menuOrdersToServeQuery)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const notice = onOrders
    ? null
    : waitingMenuOrdersNotice({
        orders,
        tables,
        t,
        formatMoney: (money) => formatMoney(money, locale),
      })

  useEffect(() => {
    if (notice === null) {
      toast.dismiss(WAITING_ORDERS_TOAST_ID)
      return
    }
    toast(<span ref={measureWaitingOrdersNotice}>{notice}</span>, {
      id: WAITING_ORDERS_TOAST_ID,
      className: "waiting-orders-notice",
      duration: Number.POSITIVE_INFINITY,
      dismissible: false,
      action: {
        label: t("orders.announced.open"),
        onClick: (event) => {
          event.preventDefault()
          void navigate({ to: "/orders" })
        },
      },
    })
  }, [notice, navigate, t])

  useEffect(
    () => () => {
      toast.dismiss(WAITING_ORDERS_TOAST_ID)
    },
    []
  )

  return null
}
