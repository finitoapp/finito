import type { Proof } from "@cashu/cashu-ts"
import { err, ok, type Task } from "@evolu/common"
import { defineError } from "../error.ts"
import type { CashuProofCopy } from "../modules/cashu/cashu-queries.ts"
import {
  CashuAmount,
  type CashuOperationId,
  type CashuTokenText,
  type MintUrl,
} from "../modules/cashu/cashu-types.ts"
import { normalizeCashuTokenText } from "../modules/cashu/cashu-utils.ts"
import {
  CASHU_OUTPUT_BLOCK,
  counterScopeOf,
  isRecoverableOutputCollision,
  MAX_COUNTER_ATTEMPTS,
  recoverFromCollision,
  withCashuCounter,
} from "./cashu-counters.ts"
import { toNewCashuProofs } from "./cashu-restore.ts"
import type { CashuTopupDeps } from "./cashu-topup.ts"
import {
  AmountConsumedByFee,
  type AmountConsumedByFeeError,
  type CounterLockTimeoutError,
  checkProofStates,
  classifyMintError,
  encodeCashuToken,
  type LoadedCashuWallet,
  loadCashuWallet,
  type MintFailure,
  MintRejected,
} from "./cashu-wallet.ts"

/**
 * Handing ecash out of one mint's balance as a token, in Linky's order
 * (`linkshu/src/send/Send.ts`, withdraw/0015): select confirmed-unspent
 * `available` proofs, swap the amount out with disjoint send and keep
 * counter blocks, store the `send` transfer, then book the send proofs
 * `handedOut` under it, the change `available` and the consumed inputs
 * `spent`. Nothing is ever outside the store, so a crash anywhere leaves
 * every sat accounted for. Whoever redeems the token pays the mint's input
 * fee on its proofs, as with a token Linky sends.
 */

const createInsufficientFundsError = defineError("CashuInsufficientFunds")<{
  readonly mint: MintUrl
  readonly needed: number
  readonly available: number
}>()
export type CashuSendInsufficientFundsError = ReturnType<
  typeof createInsufficientFundsError
>

const createSendNotPendingError = defineError("CashuSendNotPending")<{
  readonly operationId: CashuOperationId
}>()
export type CashuSendNotPendingError = ReturnType<
  typeof createSendNotPendingError
>

export interface CashuSendCost {
  /** What the recipient gets. */
  readonly amount: number
  /** The most the swap's input fee can take: the fee of every proof it may consume. */
  readonly maxFee: number
  /** The mint's balance the cost was sized against. */
  readonly available: number
}

export interface CashuSendReceipt {
  readonly operationId: CashuOperationId
  readonly tokenText: CashuTokenText
  readonly amount: number
  /** The input fee the swap took. */
  readonly feePaid: number
  readonly changeAmount: number
}

export type CashuSendError =
  | MintFailure
  | CounterLockTimeoutError
  | AmountConsumedByFeeError
  | CashuSendInsufficientFundsError

const availableAt = (
  proofs: ReadonlyArray<CashuProofCopy>,
  mint: MintUrl
): ReadonlyArray<CashuProofCopy> =>
  proofs.filter(
    (proof) =>
      proof.mint === mint && proof.state === "available" && proof.unit === "sat"
  )

const toWalletProofs = (proofs: ReadonlyArray<CashuProofCopy>) =>
  proofs.map((proof) => ({
    id: proof.keysetId,
    amount: proof.amount,
    secret: proof.secret,
    C: proof.c,
  }))

const total = (proofs: ReadonlyArray<{ readonly amount: number }>) =>
  proofs.reduce((sum, proof) => sum + proof.amount, 0)

/** How many proofs `amount` splits into: one per set bit. */
const proofCountOf = (amount: number): number =>
  amount.toString(2).replaceAll("0", "").length

const feeOf = (loaded: LoadedCashuWallet, count: number): number =>
  count === 0
    ? 0
    : Number(loaded.wallet.getFeesForKeyset(count, loaded.keysetId))

const setStates = async (
  deps: CashuTopupDeps,
  proofs: ReadonlyArray<CashuProofCopy>,
  state: "available" | "spent"
) => {
  for (const proof of proofs)
    await deps.cashuShardStore.updateProof(proof.id, {
      state,
      ...(state === "available" ? { operationId: null } : {}),
    })
}

export interface CashuSendBalance {
  /** The mint's `available` proofs as stored, without asking the mint. */
  readonly available: number
  /** The most a swap's input fee can take: the fee of every proof it may consume. */
  readonly maxFee: number
}

/** The balance a send from `mint` draws on, and the most its fee can be. Nothing changes state. */
export const cashuSendBalance =
  (mint: MintUrl): Task<CashuSendBalance, MintFailure, CashuTopupDeps> =>
  async (run) => {
    const loadedResult = await run(loadCashuWallet(mint))
    if (!loadedResult.ok) return loadedResult
    const stored = availableAt(
      await run.deps.cashuShardStore.loadProofs(),
      mint
    )
    return ok({
      available: total(stored),
      maxFee: Number(
        loadedResult.value.wallet.getFeesForProofs(toWalletProofs(stored))
      ),
    })
  }

/**
 * What sending `amount` from `mint` can cost at most, read from stored
 * proofs; nothing changes state (`sendCashu` asks the mint).
 */
export const costOfCashuSend =
  ({
    mint,
    amount,
  }: {
    readonly mint: MintUrl
    readonly amount: number
  }): Task<CashuSendCost, CashuSendError, CashuTopupDeps> =>
  async (run) => {
    const loadedResult = await run(loadCashuWallet(mint))
    if (!loadedResult.ok) return loadedResult
    const recipientFee = feeOf(loadedResult.value, proofCountOf(amount))
    if (amount <= recipientFee)
      return err(AmountConsumedByFee({ amount, fee: recipientFee }))
    const balance = await run(cashuSendBalance(mint))
    if (!balance.ok) return balance
    const { available, maxFee } = balance.value
    if (available < amount + maxFee)
      return err(
        createInsufficientFundsError({
          mint,
          needed: amount + maxFee,
          available,
        })
      )
    return ok({ amount, maxFee, available })
  }

/**
 * Sends `amount` from `mint` as a token, `pending` until whoever it goes to
 * takes it (Linky's send steps). The token text is in the receipt and on the
 * operation, so a delivery that fails can hand the proofs back
 * (`returnCashuSend`).
 */
export const sendCashu =
  ({
    mint,
    amount,
  }: {
    readonly mint: MintUrl
    readonly amount: number
  }): Task<CashuSendReceipt, CashuSendError, CashuTopupDeps> =>
  async (run) => {
    const store = run.deps.cashuShardStore
    const loadedResult = await run(loadCashuWallet(mint))
    if (!loadedResult.ok) return loadedResult
    const loaded = loadedResult.value
    const recipientFee = feeOf(loaded, proofCountOf(amount))
    if (amount <= recipientFee)
      return err(AmountConsumedByFee({ amount, fee: recipientFee }))

    // 1. NUT-07 select: spent sources are marked spent and left out.
    const stored = availableAt(await store.loadProofs(), mint)
    const states = await checkProofStates(loaded, toWalletProofs(stored))
    if (!states.ok) return states
    const spent = stored.filter((_, index) => states.value[index] === "spent")
    await setStates(run.deps, spent, "spent")
    const sources = stored.filter(
      (_, index) => states.value[index] === "unspent"
    )
    const available = total(sources)
    const maxFee = Number(
      loaded.wallet.getFeesForProofs(toWalletProofs(sources))
    )
    if (available < amount + maxFee)
      return err(
        createInsufficientFundsError({
          mint,
          needed: amount + maxFee,
          available,
        })
      )
    const nowSec = Math.floor(run.deps.date.now().getTime() / 1000)

    const scope = counterScopeOf(loaded, loaded.keysetId)
    return await withCashuCounter<CashuSendReceipt, CashuSendError>(
      run.deps,
      loaded,
      scope,
      async (held) => {
        // 2. Swap exactly the amount out; the swap's input fee comes off the change.
        let send: ReadonlyArray<Proof> = []
        let keep: ReadonlyArray<Proof> = []
        for (let attempt = 0; ; attempt += 1) {
          const counter = held.current()
          await held.advanceTo(counter + 2 * CASHU_OUTPUT_BLOCK)
          const swapped = await loaded.wallet
            .send(
              amount,
              toWalletProofs(sources),
              { keysetId: loaded.keysetId },
              {
                send: { type: "deterministic", counter },
                keep: {
                  type: "deterministic",
                  counter: counter + CASHU_OUTPUT_BLOCK,
                },
              }
            )
            .then(
              (value) => ({ ok: true as const, value }),
              (error: unknown) => ({ ok: false as const, error })
            )
          if (swapped.ok) {
            send = swapped.value.send
            keep = swapped.value.keep
            break
          }
          if (
            !isRecoverableOutputCollision(swapped.error) ||
            attempt + 1 >= MAX_COUNTER_ATTEMPTS
          )
            return err(classifyMintError(mint, swapped.error))
          await recoverFromCollision(
            loaded,
            scope,
            held,
            counter,
            swapped.error,
            2 * CASHU_OUTPUT_BLOCK
          )
        }

        // 3. The token, as Linky would write it.
        const tokenText = normalizeCashuTokenText(
          await encodeCashuToken({ mint, proofs: send })
        )
        const sentAmount = send.reduce(
          (sum, proof) => sum + Number(proof.amount),
          0
        )
        const handedOut = toNewCashuProofs(send, loaded, "handedOut", null)
        const change = toNewCashuProofs(keep, loaded, "available", null)
        if (tokenText === null || handedOut === null || change === null)
          return err(
            MintRejected({ mint, code: null, detail: "malformed swap proofs" })
          )

        // 4. The transfer lands before its proofs; its proofs, the change and
        // the consumed inputs follow, so every sat stays accounted for.
        const operationId = await store.insertOperation({
          kind: "send",
          status: "pending",
          mint,
          unit: "sat",
          keysetId: null,
          amount: CashuAmount(sentAmount),
          feeReserve: null,
          inputsTotal: null,
          quoteId: null,
          invoice: null,
          sourceMint: null,
          counter: null,
          locked: null,
          expiresAtSec: null,
          createdAtSec: nowSec,
          tokenText,
          error: null,
        })
        await store.insertProofs([
          ...handedOut.map((proof) => ({ ...proof, operationId })),
          ...change,
        ])
        const reused = new Set(
          [...send, ...keep]
            .map((proof) => proof.secret)
            .filter((secret) => sources.some((s) => s.secret === secret))
        )
        await setStates(
          run.deps,
          sources.filter((proof) => !reused.has(proof.secret)),
          "spent"
        )
        const changeAmount = total(change)
        return ok({
          operationId,
          tokenText,
          amount: sentAmount,
          feePaid: available - sentAmount - changeAmount,
          changeAmount,
        })
      }
    )
  }

/**
 * A pending send whose token never left this device (its message reached no
 * relay): the handed-out proofs are the wallet's again and the transfer
 * closes `returned`, as Linky closes a send taken back. Nothing was shown to
 * anyone, so no swap is needed.
 */
export const returnCashuSend =
  (
    operationId: CashuOperationId
  ): Task<void, CashuSendNotPendingError, CashuTopupDeps> =>
  async (run) => {
    const store = run.deps.cashuShardStore
    const operation = await store.loadOperation(operationId)
    if (
      operation === null ||
      operation.kind !== "send" ||
      operation.status !== "pending"
    )
      return err(createSendNotPendingError({ operationId }))
    const handedOut = (await store.loadProofs()).filter(
      (proof) =>
        proof.operationId === operationId && proof.state === "handedOut"
    )
    await setStates(run.deps, handedOut, "available")
    await store.updateOperation(operationId, { status: "returned" })
    return ok()
  }
