import { ok, type Task } from "@evolu/common"

import {
  type CashuSendCost,
  type CashuSendError,
  type CashuSendNotPendingError,
  cashuSendBalance,
  costOfCashuSend,
  returnCashuSend,
  sendCashu,
} from "../../cashu/cashu-send.ts"
import type { CashuTopupDeps } from "../../cashu/cashu-topup.ts"
import type { DateDep, EvoluOwnerDep, MasterKeyDep } from "../../deps.ts"
import {
  type CashuTokenNotDeliveredError,
  sendCashuTokenMessage,
} from "../../integrations/nostr/nostr-cashu-send.ts"
import type { NostrDep } from "../../integrations/nostr/nostr-client.ts"
import type { AccountId } from "../account/account-types.ts"
import {
  computeAccountTransactionRows,
  upsertAccountTransactionRows,
} from "../account-transaction/account-transaction-actions.ts"
import type { MintUrl } from "../cashu/cashu-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  Integer,
  type NonEmptyString255,
  NonEmptyStringSchema,
  PositiveInteger,
  TimestampMsSchema,
} from "../shared/schema.ts"
import type { WithdrawalId } from "./withdraw-types.ts"

/**
 * Ecash to a Linky user (withdraw/0015): the amount is swapped out of one
 * mint of the shared wallet as a token and handed over as a NIP-17 message,
 * the way Linky and Fazole send to a contact. It is a withdrawal like any
 * other: recorded before anything leaves (withdraw/0001), booked as the
 * movement of the sats and the swap's fee as soon as a relay holds the
 * token, and failed, with the proofs the wallet's again, when none does.
 */

export interface CashuSendRecipient {
  readonly pubkey: string
  readonly npub: string
  /** The NIP-05 address the merchant named them by; `null` for a key given outright. */
  readonly address: string | null
}

export interface CashuSendQuote {
  readonly mint: MintUrl
  readonly recipient: CashuSendRecipient
  /** What the recipient gets. */
  readonly amountSats: number
  /** Sized to the mint's balance less the most the fee can take. */
  readonly withdrawAll: boolean
  readonly cost: CashuSendCost
}

export type QuoteCashuSendError = CashuSendError

/**
 * What sending to `recipient` costs: the amount asked for, or with
 * `amountSats` undefined everything the mint holds less the most the swap's
 * fee can take, so the whole balance leaves in one token.
 */
export const quoteCashuSend =
  ({
    mint,
    recipient,
    amountSats,
  }: {
    readonly mint: MintUrl
    readonly recipient: CashuSendRecipient
    readonly amountSats?: PositiveInteger
  }): Task<CashuSendQuote, QuoteCashuSendError, CashuTopupDeps> =>
  async (run) => {
    let amount = amountSats ?? 0
    if (amountSats === undefined) {
      // The fee of every proof is the most a whole-balance send can cost.
      const balance = await run(cashuSendBalance(mint))
      if (!balance.ok) return balance
      amount = balance.value.available - balance.value.maxFee
    }
    const cost = await run(costOfCashuSend({ mint, amount }))
    if (!cost.ok) return cost
    return ok({
      mint,
      recipient,
      amountSats: amount,
      withdrawAll: amountSats === undefined,
      cost: cost.value,
    })
  }

export type ExecuteCashuSendError =
  | CashuSendError
  | CashuSendNotPendingError
  | CashuTokenNotDeliveredError

/**
 * Records the withdrawal, makes the token, hands it over and books the
 * movement. A swap the mint refuses, or a message no relay takes, fails the
 * withdrawal with nothing gone: the token never left this device, so its
 * proofs are returned to the wallet (`returnCashuSend`).
 */
export const executeCashuSendWithdrawal =
  ({
    accountId,
    deviceId,
    quote,
    comment,
  }: {
    readonly accountId: AccountId
    readonly deviceId: DeviceId | null
    readonly quote: CashuSendQuote
    readonly comment?: NonEmptyString255
  }): Task<
    { readonly withdrawalId: WithdrawalId; readonly totalSpent: number },
    ExecuteCashuSendError,
    CashuTopupDeps &
      EvoluDep &
      EvoluOwnerDep &
      DateDep &
      NostrDep &
      MasterKeyDep
  > =>
  async (run) => {
    const withdrawalId = createRowId<"Withdrawal">()
    const accountTransactionId = createRowId<"AccountTransaction">()
    const owner = run.deps.evoluOwner
    const now = () => TimestampMsSchema.decode(run.deps.date.now().getTime())

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner }
      run.deps.evolu.upsert(
        "withdrawal",
        {
          id: withdrawalId,
          accountId,
          deviceId,
          amountSats: PositiveInteger(quote.amountSats),
          accountTransactionId,
          failedAt: null,
          failureReason: null,
          comment: comment ?? null,
        },
        mutationOptions
      )
      run.deps.evolu.upsert(
        "withdrawalCashuSend",
        {
          id: withdrawalId,
          mintUrl: quote.mint,
          sendOperationId: null,
          recipientPubkey: NonEmptyStringSchema.decode(quote.recipient.pubkey),
          recipientAddress:
            quote.recipient.address === null
              ? null
              : NonEmptyStringSchema.decode(quote.recipient.address),
        },
        mutationOptions
      )
    })

    const fail = () =>
      runMutationWithCompletion((options) =>
        run.deps.evolu.update(
          "withdrawal",
          { id: withdrawalId, failedAt: now(), failureReason: "rejected" },
          { ...options, owner }
        )
      )

    const sent = await run(
      sendCashu({ mint: quote.mint, amount: quote.amountSats })
    )
    if (!sent.ok) {
      await fail()
      return sent
    }
    const { operationId, tokenText, amount, feePaid } = sent.value
    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "withdrawalCashuSend",
        { id: withdrawalId, sendOperationId: operationId },
        { ...options, owner }
      )
    )

    const delivered = await run(
      sendCashuTokenMessage({ to: quote.recipient.pubkey, tokenText })
    )
    if (!delivered.ok) {
      // Nobody saw the token: its proofs are the wallet's again.
      const returned = await run(returnCashuSend(operationId))
      if (!returned.ok) return returned
      await fail()
      return delivered
    }

    const totalSpent = amount + feePaid
    const computed = computeAccountTransactionRows(
      {
        id: accountTransactionId,
        accountId,
        amount: Integer(-totalSpent),
        currency: "BTC",
        occurredAt: now(),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId, source: "auto" },
        cashu: {
          cashuOperationId: operationId,
          quoteId: null,
          mintUrl: quote.mint,
        },
      },
      run.deps.date.now()
    )
    await runMutationWithCompletion((options) =>
      upsertAccountTransactionRows(run.deps.evolu, computed, {
        ...options,
        owner,
      })
    )
    return ok({ withdrawalId, totalSpent })
  }
