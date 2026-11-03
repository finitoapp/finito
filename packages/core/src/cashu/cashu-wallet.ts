import type {
  JSONIntApi,
  Proof,
  ProofState,
  RequestFn,
  Wallet,
} from "@cashu/cashu-ts"
import { err, ok, type Result, sqliteTrue, type Task } from "@evolu/common"
import type { FetchDep } from "../deps.ts"
import { defineError } from "../error.ts"
import {
  cashuDeviceKnownMintsQuery,
  markCashuMintSeen,
} from "../evolu/device-cashu.ts"
import type { DeviceAccountId } from "../evolu/device-client.ts"
import type { CashuProofCopy } from "../modules/cashu/cashu-queries.ts"
import {
  type KeysetId,
  KeysetIdSchema,
  type MintUrl,
} from "../modules/cashu/cashu-types.ts"
import type { DeviceEvoluDep } from "../modules/shared/evolu-deps.ts"
import type { CashuWalletSeed } from "../modules/shared/key-derivation.ts"
import type { CashuShardStoreDep } from "./cashu-shard-store.ts"

/**
 * The cashu-ts wallet behind Payky's Cashu payments, the counterpart of
 * `SparkWalletDep` (cashu.md §3). Other code never constructs a cashu-ts
 * `Wallet` itself: it goes through `loadCashuWallet`, which loads each
 * `mint|unit` once, refuses a mint listing another mint's keyset, and talks
 * to the mint over `FetchDep`, so tests, the demo and e2e put a fake mint
 * behind it.
 *
 * cashu-ts is imported lazily, as the Spark SDK is, so it stays out of the
 * app's first chunk.
 */

const createMintUnreachableError = defineError("MintUnreachable")<{
  readonly mint: MintUrl
  readonly detail: string
}>()
export type MintUnreachableError = ReturnType<typeof createMintUnreachableError>
export const MintUnreachable = createMintUnreachableError

const createMintRejectedError = defineError("MintRejected")<{
  readonly mint: MintUrl
  readonly code: number | null
  readonly detail: string
  /** Set when the mint listed a keyset that belongs to this other mint. */
  readonly keysetOwner?: MintUrl
}>()
export type MintRejectedError = ReturnType<typeof createMintRejectedError>
export const MintRejected = createMintRejectedError

const createTokenLockedError = defineError("TokenLocked")<{
  readonly detail: string
}>()
export type TokenLockedError = ReturnType<typeof createTokenLockedError>
export const TokenLocked = createTokenLockedError

const createAmountConsumedByFeeError = defineError("AmountConsumedByFee")<{
  readonly amount: number
  readonly fee: number
}>()
export type AmountConsumedByFeeError = ReturnType<
  typeof createAmountConsumedByFeeError
>
export const AmountConsumedByFee = createAmountConsumedByFeeError

const createProofsSpentError = defineError("ProofsSpent")<{
  readonly mint: MintUrl
}>()
export type ProofsSpentError = ReturnType<typeof createProofsSpentError>
export const ProofsSpent = createProofsSpentError

const createCounterLockTimeoutError = defineError("CounterLockTimeout")<{
  readonly mint: MintUrl
  readonly keysetId: KeysetId
}>()
export type CounterLockTimeoutError = ReturnType<
  typeof createCounterLockTimeoutError
>
export const CounterLockTimeout = createCounterLockTimeoutError

const createQuoteExpiredError = defineError("QuoteExpired")<{
  readonly mint: MintUrl
  readonly quoteId: string
}>()
export type QuoteExpiredError = ReturnType<typeof createQuoteExpiredError>
export const QuoteExpired = createQuoteExpiredError

/**
 * Another app or device already claimed the quote or swapped the token
 * (decision 11). Payky stops and writes nothing; the winner's rows settle it.
 */
const createClaimedElsewhereError = defineError("ClaimedElsewhere")<{
  readonly mint: MintUrl
}>()
export type ClaimedElsewhereError = ReturnType<
  typeof createClaimedElsewhereError
>
export const ClaimedElsewhere = createClaimedElsewhereError

export type MintFailure = MintUnreachableError | MintRejectedError

interface CashuTs {
  readonly Mint: typeof import("@cashu/cashu-ts").Mint
  readonly Wallet: typeof import("@cashu/cashu-ts").Wallet
  readonly JSONInt: JSONIntApi
  readonly MintOperationError: typeof import("@cashu/cashu-ts").MintOperationError
  readonly HttpResponseError: typeof import("@cashu/cashu-ts").HttpResponseError
  readonly NetworkError: typeof import("@cashu/cashu-ts").NetworkError
  readonly getEncodedToken: typeof import("@cashu/cashu-ts").getEncodedToken
}

const loadCashuTs = async (): Promise<CashuTs> => import("@cashu/cashu-ts")

/**
 * Proofs as canonical v4 token text, encoded as Linky encodes a send
 * (`linkshu/src/token/codec.ts` `encodeToken`): `id`, `amount`, `secret` and
 * `C` only, no DLEQ and no memo, so the text matches what Linky would write
 * for the same proofs.
 */
export const encodeCashuToken = async ({
  mint,
  proofs,
}: {
  readonly mint: MintUrl
  readonly proofs: ReadonlyArray<Proof>
}): Promise<string> => {
  const cashu = await loadCashuTs()
  return cashu.getEncodedToken({
    mint,
    unit: "sat",
    proofs: proofs.map((proof) => ({
      id: proof.id,
      amount: proof.amount,
      secret: proof.secret,
      C: proof.C,
    })),
  })
}

/**
 * cashu-ts's own request over an injected `fetch`, raising the error classes
 * cashu-ts raises, so its wallet reacts to a mint behind `FetchDep` exactly as
 * to one it fetched itself.
 */
const createMintRequest = (
  cashu: CashuTs,
  fetch: FetchDep["fetch"]
): RequestFn =>
  (async ({ endpoint, requestBody, headers, method, signal }) => {
    const body =
      requestBody === undefined
        ? undefined
        : cashu.JSONInt.stringify(requestBody)
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        body,
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(signal === undefined || signal === null ? {} : { signal }),
      })
    } catch (error) {
      throw new cashu.NetworkError(
        error instanceof Error ? error.message : "Network request failed",
        { cause: error }
      )
    }
    const text = await response.text()
    if (!response.ok) {
      const parsed = (() => {
        try {
          return cashu.JSONInt.parse(text) as Record<string, unknown>
        } catch {
          return { detail: text }
        }
      })()
      if (
        response.status === 400 &&
        typeof parsed.code === "number" &&
        typeof parsed.detail === "string"
      )
        throw new cashu.MintOperationError(parsed.code, parsed.detail)
      throw new cashu.HttpResponseError(
        typeof parsed.detail === "string"
          ? parsed.detail
          : typeof parsed.error === "string"
            ? parsed.error
            : "HTTP request failed",
        response.status
      )
    }
    if (text === "")
      throw new cashu.HttpResponseError("bad response", response.status)
    return cashu.JSONInt.parse(text)
  }) as RequestFn

export interface CashuWalletDep {
  readonly cashuWallet: {
    readonly seed: CashuWalletSeed
    /** The device account whose counters and attempts this device keeps. */
    readonly deviceAccountId: DeviceAccountId
    /** A loaded wallet for `mint|sat`, cached; a failed load is not. */
    readonly load: (mint: MintUrl) => Promise<Wallet>
    /** One load past the cache, for showing a mint's info; never derives outputs. */
    readonly loadFresh: (mint: MintUrl) => Promise<Wallet>
  }
}

export const createCashuWalletDep = ({
  seed,
  deviceAccountId,
  fetch,
}: {
  readonly seed: CashuWalletSeed
  readonly deviceAccountId: DeviceAccountId
  readonly fetch: FetchDep["fetch"]
}): CashuWalletDep => {
  const loaded = new Map<string, Promise<Wallet>>()

  const loadWallet = async (mint: MintUrl): Promise<Wallet> => {
    const cashu = await loadCashuTs()
    const wallet = new cashu.Wallet(
      new cashu.Mint(mint, { customRequest: createMintRequest(cashu, fetch) }),
      { unit: "sat", bip39seed: seed }
    )
    await wallet.loadMint()
    return wallet
  }

  return {
    cashuWallet: {
      seed,
      deviceAccountId,
      load: (mint) => {
        const key = `${mint}|sat`
        const cached = loaded.get(key)
        if (cached !== undefined) return cached
        const loading = loadWallet(mint)
        loaded.set(key, loading)
        loading.catch(() => {
          if (loaded.get(key) === loading) loaded.delete(key)
        })
        return loading
      },
      loadFresh: loadWallet,
    },
  }
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** The NUT error code of a mint's answer, when it gave one. */
export const mintErrorCode = (error: unknown): number | null =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "number"
    ? error.code
    : null

/**
 * Linky's `classifyMintError`: a network-shaped failure or a 5xx is
 * `MintUnreachable`, anything else a definitive `MintRejected`.
 */
export const classifyMintError = (
  mint: MintUrl,
  error: unknown
): MintFailure => {
  const detail = errorText(error)
  const code = mintErrorCode(error)
  if (code !== null) return MintRejected({ mint, code, detail })
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null
  if (status !== null)
    return status >= 500
      ? MintUnreachable({ mint, detail })
      : MintRejected({ mint, code: null, detail })
  const name = error instanceof Error ? error.name : ""
  if (
    error instanceof TypeError ||
    name === "NetworkError" ||
    name === "AbortError" ||
    name === "TimeoutError"
  )
    return MintUnreachable({ mint, detail })
  return MintRejected({ mint, code: null, detail })
}

/** A mint call as a `Result`, classified. */
export const callMint = async <T>(
  mint: MintUrl,
  call: () => Promise<T>
): Promise<Result<T, MintFailure>> => {
  try {
    return ok(await call())
  } catch (error) {
    return err(classifyMintError(mint, error))
  }
}

/**
 * NUT-13 derives secrets from the seed, keyset id and counter but not the
 * mint, so a mint listing another mint's keyset would re-derive proofs the
 * wallet already holds there. A keyset belongs to the mint of its oldest
 * stored proof (Linky's `foreignKeysetProof`).
 */
export const foreignKeysetOwner = (
  mint: MintUrl,
  listedKeysetIds: ReadonlyArray<string>,
  proofs: ReadonlyArray<CashuProofCopy>
): MintUrl | null => {
  const listed = new Set(listedKeysetIds)
  const oldest = new Map<string, CashuProofCopy>()
  for (const proof of proofs) {
    if (!listed.has(proof.keysetId)) continue
    const current = oldest.get(proof.keysetId)
    if (
      current === undefined ||
      proof.createdAt < current.createdAt ||
      (proof.createdAt === current.createdAt && proof.mint < current.mint)
    )
      oldest.set(proof.keysetId, proof)
  }
  return [...oldest.values()].find((proof) => proof.mint !== mint)?.mint ?? null
}

export interface LoadedCashuWallet {
  readonly mint: MintUrl
  readonly wallet: Wallet
  /** The keyset new outputs derive from (the wallet's bound one). */
  readonly keysetId: KeysetId
  readonly supports: (nut: 7 | 17 | 20) => boolean
}

/**
 * Loads the mint and refuses it when it lists a keyset another mint owns,
 * checked on every load: proofs synced since may now own a keyset.
 */
export const loadCashuWallet =
  (
    mint: MintUrl
  ): Task<
    LoadedCashuWallet,
    MintFailure,
    CashuWalletDep & CashuShardStoreDep & DeviceEvoluDep
  > =>
  async (run) => {
    const loaded = await callMint(mint, () => run.deps.cashuWallet.load(mint))
    if (!loaded.ok) return loaded
    const { deviceAccountId } = run.deps.cashuWallet
    const known = await run.deps.deviceEvolu.loadQuery(
      cashuDeviceKnownMintsQuery(deviceAccountId)
    )
    if (!known.some((row) => row.mint === mint && row.seen === sqliteTrue))
      markCashuMintSeen(run.deps.deviceEvolu, deviceAccountId, mint)
    const wallet = loaded.value
    const owner = foreignKeysetOwner(
      mint,
      wallet.keyChain.getKeysets().map((keyset) => keyset.id),
      await run.deps.cashuShardStore.loadProofs()
    )
    if (owner !== null)
      return err(
        MintRejected({
          mint,
          code: null,
          detail: `its keyset belongs to ${owner}`,
          keysetOwner: owner,
        })
      )
    const keysetId = KeysetIdSchema.safeParse(wallet.keysetId)
    if (!keysetId.success)
      return err(
        MintRejected({
          mint,
          code: null,
          detail: `wallet bound to non-hex keyset id "${wallet.keysetId}"`,
        })
      )
    const info = wallet.getMintInfo()
    return ok({
      mint,
      wallet,
      keysetId: keysetId.data,
      supports: (nut) =>
        nut === 17
          ? info.isSupported(17).supported
          : info.isSupported(nut).supported,
    })
  }

export type ProofAnswer = "unspent" | "pending" | "spent" | "unknown"

/**
 * NUT-07 over one mint, aligned to the input order. A missing or
 * unrecognised answer is `unknown`, never a guess (Linky's `answerAt`).
 */
export const checkProofStates = async (
  loaded: LoadedCashuWallet,
  proofs: ReadonlyArray<{ readonly secret: string; readonly id: string }>
): Promise<Result<ReadonlyArray<ProofAnswer>, MintFailure>> => {
  if (proofs.length === 0) return ok([])
  const states = await callMint(loaded.mint, () =>
    loaded.wallet.checkProofsStates(
      proofs.map((proof) => ({ secret: proof.secret, id: proof.id }))
    )
  )
  if (!states.ok) return states
  const answers: ReadonlyArray<ProofState> = Array.isArray(states.value)
    ? states.value
    : []
  return ok(
    proofs.map((_, index) => {
      const state = answers[index]?.state.trim().toUpperCase()
      return state === "UNSPENT"
        ? "unspent"
        : state === "SPENT"
          ? "spent"
          : state === "PENDING"
            ? "pending"
            : "unknown"
    })
  )
}

/** NUT-02: the input fee of spending `count` proofs of one keyset. */
export const inputFeeOf = (
  loaded: LoadedCashuWallet,
  proofs: ReadonlyArray<{ readonly id: string }>
): number => Number(loaded.wallet.getFeesForProofs([...proofs]))
