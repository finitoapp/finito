import { NostrEventSchema } from "@payky/core/integrations/nostr/nostr-event"
import {
  SelfPayPointerSchema,
  SelfPayReferenceSchema,
} from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import { jsonCodec } from "@payky/core/zod-utils"
import { z } from "zod"

const STORAGE_KEY = "payky.selfPay.pointers"
const MAX_REMEMBERED_POINTERS = 20
const PayerPointerSchema = z.object({
  pointer: SelfPayPointerSchema,
  reference: SelfPayReferenceSchema,
  event: NostrEventSchema.nullable(),
})
const PayerPointersJson = jsonCodec(z.array(PayerPointerSchema))

export type PayerPointer = z.output<typeof PayerPointerSchema>

export const readPayerPointers = (): ReadonlyArray<PayerPointer> => {
  try {
    const parsed = z.safeDecode(
      PayerPointersJson,
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    )
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export const rememberPayerPointer = (
  pointers: ReadonlyArray<PayerPointer>,
  payerPointer: PayerPointer
): ReadonlyArray<PayerPointer> => {
  const next = [
    ...pointers.filter(({ pointer }) => pointer !== payerPointer.pointer),
    payerPointer,
  ].slice(-MAX_REMEMBERED_POINTERS)
  const serialized = z.encode(PayerPointersJson, next)
  try {
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch {}
  return next
}
