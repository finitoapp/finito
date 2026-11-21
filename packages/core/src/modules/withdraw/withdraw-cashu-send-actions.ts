import { ok, type Task } from "@evolu/common"
import { toWalletProofs } from "../../cashu/cashu-melt.ts"
import {
  type CashuSendCost,
  type CashuSendError,
  type CashuSendNotPendingError,
  costOfCashuSend,
  returnCashuSend,
  sendCashu,
} from "../../cashu/cashu-send.ts"
import type { CashuTopupDeps } from "../../cashu/cashu-topup.ts"
import { checkProofStates, loadCashuWallet } from "../../cashu/cashu-wallet.ts"
import type {
  DateDep,
  DeviceIdDep,
  EvoluOwnerDep,
  MasterKeyDep,
} from "../../deps.ts"
import type { ResolvedLinkyContact } from "../../integrations/linky/linky-contact.ts"
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
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { CashuOperationId, MintUrl } from "../cashu/cashu-types.ts"
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
  NonNegativeInteger,
  PositiveInteger,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { markWithdrawalFailed } from "./withdraw-actions.ts"
import { pendingCashuSendWithdrawalsQuery } from "./withdraw-queries.ts"
import type { WithdrawalId } from "./withdraw-types.ts"

/**
 * Ecash to a Linky user (withdraw/0015): the amount is swapped out of one
 * mint of the shared wallet as a token and handed over as a NIP-17 message,
 * the way Linky and Fazole send to a contact. It is a withdrawal like any
 * other: recorded before anything leaves (withdraw/0001), booked as the
 * movement of the sats and the swap's fee as soon as a relay holds the
 * token, and failed, with the proofs the wallet's again, when none does.
 */

/** Who the token goes to: a Linky contact as resolved. */
export type CashuSendRecipient = ResolvedLinkyContact

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
    const cost = await run(costOfCashuSend({ mint, amount: amountSats }))
    if (!cost.ok) return cost
    return ok({
      mint,
      recipient,
      amountSats: cost.value.amount,
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
      run.ok(markWithdrawalFailed({ withdrawalId, reason: "rejected" }))

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
        {
          id: withdrawalId,
          sendOperationId: operationId,
          feeSats: NonNegativeInteger(feePaid),
        },
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
    await run(
      bookCashuSend({
        accountId,
        accountTransactionId,
        deviceId,
        mint: quote.mint,
        operationId,
        totalSpent,
      })
    )
    return ok({ withdrawalId, totalSpent })
  }

/**
 * The movement of a send whose token left: the sats and the swap's fee, as
 * one `auto` transaction under the withdrawal's own id.
 */
const bookCashuSend =
  ({
    accountId,
    accountTransactionId,
    deviceId,
    mint,
    operationId,
    totalSpent,
  }: {
    readonly accountId: AccountId
    readonly accountTransactionId: AccountTransactionId
    readonly deviceId: DeviceId | null
    readonly mint: MintUrl
    readonly operationId: CashuOperationId
    readonly totalSpent: number
  }): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const computed = computeAccountTransactionRows(
      {
        id: accountTransactionId,
        accountId,
        amount: Integer(-totalSpent),
        currency: "BTC",
        occurredAt: TimestampMsSchema.decode(run.deps.date.now().getTime()),
        note: null,
        internalTransferGroupId: null,
        source: { deviceId, source: "auto" },
        cashu: { cashuOperationId: operationId, quoteId: null, mintUrl: mint },
      },
      run.deps.date.now()
    )
    await runMutationWithCompletion((options) =>
      upsertAccountTransactionRows(run.deps.evolu, computed, {
        ...options,
        owner: run.deps.evoluOwner,
      })
    )
    return ok()
  }

/**
 * Long enough that no send is still running: one takes seconds.
 * ponytail: a fixed wait, not a per-send lease; a send outliving it on a
 * stalled device would be settled under it, by the same rules.
 */
export const CASHU_SEND_SETTLE_AFTER_MS = 10 * 60_000

/**
 * Settles the Linky contact withdrawals a crash left pending (withdraw/0016),
 * from what the shared wallet and the mint say, never by guessing:
 *
 * - no send linked, on the device that made it: nothing that it knows of
 *   left, so it fails;
 * - the send taken back (`returned`: this device's failed delivery, or the
 *   merchant in Linky): the sats are the wallet's again, so it fails;
 * - the send redeemed (its handed-out proofs spent at the mint, or Linky
 *   closed it `done`): the token left, so it is booked;
 * - otherwise it stays pending until one of those happens. The token may be
 *   with the recipient, so the proofs are never returned on their own
 *   (withdraw/0015).
 */
export const settlePendingCashuSends: Task<
  void,
  never,
  CashuTopupDeps & EvoluDep & EvoluOwnerDep & DateDep & DeviceIdDep
> = async (run) => {
  const store = run.deps.cashuShardStore
  const nowMs = run.deps.date.now().getTime()
  const pending = await run.deps.evolu.loadQuery(
    pendingCashuSendWithdrawalsQuery
  )
  for (const withdrawal of pending) {
    if (
      nowMs - new Date(withdrawal.createdAt).getTime() <
      CASHU_SEND_SETTLE_AFTER_MS
    )
      continue
    const fail = () =>
      run.ok(
        markWithdrawalFailed({
          withdrawalId: withdrawal.id,
          reason: "rejected",
        })
      )
    if (withdrawal.sendOperationId === null) {
      // Another device's link may still be syncing.
      if (withdrawal.deviceId === run.deps.deviceId) await fail()
      continue
    }
    const operation = await store.loadOperation(withdrawal.sendOperationId)
    if (operation === null || operation.kind !== "send") continue
    if (operation.status === "returned") {
      await fail()
      continue
    }
    if (
      operation.status !== "done" &&
      !(await run.ok(isCashuSendRedeemed(operation.id, operation.mint)))
    )
      continue
    await run(
      bookCashuSend({
        accountId: withdrawal.accountId,
        accountTransactionId: withdrawal.accountTransactionId,
        deviceId: withdrawal.deviceId,
        mint: withdrawal.mintUrl,
        operationId: operation.id,
        // ponytail: a send from before `feeSats` books without its fee.
        totalSpent: operation.amount + (withdrawal.feeSats ?? 0),
      })
    )
  }
  return ok()
}

/** Whether every proof a send handed out is spent at its mint. */
const isCashuSendRedeemed =
  (
    operationId: CashuOperationId,
    mint: MintUrl
  ): Task<boolean, never, CashuTopupDeps> =>
  async (run) => {
    const handedOut = (await run.deps.cashuShardStore.loadProofs()).filter(
      (proof) => proof.operationId === operationId
    )
    if (handedOut.length === 0) return ok(false)
    const loaded = await run(loadCashuWallet(mint))
    if (!loaded.ok) return ok(false)
    const states = await checkProofStates(
      loaded.value,
      toWalletProofs(handedOut)
    )
    return ok(states.ok && states.value.every((state) => state === "spent"))
  }
