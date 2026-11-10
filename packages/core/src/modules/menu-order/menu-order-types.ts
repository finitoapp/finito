import { id } from "@evolu/common"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const MenuOrderIdRaw = id("MenuOrder")
export const MenuOrderId = standardSchemaToZod(MenuOrderIdRaw)
export type MenuOrderId = typeof MenuOrderIdRaw.Output

export const MenuVersionIdRaw = id("MenuVersion")
export const MenuVersionId = standardSchemaToZod(MenuVersionIdRaw)
export type MenuVersionId = typeof MenuVersionIdRaw.Output
