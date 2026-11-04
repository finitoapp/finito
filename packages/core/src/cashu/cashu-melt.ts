import type { MeltQuoteBolt11Response, Proof } from "@cashu/cashu-ts"
import { err, ok, type Result, type Task } from "@evolu/common"
import { defineError } from "../error.ts"
import {
  cashuClaimAttemptQuery,
  recordCashuClaimAttempt,
} from "../evolu/device-cashu.ts"
import type {
  CashuOperationCopy,
  CashuProofCopy,
} from "../modules/cashu/cashu-queries.ts"
import {
  CashuAmount,
  CashuBolt11Schema,
  type CashuOperationId,
  CashuQuoteIdSchema,
  type MintUrl,
} from "../modules/cashu/cashu-types.ts"
import { runMutationWithCompletion } from "../modules/shared/evolu-utils.ts"
import {
  CASHU_OUTPUT_BLOCK,
  counterScopeOf,
  isRecoverableOutputCollision,
  MAX_COUNTER_ATTEMPTS,
  recoverFromCollision,
  withCashuCounter,
} from "./cashu-counters.ts"
import { keepUnstoredUnspent, toNewCashuProofs } from "./cashu-restore.ts"
import type { CashuTopupDeps } from "./cashu-topup.ts"
import {
  type CounterLockTimeoutError,
  callMint,
  checkProofStates,
  classifyMintError,
  type LoadedCashuWallet,
  loadCashuWallet,
  type MintFailure,
  MintRejected,
  QuoteExpired,
  type QuoteExpiredError,
} from "./cashu-wallet.ts"

/**
 * Paying a Lightning invoice from one mint's balance, in Linky's order
 * (`linkshu/docs/melt.md`, cashu.md §6): price the quote, select confirmed
 * unspent sources, swap exactly what the melt needs out of them, persist the
 * pending `melt` with its inputs `held` before anything is sent, then melt
 * with NUT-08 blank outputs for the change. A response lost after sending
 * leaves the melt `pending`; resuming it settles the one payment already
 * sent, it is never a retry (withdraw/0011).
 */

const createInsufficientFundsError = defineError("CashuInsufficientFunds")<{
  readonly mint: MintUrl
  readonly needed: number
  readonly available: number
}>()
export type CashuInsufficientFundsError = ReturnType<
  typeof createInsufficientFundsError
>

const createMeltQuoteNotPayableError = defineError("CashuMeltQuoteNotPayable")<{
  readonly mint: MintUrl
  readonly state: string
}>()
export type CashuMeltQuoteNotPayableError = ReturnType<
  typeof createMeltQuoteNotPayableError
>

/** The mint refused the invoice or the inputs come back: nothing was paid. */
const createMeltUnpaidError = defineError("CashuMeltUnpaid")<{
  readonly mint: MintUrl
}>()
export type CashuMeltUnpaidError = ReturnType<typeof createMeltUnpaidError>

/** Sent, but the mint has not settled it yet: the melt stays pending. */
const createMeltPendingError = defineError("CashuMeltPending")<{
  readonly mint: MintUrl
  readonly operationId: CashuOperationId
}>()
export type CashuMeltPendingError = ReturnType<typeof createMeltPendingError>

export interface CashuMeltCost {
  readonly quoteId: string
  readonly amount: number
  /** The mint's Lightning fee reserve; unused reserve comes back as change. */
  readonly feeReserve: number
  /** NUT-02 input fees of the melt inputs and of the swap cutting them out. */
  readonly inputFee: number
  /** The most the balance can go down by. */
  readonly maxTotal: number
  readonly expiresAtSec: number | null
}

export interface CashuMeltReceipt {
  readonly operationId: CashuOperationId
  readonly quoteId: string
  readonly paidAmount: number
  readonly feeReserve: number
  readonly changeAmount: number
  /** What left the balance: invoice, Lightning fee and input fees. */
  readonly totalSpent: number
}

export type CashuMeltError =
  | MintFailure
  | CounterLockTimeoutError
  | QuoteExpiredError
  | CashuInsufficientFundsError
  | CashuMeltQuoteNotPayableError
  | CashuMeltUnpaidError
  | CashuMeltPendingError

export const availableAt = (
  proofs: ReadonlyArray<CashuProofCopy>,
  mint: MintUrl
): ReadonlyArray<CashuProofCopy> =>
  proofs.filter(
    (proof) =>
      proof.mint === mint && proof.state === "available" && proof.unit === "sat"
  )

export const toWalletProofs = (proofs: ReadonlyArray<CashuProofCopy>) =>
  proofs.map((proof) => ({
    id: proof.keysetId,
    amount: proof.amount,
    secret: proof.secret,
    C: proof.c,
  }))

/** The sum of `proofs`' face values. */
export const totalOf = (proofs: ReadonlyArray<{ readonly amount: number }>) =>
  proofs.reduce((sum, proof) => sum + proof.amount, 0)

/** How many proofs `amount` splits into: one per set bit. */
export const proofCountOf = (amount: number): number =>
  amount.toString(2).replaceAll("0", "").length

export const feeOf = (loaded: LoadedCashuWallet, count: number): number =>
  count === 0
    ? 0
    : Number(loaded.wallet.getFeesForKeyset(count, loaded.keysetId))

/** Linky's `cost`: read from stored proofs, nothing changes state. */
export const costOfMelt = (
  loaded: LoadedCashuWallet,
  quote: MeltQuoteBolt11Response,
  available: ReadonlyArray<CashuProofCopy>
): CashuMeltCost => {
  const amount = Number(quote.amount)
  const feeReserve = Number(quote.fee_reserve)
  const meltInputFee = feeOf(loaded, proofCountOf(amount + feeReserve))
  const swapFee = Number(
    loaded.wallet.getFeesForProofs(toWalletProofs(available))
  )
  const inputFee = meltInputFee + swapFee
  return {
    quoteId: quote.quote,
    amount,
    feeReserve,
    inputFee,
    maxTotal: amount + feeReserve + inputFee,
    expiresAtSec:
      typeof quote.expiry === "number" && quote.expiry > 0
        ? quote.expiry
        : null,
  }
}

/** A melt quote and what paying it can cost at most. Touches no proof. */
export const quoteCashuMelt =
  ({
    mint,
    invoice,
  }: {
    readonly mint: MintUrl
    readonly invoice: string
  }): Task<CashuMeltCost, MintFailure, CashuTopupDeps> =>
  async (run) => {
    const loaded = await run(loadCashuWallet(mint))
    if (!loaded.ok) return loaded
    const quote = await callMint(mint, () =>
      loaded.value.wallet.createMeltQuoteBolt11(invoice)
    )
    if (!quote.ok) return quote
    return ok(
      costOfMelt(
        loaded.value,
        quote.value,
        availableAt(await run.deps.cashuShardStore.loadProofs(), mint)
      )
    )
  }

const ownCounter = async (
  deps: CashuTopupDeps,
  operationId: CashuOperationId
): Promise<number | null> => {
  const [row] = await deps.deviceEvolu.loadQuery(
    cashuClaimAttemptQuery(deps.cashuWallet.deviceAccountId, operationId)
  )
  return row?.counter ?? null
}

const recordAttempt = (
  deps: CashuTopupDeps,
  operationId: CashuOperationId,
  counter: number
) =>
  runMutationWithCompletion((options) =>
    recordCashuClaimAttempt(
      deps.deviceEvolu,
      { accountId: deps.cashuWallet.deviceAccountId, operationId, counter },
      options
    )
  )

const heldInputs = async (
  deps: CashuTopupDeps,
  operationId: CashuOperationId
): Promise<ReadonlyArray<CashuProofCopy>> =>
  (await deps.cashuShardStore.loadProofs()).filter(
    (proof) => proof.operationId === operationId && proof.state === "held"
  )

export const setStates = async (
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

/** The mint answered PAID: change in, inputs spent, the melt closed `paid`. */
const settlePaid = async (
  deps: CashuTopupDeps,
  loaded: LoadedCashuWallet,
  operation: Pick<CashuOperationCopy, "id" | "quoteId" | "amount">,
  feeReserve: number,
  inputsTotal: number,
  change: ReadonlyArray<Proof>
): Promise<CashuMeltReceipt> => {
  const rows = toNewCashuProofs(change, loaded, "available", null) ?? []
  await deps.cashuShardStore.insertProofs(rows)
  await setStates(deps, await heldInputs(deps, operation.id), "spent")
  await deps.cashuShardStore.updateOperation(operation.id, { status: "paid" })
  const changeAmount = rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    operationId: operation.id,
    quoteId: operation.quoteId ?? "",
    paidAmount: operation.amount,
    feeReserve,
    changeAmount,
    totalSpent: inputsTotal - changeAmount,
  }
}

const settleUnpaid = async (
  deps: CashuTopupDeps,
  operationId: CashuOperationId,
  status: "unpaid" | "failed",
  error: string | null
) => {
  await setStates(deps, await heldInputs(deps, operationId), "available")
  await deps.cashuShardStore.updateOperation(operationId, { status, error })
}

/**
 * Pays the quoted invoice from `mint`, never above `maxTotal` (the total the
 * user confirmed). Linky's melt steps 1–6.
 */
export const meltCashu =
  ({
    mint,
    invoice,
    quoteId,
    maxTotal,
  }: {
    readonly mint: MintUrl
    readonly invoice: string
    readonly quoteId: string
    readonly maxTotal: number
  }): Task<CashuMeltReceipt, CashuMeltError, CashuTopupDeps> =>
  async (run) => {
    const store = run.deps.cashuShardStore
    const loadedResult = await run(loadCashuWallet(mint))
    if (!loadedResult.ok) return loadedResult
    const loaded = loadedResult.value

    // 1. The quote must be UNPAID and not expired.
    const quote = await callMint(mint, () =>
      loaded.wallet.checkMeltQuoteBolt11(quoteId)
    )
    if (!quote.ok) return quote
    if (quote.value.state !== "UNPAID")
      return err(
        createMeltQuoteNotPayableError({ mint, state: quote.value.state })
      )
    const nowSec = Math.floor(run.deps.date.now().getTime() / 1000)
    if (quote.value.expiry > 0 && nowSec > quote.value.expiry)
      return err(QuoteExpired({ mint, quoteId }))
    const amount = Number(quote.value.amount)
    const feeReserve = Number(quote.value.fee_reserve)

    // 2. NUT-07 select: spent sources are marked spent and left out.
    const stored = availableAt(await store.loadProofs(), mint)
    const states = await checkProofStates(loaded, toWalletProofs(stored))
    if (!states.ok) return states
    const spent = stored.filter((_, index) => states.value[index] === "spent")
    await setStates(run.deps, spent, "spent")
    const sources = stored.filter(
      (_, index) => states.value[index] === "unspent"
    )
    const cost = costOfMelt(loaded, quote.value, sources)
    const sourcesTotal = sources.reduce((sum, proof) => sum + proof.amount, 0)
    if (cost.maxTotal > maxTotal || sourcesTotal < cost.maxTotal)
      return err(
        createInsufficientFundsError({
          mint,
          needed: cost.maxTotal,
          available: sourcesTotal,
        })
      )

    const parsedQuote = CashuQuoteIdSchema.safeParse(quoteId)
    const parsedInvoice = CashuBolt11Schema.safeParse(invoice)
    if (!parsedQuote.success || !parsedInvoice.success)
      return err(
        MintRejected({ mint, code: null, detail: "malformed melt quote" })
      )

    const scope = counterScopeOf(loaded, loaded.keysetId)
    return await withCashuCounter<CashuMeltReceipt, CashuMeltError>(
      run.deps,
      loaded,
      scope,
      async (held) => {
        // 3. Swap exactly what the melt needs, fee included.
        let inputs: ReadonlyArray<Proof> = []
        let keep: ReadonlyArray<Proof> = []
        for (let attempt = 0; ; attempt += 1) {
          const counter = held.current()
          await held.advanceTo(counter + 2 * CASHU_OUTPUT_BLOCK)
          const swapped = await loaded.wallet
            .send(
              amount + feeReserve,
              toWalletProofs(sources),
              { includeFees: true, keysetId: loaded.keysetId },
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
            inputs = swapped.value.send
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

        // 4. Persist before melting: the melt, its inputs held, the
        // remainder available, the consumed sources spent.
        const inputsTotal = inputs.reduce((sum, p) => sum + Number(p.amount), 0)
        const operationId = await store.insertOperation({
          kind: "melt",
          status: "pending",
          mint,
          unit: "sat",
          keysetId: loaded.keysetId,
          amount: CashuAmount(amount),
          feeReserve,
          inputsTotal,
          quoteId: parsedQuote.data,
          invoice: parsedInvoice.data,
          sourceMint: null,
          counter: null,
          locked: null,
          expiresAtSec: cost.expiresAtSec,
          createdAtSec: nowSec,
          tokenText: null,
          error: null,
        })
        const sourceSecrets = new Set<string>(
          sources.map((proof) => proof.secret)
        )
        const reused = (proofs: ReadonlyArray<Proof>) =>
          proofs.filter((proof) => sourceSecrets.has(proof.secret))
        await store.insertProofs([
          ...(toNewCashuProofs(inputs, loaded, "held", operationId) ?? []),
          ...(toNewCashuProofs(keep, loaded, "available", null) ?? []),
        ])
        const stillSources = new Set([
          ...reused(inputs).map((proof) => proof.secret),
          ...reused(keep).map((proof) => proof.secret),
        ])
        await setStates(
          run.deps,
          sources.filter((proof) => !stillSources.has(proof.secret)),
          "spent"
        )

        // 5. Melt with NUT-08 blanks at a reserved slot.
        const counter = held.current()
        await recordAttempt(run.deps, operationId, counter)
        await store.updateOperation(operationId, {
          counter,
          keysetId: loaded.keysetId,
        })
        await held.advanceTo(counter + CASHU_OUTPUT_BLOCK)
        const melted = await loaded.wallet
          .meltProofsBolt11(
            quote.value,
            [...inputs],
            { keysetId: loaded.keysetId },
            { type: "deterministic", counter }
          )
          .then(
            (value) => ({ ok: true as const, value }),
            (error: unknown) => ({ ok: false as const, error })
          )
        const operation = {
          id: operationId,
          quoteId: parsedQuote.data,
          amount: CashuAmount(amount),
        }

        // 6. Settle by the mint's answer.
        if (melted.ok && melted.value.quote.state === "PAID")
          return ok(
            await settlePaid(
              run.deps,
              loaded,
              operation,
              feeReserve,
              inputsTotal,
              melted.value.change
            )
          )
        if (melted.ok && melted.value.quote.state === "UNPAID") {
          await settleUnpaid(run.deps, operationId, "unpaid", null)
          return err(createMeltUnpaidError({ mint }))
        }
        if (!melted.ok) {
          const failure = classifyMintError(mint, melted.error)
          if (failure.type === "MintRejected") {
            await settleUnpaid(
              run.deps,
              operationId,
              "failed",
              JSON.stringify(failure)
            )
            return err(failure)
          }
          // A lost response: ask once, else it stays pending for the job.
          const resumed = await run(resumeCashuMelt(operationId))
          if (resumed.ok && resumed.value.type === "paid")
            return ok(resumed.value.receipt)
          if (resumed.ok && resumed.value.type === "unpaid")
            return err(createMeltUnpaidError({ mint }))
        }
        return err(createMeltPendingError({ mint, operationId }))
      }
    )
  }

export type CashuMeltResume =
  | { readonly type: "paid"; readonly receipt: CashuMeltReceipt }
  | { readonly type: "unpaid" }
  | { readonly type: "pending" }
  | { readonly type: "settled" }

/**
 * A `pending` melt after a lost response or a crash (Linky's
 * `resumePending`): PAID reclaims the change over the recorded blank slot,
 * UNPAID returns the inputs, anything else leaves it as it is. It settles the
 * one payment already sent; it never sends again.
 */
export const resumeCashuMelt =
  (
    operationId: CashuOperationId
  ): Task<CashuMeltResume, MintFailure, CashuTopupDeps> =>
  async (run) => {
    const operation = await run.deps.cashuShardStore.loadOperation(operationId)
    if (operation === null || operation.kind !== "melt")
      return ok({ type: "settled" })
    if (operation.status !== "pending") return ok({ type: "settled" })
    if (operation.quoteId === null) return ok({ type: "pending" })
    const quoteId = operation.quoteId
    const loaded = await run(loadCashuWallet(operation.mint))
    if (!loaded.ok) return loaded
    const quote = await callMint(operation.mint, () =>
      loaded.value.wallet.checkMeltQuoteBolt11(quoteId)
    )
    if (!quote.ok) return quote
    if (quote.value.state === "UNPAID") {
      await settleUnpaid(run.deps, operationId, "unpaid", null)
      return ok({ type: "unpaid" })
    }
    if (quote.value.state !== "PAID") return ok({ type: "pending" })
    const counter =
      operation.counter ?? (await ownCounter(run.deps, operationId))
    const change: Result<ReadonlyArray<Proof>, MintFailure> = counter === null
      ? ok([])
      : await (async () => {
          const restored = await callMint(operation.mint, () =>
            loaded.value.wallet.restore(counter, CASHU_OUTPUT_BLOCK, {
              keysetId: operation.keysetId ?? loaded.value.keysetId,
            })
          )
          if (!restored.ok) return restored
          return keepUnstoredUnspent(
            loaded.value,
            run.deps.cashuShardStore,
            restored.value.proofs
          )
        })()
    if (!change.ok) return change
    return ok({
      type: "paid",
      receipt: await settlePaid(
        run.deps,
        loaded.value,
        operation,
        operation.feeReserve ?? 0,
        operation.inputsTotal ?? operation.amount,
        change.value
      ),
    })
  }
