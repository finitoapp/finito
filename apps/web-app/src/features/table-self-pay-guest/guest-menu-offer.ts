import {
  countSelfPayMenuItems,
  type SelfPayMenu,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { findSelfPayBank } from "@payky/core/modules/table-self-pay/table-self-pay-guest-utils"
import type { SelfPayView } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"

export interface GuestMenuOffer {
  readonly orderable: SelfPayMenu | null
  readonly writable: SelfPayMenu | null
}

export const guestMenuOffer = (
  view: SelfPayView,
  menu: SelfPayMenu | null
): GuestMenuOffer => {
  if (
    menu === null ||
    (findSelfPayBank(view, menu) === null && view.lightning === null)
  ) {
    return { orderable: null, writable: null }
  }
  return {
    orderable: countSelfPayMenuItems(menu) > 0 ? menu : null,
    writable: menu.written ? menu : null,
  }
}
