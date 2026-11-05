import { id } from "@evolu/common"
import { z } from "zod"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const AppSettingsIdRaw = id("AppSettings")
export const AppSettingsId = standardSchemaToZod(AppSettingsIdRaw)
export type AppSettingsId = typeof AppSettingsIdRaw.Output

export const DefaultPaymentMethodSchema = z.enum([
  "cashRegister",
  "spark",
  "iban",
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "cashu",
  "lightningAddress",
])
export type DefaultPaymentMethod = z.output<typeof DefaultPaymentMethodSchema>

export const TerminalHomeModeSchema = z.enum(["numpad", "pos"])
export type TerminalHomeMode = z.output<typeof TerminalHomeModeSchema>
