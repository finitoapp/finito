import {
  countSelfPayMenuItems,
  type SelfPayMenu,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { findSelfPayBank } from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import type { SelfPayView } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"

export const guestOrderableMenu = (
  view: SelfPayView,
  menu: SelfPayMenu | null
): SelfPayMenu | null =>
  menu !== null &&
  countSelfPayMenuItems(menu) > 0 &&
  (findSelfPayBank(view, menu) !== null || view.lightning !== null)
    ? menu
    : null
