import { type Run, sqliteTrue } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import type { DateDep, EvoluOwnerDep, MasterKeyDep } from "../deps.ts"
import {
  type CashuTokenMessage,
  fetchCashuTokenMessages,
  subscribeCashuTokenMessages,
} from "../integrations/nostr/nostr-cashu-inbox.ts"
import type { NostrDep } from "../integrations/nostr/nostr-client.ts"
import type { MintUrl } from "../modules/cashu/cashu-types.ts"
import { holdCashuReceive } from "../modules/payment/payment-actions.ts"
import { cashuTokenCandidatePaymentsQuery } from "../modules/payment/payment-queries.ts"
import { derivePaymentStatus } from "../modules/payment/payment-status-utils.ts"
import type { PaymentId } from "../modules/payment/payment-types.ts"
import type { EvoluDep } from "../modules/shared/evolu-deps.ts"
import { deriveNostrSecretKey } from "../modules/shared/key-derivation.ts"
import { loadCashuDefaultMint } from "./cashu-mints.ts"
import {
  type CashuReceiveError,
  inspectCashuToken,
  receiveCashuToken,
} from "./cashu-receive.ts"
import type { CashuTopupDeps } from "./cashu-topup.ts"

/**
 * The token half of the Cashu job (cashu.md §5 "Token", decisions 3b, 3c,
 * 5c, 12): reads NIP-17 token messages, matches each to a payment, makes
 * the payment hold its receive id, and receives it.
 *
 * - The NIP-17 message is the queue: every tick retries each message in the
 *   window whose receive is not `done` or `failed`, so a token whose mint was
 *   down, or that arrived while the app was closed, is simply tried again.
 * - A final refusal that writes nothing is remembered for the run and
 *   skipped; after a restart it costs at most one more check.
 * - Trust (cashu/0011): Payky receives only from the current default mint.
 *   A token from any other mint it leaves alone; Linky may still receive it,
 *   and then it is booked like any other incoming operation.
 * - Matching (decision 3c): the mint plays no part. A NUT-18 payload goes to
 *   the payment its id names, if that payment is open; a bare token to the
 *   one open payment of its face amount. Anything else is received
 *   unassigned, and nothing assigns it afterwards.
 */

export type CashuTokenListenerDeps = CashuTopupDeps &
  EvoluDep &
  EvoluOwnerDep &
  NostrDep &
  MasterKeyDep &
  DateDep

export interface CashuTokenArrival {
  readonly mint: MintUrl
  readonly amount: number
  /** The mint's input fee, once the mint was asked. */
  readonly fee: number | null
  readonly state: /** From a mint Payky does not receive from (cashu/0011): not received. */
    | "untrustedMint"
    | "receiving"
    | "waitingForMint"
    | "received"
    | "receivedElsewhere"
    | "failed"
  readonly failure: CashuReceiveError["type"] | null
}

/**
 * What the wait screen shows of tokens sent for a payment before their
 * receive settles it. In memory, per page session.
 * ponytail: a module-level store; move into an atom if the jobs ever run in
 * another context than the page that shows the payment.
 */
const arrivals = new Map<PaymentId, CashuTokenArrival>()
const arrivalListeners = new Set<() => void>()

export const cashuTokenArrivals = {
  get: (paymentId: PaymentId): CashuTokenArrival | null =>
    arrivals.get(paymentId) ?? null,
  subscribe: (listener: () => void): (() => void) => {
    arrivalListeners.add(listener)
    return () => arrivalListeners.delete(listener)
  },
}

const setArrival = (paymentId: PaymentId, arrival: CashuTokenArrival) => {
  arrivals.set(paymentId, arrival)
  for (const listener of arrivalListeners) listener()
}

export interface CashuTokenCandidate {
  readonly paymentId: PaymentId
  readonly amountSats: number
  readonly open: boolean
}

export type CashuTokenMatch =
  | { readonly type: "payment"; readonly paymentId: PaymentId }
  | { readonly type: "unassigned" }

export const matchCashuToken = ({
  amount,
  requestId,
  candidates,
}: {
  readonly amount: number
  /** The NUT-18 payload's id, or null for a bare token. */
  readonly requestId: string | null
  readonly candidates: ReadonlyArray<CashuTokenCandidate>
}): CashuTokenMatch => {
  if (requestId !== null) {
    const named = candidates.find(
      (candidate) => candidate.paymentId === requestId
    )
    return named === undefined || !named.open
      ? { type: "unassigned" }
      : { type: "payment", paymentId: named.paymentId }
  }
  const fitting = candidates.filter(
    (candidate) => candidate.open && candidate.amountSats === amount
  )
  const [only] = fitting
  return fitting.length === 1 && only !== undefined
    ? { type: "payment", paymentId: only.paymentId }
    : { type: "unassigned" }
}

const WAITING_RETRY_MS = 30_000

const finalRefusals = new Set<CashuReceiveError["type"]>([
  "TokenLocked",
  "TokenUndecodable",
  "TokenAlreadyKnown",
  "AmountConsumedByFee",
  "ProofsSpent",
  "MintRejected",
])

const loadCandidates = async (
  deps: EvoluDep & DateDep
): Promise<ReadonlyArray<CashuTokenCandidate>> => {
  const now = deps.date.now()
  return (await deps.evolu.loadQuery(cashuTokenCandidatePaymentsQuery)).map(
    (row) => ({
      paymentId: row.paymentId,
      amountSats: row.amountSats,
      open:
        derivePaymentStatus({
          canceledAt: row.canceledAt,
          confirmedPaidAt: row.confirmedPaidAt,
          expiresAt: row.expiresAt,
          hasActiveClaim: row.hasActiveClaim === sqliteTrue,
          now,
        }) === "pending",
    })
  )
}

export const createCashuTokenListener = (run: Run<CashuTokenListenerDeps>) => {
  const messages = new Map<string, CashuTokenMessage>()
  const refused = new Set<string>()
  const nextTryAtMs = new Map<string, number>()
  let stopSubscription: (() => void) | null = null

  const processMessage = async (message: CashuTokenMessage) => {
    if (refused.has(message.rumorId)) return
    const nowMs = run.deps.date.now().getTime()
    if ((nextTryAtMs.get(message.rumorId) ?? 0) > nowMs) return
    const inspected = await inspectCashuToken(
      message.tokenText,
      bytesToHex(deriveNostrSecretKey(run.deps.masterKey))
    )
    if (!inspected.ok) {
      refused.add(message.rumorId)
      return
    }
    const token = inspected.value
    const operation = await run.deps.cashuShardStore.loadOperation(
      token.receiveOperationId
    )
    if (operation?.status === "done" || operation?.status === "failed") {
      refused.add(message.rumorId)
      return
    }

    const match = matchCashuToken({
      amount: token.amount,
      requestId: message.payload?.requestId ?? null,
      candidates: await loadCandidates(run.deps),
    })
    const arrivalFor = match.type === "unassigned" ? null : match.paymentId
    const report = (
      state: CashuTokenArrival["state"],
      fee: number | null,
      failure: CashuReceiveError["type"] | null = null
    ) => {
      if (arrivalFor !== null)
        setArrival(arrivalFor, {
          mint: token.mint,
          amount: token.amount,
          fee,
          state,
          failure,
        })
    }

    // Payky receives only from the current default mint (cashu/0011).
    if (token.mint !== (await loadCashuDefaultMint(run.deps.cashuShardStore))) {
      refused.add(message.rumorId)
      report("untrustedMint", null)
      return
    }

    // The payment holds the receive id before anyone receives the token.
    if (match.type === "payment")
      await run.ok(
        holdCashuReceive({
          paymentId: match.paymentId,
          receiveOperationId: token.receiveOperationId,
        })
      )
    report("receiving", null)

    const result = await run(receiveCashuToken(token))
    if (result.ok) {
      const outcome = result.value
      if (outcome.type === "received") report("received", outcome.fee)
      else report("receivedElsewhere", null)
      if (outcome.type !== "claimedElsewhere") refused.add(message.rumorId)
      return
    }
    const failure = result.error.type
    if (finalRefusals.has(failure)) {
      refused.add(message.rumorId)
      report("failed", null, failure)
      return
    }
    // ponytail: a fixed 30 s between tries of a token whose mint is down.
    nextTryAtMs.set(message.rumorId, nowMs + WAITING_RETRY_MS)
    report("waitingForMint", null, failure)
  }

  const tick = async () => {
    for (const message of [...messages.values()]) await processMessage(message)
  }

  return {
    /** Loads the window and listens for new messages; idempotent. */
    start: async (onNewMessage: () => void): Promise<void> => {
      if (stopSubscription !== null) return
      stopSubscription = subscribeCashuTokenMessages(run.deps, (message) => {
        if (messages.has(message.rumorId)) return
        messages.set(message.rumorId, message)
        onNewMessage()
      })
      const window = await run(fetchCashuTokenMessages)
      if (window.ok)
        for (const message of window.value)
          messages.set(message.rumorId, message)
      onNewMessage()
    },
    stop: (): void => {
      stopSubscription?.()
      stopSubscription = null
    },
    tick,
  }
}
