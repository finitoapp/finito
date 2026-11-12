import { waitingMenuOrdersNotice } from "@payky/app-shared/menu-order-announcement"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import { router, usePathname } from "expo-router"
import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { View } from "tamagui"
import { waitingOrdersNoticeHeightAtom } from "../../atoms/toast.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { Toast } from "../ui/toast.tsx"

/** Web's `MenuOrderAnnouncer`, for an onboarded account. */
export function MenuOrderAnnouncer() {
  const [settings] = useEvoluQuery(settingsQuery).data

  if (settings === undefined) return null
  return <WaitingOrdersToast />
}

function WaitingOrdersToast() {
  const { t } = useTranslation()
  const locale = useLocale()
  const onOrders = usePathname() === "/orders"
  const { data: orders } = useEvoluQuery(menuOrdersToServeQuery)
  const { data: tables } = useEvoluQuery(tablesQuery)
  const notice = waitingMenuOrdersNotice({
    orders,
    tables,
    t,
    formatMoney: (money) => formatMoney(money, locale),
  })

  const shown = !onOrders && notice !== null
  const setNoticeHeight = useSetAtom(waitingOrdersNoticeHeightAtom)
  useEffect(() => {
    if (!shown) return
    return () => setNoticeHeight(0)
  }, [shown, setNoticeHeight])

  if (!shown) return null
  return (
    <View
      onLayout={(event) => setNoticeHeight(event.nativeEvent.layout.height)}
    >
      <Toast
        variant="default"
        message={notice}
        action={{
          label: t("orders.announced.open"),
          onPress: () => router.push("/orders"),
        }}
      />
    </View>
  )
}
