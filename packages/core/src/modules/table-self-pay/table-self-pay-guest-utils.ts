import { bytesToHex } from "@noble/hashes/utils.js"
import type { z } from "zod"

import {
  getNostrTag,
  type NostrEvent,
  verifyNostrEvent,
} from "../../integrations/nostr/nostr-event.ts"
import type {
  NostrFilter,
  NostrRelayClient,
} from "../../integrations/nostr/nostr-relay-client.ts"
import type { BankQrFormat } from "../account/account-types.ts"
import {
  currencyFractionDigits,
  minorUnitsToFixedDecimalString,
} from "../shared/money.ts"
import { Integer } from "../shared/schema.ts"
import type { TableSelfPayAddressKeys } from "./table-self-pay-address-utils.ts"
import {
  selfPayRateValidUntil,
  selfPaySatsForAmount,
} from "./table-self-pay-rate-utils.ts"
import {
  deriveSelfPayPointerHash,
  formatSelfPayBankMessage,
  formatSelfPayLightningMemo,
  type SelfPayPointer,
} from "./table-self-pay-reference-utils.ts"
import {
  deriveSelfPayLivenessTag,
  deriveSelfPayViewTag,
  parseSelfPayContent,
  SELF_PAY_STALE_AFTER_SECONDS,
  SELF_PAY_VIEW_KIND,
  type SelfPayConfirmation,
  type SelfPayLiveness,
  type SelfPayView,
  type SelfPayViewBill,
} from "./table-self-pay-view-utils.ts"

const RATE_SAFETY_SECONDS = 60
const MAX_RECIPIENT_NAME_LENGTH = 35
const MAX_BENEFICIARY_NAME_LENGTH = 70

export type SelfPaySignedRate = SelfPayLiveness["rates"][number]

export interface SelfPayContent<T> {
  readonly value: T
  readonly createdAt: number
}

export const createSelfPayViewFilter = ({
  publicKey,
  viewKey,
}: TableSelfPayAddressKeys): NostrFilter => ({
  kinds: [SELF_PAY_VIEW_KIND],
  authors: [bytesToHex(publicKey)],
  "#d": [deriveSelfPayViewTag(viewKey), deriveSelfPayLivenessTag(viewKey)],
})

export const pickNewestSelfPayContent = <T>({
  events,
  publicKey,
  viewKey,
  tag,
  schema,
}: {
  readonly events: ReadonlyArray<NostrEvent>
  readonly publicKey: Uint8Array
  readonly viewKey: Uint8Array
  readonly tag: string
  readonly schema: z.ZodType<T>
}): SelfPayContent<T> | null => {
  const author = bytesToHex(publicKey)
  const newestFirst = events
    .filter(
      (event) =>
        event.pubkey === author &&
        getNostrTag(event, "d") === tag &&
        verifyNostrEvent(event)
    )
    .sort((left, right) => right.created_at - left.created_at)
  for (const event of newestFirst) {
    const value = parseSelfPayContent(schema, viewKey, event.content)
    if (value !== null) return { value, createdAt: event.created_at }
  }
  return null
}

export const keepNewerSelfPayContent = <T>(
  shown: SelfPayContent<T> | null,
  fetched: SelfPayContent<T> | null
): SelfPayContent<T> | null =>
  shown !== null && (fetched === null || fetched.createdAt < shown.createdAt)
    ? shown
    : fetched

export const selfPayViewConfirmedAt = (
  view: SelfPayContent<SelfPayView> | null,
  liveness: SelfPayContent<SelfPayLiveness> | null
): number | null =>
  view !== null &&
  liveness !== null &&
  liveness.value.viewVersion <= view.createdAt
    ? liveness.createdAt
    : null

export const isSelfPayViewStale = (
  confirmedAt: number | null,
  now: number
): boolean =>
  confirmedAt === null || now - confirmedAt > SELF_PAY_STALE_AFTER_SECONDS

export const selfPayViewStaleFrom = (
  confirmedAt: number | null
): number | null =>
  confirmedAt === null ? null : confirmedAt + SELF_PAY_STALE_AFTER_SECONDS + 1

export const findSelfPayConfirmation = (
  view: SelfPayView,
  pointer: SelfPayPointer
): SelfPayConfirmation | null =>
  view.confirmations.find(
    ({ pointerHash }) => pointerHash === deriveSelfPayPointerHash(pointer)
  ) ?? null

export const publishSelfPaySelection = ({
  relayClient,
  relays,
  event,
}: {
  readonly relayClient: NostrRelayClient
  readonly relays: ReadonlyArray<string>
  readonly event: NostrEvent
}): Promise<boolean> => {
  const firstAccepted = Promise.withResolvers<boolean>()
  const publishTo = async (url: string) => {
    const results = await relayClient.publish([url], event)
    if (results.some(({ accepted }) => accepted)) firstAccepted.resolve(true)
  }
  const publishToAll = async () => {
    await Promise.all(relays.map(publishTo))
    firstAccepted.resolve(false)
  }
  void publishToAll()
  return firstAccepted.promise
}

export const findUsableSelfPayRate = (
  liveness: SelfPayLiveness | null,
  currency: string,
  now: number
): SelfPaySignedRate | null =>
  liveness?.rates.find(
    (rate) =>
      rate.currency === currency &&
      rate.validFrom <= now &&
      now + RATE_SAFETY_SECONDS < selfPayRateValidUntil(rate.validFrom)
  ) ?? null

export const selfPayRateChangesAt = (
  liveness: SelfPayLiveness | null,
  currency: string
): ReadonlyArray<number> =>
  (liveness?.rates ?? [])
    .filter((rate) => rate.currency === currency)
    .flatMap((rate) => [
      rate.validFrom,
      selfPayRateValidUntil(rate.validFrom) - RATE_SAFETY_SECONDS,
    ])

export const findSelfPayBank = (
  view: SelfPayView,
  bill: Pick<SelfPayViewBill, "currency">
): SelfPayView["bank"] =>
  view.bank?.currency === bill.currency ? view.bank : null

const fitSpaydValue = (value: string, maxLength: number): string => {
  let fitted = ""
  for (const character of value) {
    const escaped = character === "*" ? "%2A" : character
    if (fitted.length + escaped.length > maxLength) break
    fitted += escaped
  }
  return fitted
}

interface SelfPayBankPayment {
  readonly bank: NonNullable<SelfPayView["bank"]>
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly amount: number
  readonly pointer: SelfPayPointer
}

export const createSelfPaySpaydPayload = ({
  bank,
  bill,
  amount,
  pointer,
}: SelfPayBankPayment): string =>
  [
    "SPD",
    "1.0",
    `ACC:${bank.iban}`,
    `AM:${minorUnitsToFixedDecimalString({ value: Integer(amount), currency: bill.currency })}`,
    `CC:${bill.currency}`,
    "PT:IP",
    `X-VS:${bill.reference}`,
    `MSG:${formatSelfPayBankMessage({ pointer })}`,
    ...(bank.accountName === ""
      ? []
      : [`RN:${fitSpaydValue(bank.accountName, MAX_RECIPIENT_NAME_LENGTH)}`]),
  ].join("*")

const createSelfPayPayBySquarePayload = async ({
  bank,
  bill,
  amount,
  pointer,
  format,
}: SelfPayBankPayment & {
  readonly format: Exclude<BankQrFormat, "spayd">
}): Promise<string> => {
  const [{ Version }, { encode, PaymentOptions }] = await Promise.all([
    import("bysquare"),
    import("bysquare/pay"),
  ])
  return encode(
    {
      payments: [
        {
          type: PaymentOptions.PaymentOrder,
          amount: Number(
            minorUnitsToFixedDecimalString({
              value: Integer(amount),
              currency: bill.currency,
            })
          ),
          currencyCode: bill.currency,
          variableSymbol: bill.reference,
          paymentNote: formatSelfPayBankMessage({ pointer }),
          beneficiary: {
            name: [...bank.accountName]
              .slice(0, MAX_BENEFICIARY_NAME_LENGTH)
              .join(""),
          },
          bankAccounts: [{ iban: bank.iban }],
        },
      ],
    },
    {
      version:
        format === "payBySquare1_0_0" || bank.accountName === ""
          ? Version["1.0.0"]
          : Version["1.2.0"],
      deburr: true,
    }
  )
}

export const createSelfPayBankQrPayload = async ({
  format,
  ...payment
}: SelfPayBankPayment & { readonly format: BankQrFormat }): Promise<string> =>
  format === "spayd"
    ? createSelfPaySpaydPayload(payment)
    : createSelfPayPayBySquarePayload({ ...payment, format })

export const createSelfPayLightningRequest = ({
  bill,
  amount,
  pointer,
  rate,
}: {
  readonly bill: Pick<SelfPayViewBill, "reference" | "currency">
  readonly amount: number
  readonly pointer: SelfPayPointer
  readonly rate: SelfPaySignedRate
}): { readonly amountSats: number; readonly memo: string } => ({
  amountSats: selfPaySatsForAmount({
    amount,
    fractionDigits: currencyFractionDigits[bill.currency],
    msatPerMajor: rate.msatPerMajor,
  }),
  memo: formatSelfPayLightningMemo({
    reference: bill.reference,
    pointer,
    amount,
    rate,
  }),
})
