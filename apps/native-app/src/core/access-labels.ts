import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  AccessPreset,
  Permission,
} from "@payky/core/modules/access/access-types"

export const permissionLabelKeys = {
  sell: "access.permission.sell",
  activity: "access.permission.activity",
  discard: "access.permission.discard",
  refund: "access.permission.refund",
  confirm: "access.permission.confirm",
  stats: "access.permission.stats",
  catalog: "access.permission.catalog",
  settings: "access.permission.settings",
  admin: "access.permission.admin",
} satisfies Record<Permission, TranslationKey>

export const permissionDescriptionKeys = {
  sell: "access.permission.sell.description",
  activity: "access.permission.activity.description",
  discard: "access.permission.discard.description",
  refund: "access.permission.refund.description",
  confirm: "access.permission.confirm.description",
  stats: "access.permission.stats.description",
  catalog: "access.permission.catalog.description",
  settings: "access.permission.settings.description",
  admin: "access.permission.admin.description",
} satisfies Record<Permission, TranslationKey>

export const accessPresetLabelKeys = {
  none: "access.preset.none",
  basic: "access.preset.basic",
  staff: "access.preset.staff",
  shiftLead: "access.preset.shiftLead",
  manager: "access.preset.manager",
  owner: "access.preset.owner",
} satisfies Record<AccessPreset, TranslationKey>
