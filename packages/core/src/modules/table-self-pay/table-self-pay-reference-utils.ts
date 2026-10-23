import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { z } from "zod"

export const SELF_PAY_POINTER_LENGTH = 32

const BILL_REFERENCE_BASE = 1_000_000_000n
const BILL_REFERENCE_RANGE = 8_000_000_000n
const ORDER_REFERENCE_BASE = 9_000_000_000n
const ORDER_REFERENCE_RANGE = 1_000_000_000n
const POINTER_HASH_BYTES = 8
const MAX_BANK_MESSAGE_LENGTH = 140
const MAX_LIGHTNING_MEMO_LENGTH = 120

const BANK_MESSAGE_PATTERN = new RegExp(
  `^PK1(?<pointer>[A-Z2-7]{${SELF_PAY_POINTER_LENGTH}})$`,
  "u"
)
const LIGHTNING_MEMO_PATTERN = new RegExp(
  `^PK1 (?<reference>\\d{10}) (?<pointer>[A-Z2-7]{${SELF_PAY_POINTER_LENGTH}}) A(?<amount>\\d{1,12}) R(?<msatPerMajor>\\d{1,15})\\.(?<validFrom>\\d{1,12})\\.(?<tag>[A-Z2-7]{16})$`,
  "u"
)

export const SelfPayReferenceSchema = z
  .string()
  .regex(/^[1-9]\d{9}$/u)
  .brand<"SelfPayReference">()
export type SelfPayReference = z.output<typeof SelfPayReferenceSchema>

export const SelfPayPointerSchema = z
  .string()
  .regex(new RegExp(`^[A-Z2-7]{${SELF_PAY_POINTER_LENGTH}}$`, "u"))
  .brand<"SelfPayPointer">()
export type SelfPayPointer = z.output<typeof SelfPayPointerSchema>

const DigitsSchema = z.coerce.number().int().nonnegative()

const BankMessageSchema = z.object({ pointer: SelfPayPointerSchema })

const LightningMemoSchema = z
  .object({
    reference: SelfPayReferenceSchema,
    pointer: SelfPayPointerSchema,
    amount: DigitsSchema,
    msatPerMajor: DigitsSchema,
    validFrom: DigitsSchema,
    tag: z.string(),
  })
  .transform(({ msatPerMajor, validFrom, tag, ...memo }) => ({
    ...memo,
    rate: { msatPerMajor, validFrom, tag },
  }))

type SelfPayBankMessage = z.output<typeof BankMessageSchema>
type SelfPayLightningMemo = z.output<typeof LightningMemoSchema>
export type SelfPayMemoRate = SelfPayLightningMemo["rate"]

const encodeText = (text: string) => new TextEncoder().encode(text)

const deriveReference = (label: string, base: bigint, range: bigint) => {
  const hash = sha256(encodeText(label))
  const offset = BigInt(`0x${bytesToHex(hash)}`) % range

  return SelfPayReferenceSchema.decode(String(base + offset))
}

export const deriveBillSelfPayReference = (billId: string): SelfPayReference =>
  deriveReference(
    `payky/bill-ref/v1:${billId}`,
    BILL_REFERENCE_BASE,
    BILL_REFERENCE_RANGE
  )

export const deriveOrderSelfPayReference = (
  pointer: string
): SelfPayReference =>
  deriveReference(
    `payky/order-ref/v1:${pointer}`,
    ORDER_REFERENCE_BASE,
    ORDER_REFERENCE_RANGE
  )

export const isOrderSelfPayReference = (reference: SelfPayReference): boolean =>
  reference.startsWith("9")

export const deriveSelfPayPointerHash = (pointer: SelfPayPointer): string =>
  bytesToHex(sha256(encodeText(pointer)).slice(0, POINTER_HASH_BYTES))

export const formatSelfPayBankMessage = ({
  pointer,
}: SelfPayBankMessage): string => `PK1${pointer}`

export const formatSelfPayLightningMemo = ({
  reference,
  pointer,
  amount,
  rate,
}: SelfPayLightningMemo): string =>
  `PK1 ${reference} ${pointer} A${amount} R${rate.msatPerMajor}.${rate.validFrom}.${rate.tag}`

export const parseSelfPayBankMessage = (
  message: string | null
): SelfPayBankMessage | null => {
  if (message === null || message.length > MAX_BANK_MESSAGE_LENGTH) return null

  const groups = BANK_MESSAGE_PATTERN.exec(
    message.replaceAll(/\s/gu, "").toUpperCase()
  )?.groups
  const parsed = BankMessageSchema.safeParse(groups)
  return parsed.success ? parsed.data : null
}

export const parseSelfPayLightningMemo = (
  memo: string | null
): SelfPayLightningMemo | null => {
  if (memo === null || memo.length > MAX_LIGHTNING_MEMO_LENGTH) return null

  const groups = LIGHTNING_MEMO_PATTERN.exec(memo)?.groups
  const parsed = LightningMemoSchema.safeParse(groups)
  return parsed.success ? parsed.data : null
}
