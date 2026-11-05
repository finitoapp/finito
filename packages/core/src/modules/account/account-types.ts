import { id } from "@evolu/common"
import { z } from "zod"

import { standardSchemaToZod } from "../../zod-utils.ts"

export const AccountIdRaw = id("Account")
export const AccountId = standardSchemaToZod(AccountIdRaw)
export type AccountId = typeof AccountIdRaw.Output

export const AccountKindSchema = z.enum([
  "iban",
  "spark",
  "cashRegister",
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "cashu",
  "lightningAddress",
])

export type AccountKind = z.output<typeof AccountKindSchema>

export const BankQrFormatSchema = z.enum([
  "spayd",
  "payBySquare1_0_0",
  "payBySquare1_2_0",
])

export type BankQrFormat = z.output<typeof BankQrFormatSchema>
