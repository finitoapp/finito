import { createIdFromString, id } from "@evolu/common"
import { z } from "zod"

import { standardSchemaToZod } from "../../zod-utils.ts"

export const AccessControlIdRaw = id("AccessControl")
export const AccessControlId = standardSchemaToZod(AccessControlIdRaw)
export type AccessControlId = typeof AccessControlIdRaw.Output

/**
 * The same id on every device, so two devices write one row and the merge
 * resolves each column last-write-wins instead of leaving two rows.
 */
export const accessControlId = createIdFromString<"AccessControl">(
  "payky-access-control"
)

/** What a device's defaults are made of (access/0012). The PIN grants all. */
export const PermissionSchema = z.enum([
  "sell",
  "activity",
  "discard",
  "refund",
  "confirm",
  "stats",
  "catalog",
  "settings",
  "admin",
])
export type Permission = z.output<typeof PermissionSchema>

export const permissions: ReadonlyArray<Permission> = PermissionSchema.options

/** What a `_terminal` route declares in `staticData.access` (access/0003). */
export type RouteAccess = Permission | "free"

export type AccessPreset =
  | "none"
  | "basic"
  | "staff"
  | "shiftLead"
  | "manager"
  | "owner"

const basic: ReadonlyArray<Permission> = ["sell", "activity"]
const staff: ReadonlyArray<Permission> = [...basic, "discard"]
const shiftLead: ReadonlyArray<Permission> = [...staff, "refund", "confirm"]

/** Templates copied onto a device when chosen (rule 6), never linked. */
export const accessPresets = {
  none: [],
  basic,
  staff,
  shiftLead,
  manager: [...shiftLead, "stats", "catalog", "settings"],
  owner: permissions,
} satisfies Record<AccessPreset, ReadonlyArray<Permission>>

/** After this many failed attempts in a row PIN entry blocks (rule 7). */
export const maxFailedPinAttempts = 5

/** A session ends after this long without activity (rule 10). */
export const sessionIdleTimeoutMs = 5 * 60 * 1000
