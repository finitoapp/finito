import type {
  ConfigOptions,
  NetworkType,
  SparkWallet,
  SparkWalletEvents,
} from "@buildonspark/spark-sdk"
import type {
  SubscribeToEventsResponse,
  Transfer,
  TransferStatus,
  TransferType,
} from "@buildonspark/spark-sdk/proto/spark"
import type {
  ExitSpeed,
  SparkCoopExitRequestStatus,
  WalletTransfer,
} from "@buildonspark/spark-sdk/types"
import { equalBytes } from "@noble/curves/utils.js"
import { mnemonicToBip39Seed } from "../modules/shared/bip39-seed.ts"
import {
  type SparkSecret,
  sparkSecretToMnemonic,
} from "../modules/shared/key-derivation.ts"
import { createRefCountedResourcePool } from "../utils/ref-counted-resource-pool.ts"

export interface SparkWalletSettings {
  readonly ownerIdentityPublicKey: string
  readonly privateEnabled: boolean
}

interface SparkLightningInvoice {
  readonly id?: string | null
  readonly invoice: {
    readonly encodedInvoice: string
    readonly paymentHash?: string | null
  }
  readonly paymentPreimage?: string | null
  readonly sparkInvoice?: string | null
}

export type SparkExitSpeed = "fast" | "medium" | "slow"

export type SparkNetwork = NetworkType

/**
 * The SDK's `TransferStatus.TRANSFER_STATUS_COMPLETED`, as a literal for the
 * same reason `exitSpeedToSdk` mirrors `ExitSpeed`.
 */
export const SPARK_TRANSFER_STATUS_COMPLETED = "TRANSFER_STATUS_COMPLETED"

/**
 * Mirrors the SDK's `ExitSpeed` enum values ("FAST"/"MEDIUM"/"SLOW") as
 * literals instead of importing the enum itself, so this module doesn't pull
 * in the Spark SDK's runtime code just to read three constant strings — see
 * the module-level comment on `sparkWalletPool` for why keeping the SDK out
 * of this file's static import graph matters.
 */
const exitSpeedToSdk: Record<SparkExitSpeed, ExitSpeed> = {
  fast: "FAST" as ExitSpeed,
  medium: "MEDIUM" as ExitSpeed,
  slow: "SLOW" as ExitSpeed,
}

export interface SparkWithdrawalFeeEstimate {
  readonly userFeeSats: number
  readonly l1BroadcastFeeSats: number
  readonly totalFeeSats: number
}

export interface SparkWithdrawalFeeQuote {
  readonly id: string
  readonly expiresAt: string
  readonly fast: SparkWithdrawalFeeEstimate
  readonly medium: SparkWithdrawalFeeEstimate
  readonly slow: SparkWithdrawalFeeEstimate
}

export type SparkWithdrawalStatus = SparkCoopExitRequestStatus

export interface SparkWithdrawalRequest {
  readonly id: string
  readonly status: SparkWithdrawalStatus
  readonly txid: string | null
}

/**
 * The SDK threw `SparkValidationError`. That usually means it refused before
 * sending anything, but it is not guaranteed, so a caller confirms it before
 * treating the money as unsent.
 */
export interface SparkSendRejected {
  readonly kind: "rejected"
  readonly message: string
}

export type SparkWithdrawResult =
  | ({ readonly kind: "sent" } & SparkWithdrawalRequest)
  | SparkSendRejected

/**
 * `sent` covers both routes the SDK may take: over the SSP and, for an
 * invoice with a Spark fallback, a plain Spark transfer. The caller knows the
 * transfer id up front and does not need to tell them apart.
 */
export type SparkLightningPayResult =
  | { readonly kind: "sent" }
  | SparkSendRejected

export interface SparkWalletBalance {
  readonly availableSats: number
}

export interface SparkPaymentWallet extends AsyncDisposable {
  readonly createLightningInvoice: (params: {
    readonly amountSats: number
    readonly memo?: string
    readonly expirySeconds?: number
    readonly includeSparkInvoice?: boolean
  }) => Promise<SparkLightningInvoice>
  readonly getWalletSettings: () => Promise<SparkWalletSettings | undefined>
  readonly setPrivacyEnabled: (
    privacyEnabled: boolean
  ) => Promise<SparkWalletSettings | undefined>
  readonly getBalance: () => Promise<SparkWalletBalance>
  readonly getWithdrawalFeeQuote: (params: {
    readonly amountSats: number
    readonly withdrawalAddress: string
  }) => Promise<SparkWithdrawalFeeQuote | null>
  /** Throws when the SDK returns no coop exit request: whether money left is then unknown. */
  readonly withdraw: (params: {
    readonly onchainAddress: string
    readonly exitSpeed: SparkExitSpeed
    readonly feeQuoteId: string
    readonly feeAmountSats: number
    readonly amountSats?: number
    readonly deductFeeFromWithdrawalAmount?: boolean
  }) => Promise<SparkWithdrawResult>
  readonly getLightningSendFeeEstimate: (params: {
    readonly invoice: string
    readonly amountSats?: number
  }) => Promise<number>
  /**
   * Pays with `preferSpark: true`. `transferId` (a UUID string) becomes the
   * Spark transfer's id on every route, and the SSP's idempotency key.
   */
  readonly payLightningInvoice: (params: {
    readonly invoice: string
    readonly maxFeeSats: number
    readonly amountSatsToSend?: number
    readonly transferId: string
  }) => Promise<SparkLightningPayResult>
  /**
   * Whether a transfer with this id exists. A failed lookup throws rather
   * than answering `false`: "not found" must mean not found.
   */
  readonly getTransfer: (transferId: string) => Promise<boolean>
  readonly getIdentityPublicKey: () => Promise<string>
  readonly getCoopExitRequest: (
    coopExitRequestId: string
  ) => Promise<{ readonly txid: string | null } | null>
}

export type SparkWalletDep = {
  readonly sparkWallet: {
    readonly create: (secret: SparkSecret) => Promise<SparkPaymentWallet>
  }
}

export const createSparkWalletDep = () => {
  return {
    sparkWallet: {
      create: createDefaultSparkPaymentWallet,
    },
  }
}

const toFeeEstimate = (
  userFee: { readonly originalValue: number },
  l1BroadcastFee: { readonly originalValue: number }
): SparkWithdrawalFeeEstimate => ({
  userFeeSats: userFee.originalValue,
  l1BroadcastFeeSats: l1BroadcastFee.originalValue,
  totalFeeSats: userFee.originalValue + l1BroadcastFee.originalValue,
})

/** Only this wrapper knows the SDK's `SparkValidationError`; see {@link SparkSendRejected}. */
const catchRejection = async <T>(
  send: () => Promise<T>
): Promise<T | SparkSendRejected> => {
  try {
    return await send()
  } catch (error) {
    const { SparkValidationError } = await import("@buildonspark/spark-sdk")
    if (error instanceof SparkValidationError) {
      return { kind: "rejected", message: error.message }
    }
    throw error
  }
}

/** The SDK's private `SparkWallet` methods the incoming announcement uses (SDK 0.14.0). */
interface SparkWalletPrivates {
  handleStreamEvent: (data: SubscribeToEventsResponse) => Promise<void>
  readonly constructTransfersWithUserRequest: (
    transfers: ReadonlyArray<Transfer>
  ) => Promise<ReadonlyArray<WalletTransfer>>
}

type IncomingTransferHandler = NonNullable<
  SharedSparkSyncWalletEventHandlers["transfer:incoming"]
>

/**
 * The SDK's proto `TransferType` and `TransferStatus` values, as literals
 * (verified against `@buildonspark/spark-sdk/proto/spark`, SDK 0.14.0) for
 * the same reason `exitSpeedToSdk` mirrors `ExitSpeed`. Only a payment is
 * announced, which leaves out counter swaps, and only in a status the SDK
 * claims it in (its `partitionClaimablePendingTransfers`).
 */
const ANNOUNCED_TRANSFER_TYPES: ReadonlySet<TransferType> = new Set([
  0, // PREIMAGE_SWAP
  2, // TRANSFER
])
const CLAIMABLE_TRANSFER_STATUSES: ReadonlySet<TransferStatus> = new Set([
  2, // TRANSFER_STATUS_SENDER_KEY_TWEAKED
  3, // TRANSFER_STATUS_RECEIVER_KEY_TWEAKED
  4, // TRANSFER_STATUS_RECEIVER_REFUND_SIGNED
  9, // TRANSFER_STATUS_RECEIVER_KEY_TWEAK_LOCKED
  10, // TRANSFER_STATUS_RECEIVER_KEY_TWEAK_APPLIED
])

/** The transfer to this wallet a stream event carries, when `transfer:incoming` announces it. */
const announcedIncomingTransferOf = ({
  event,
}: SubscribeToEventsResponse): Transfer | undefined => {
  const transfer =
    event?.$case === "receiverTransfer"
      ? event.receiverTransfer.transfer
      : undefined
  return transfer !== undefined &&
    !equalBytes(
      transfer.senderIdentityPublicKey,
      transfer.receiverIdentityPublicKey
    ) &&
    ANNOUNCED_TRANSFER_TYPES.has(transfer.type) &&
    CLAIMABLE_TRANSFER_STATUSES.has(transfer.status)
    ? transfer
    : undefined
}

/**
 * One SSP call, which brings a Lightning transfer's user request. SDK 0.14.0
 * makes it, with no ids, for a plain transfer too.
 */
const transferWithUserRequest = async (
  wallet: SparkWalletPrivates,
  transfer: Transfer
): Promise<SparkWalletTransfer> => {
  const [walletTransfer] = await wallet.constructTransfersWithUserRequest([
    transfer,
  ])
  if (walletTransfer === undefined) {
    throw new Error(`The SDK did not convert transfer ${transfer.id}.`)
  }
  return walletTransfer
}

/**
 * Instances are keyed by mnemonic + network and shared across every consumer
 * (domain actions, direct UI reads, and the Spark account sync job — all of
 * which use the default `MAINNET` network). Sharing is ref-counted through
 * {@link createRefCountedResourcePool}: each `acquire()` call returns its own
 * disposable lease, and the underlying instance is only torn down once every
 * acquirer has disposed its lease (e.g. a short-lived action's `finally`
 * cleanup, or the sync job disposing its long-held lease when an account
 * becomes inactive). This keeps the instance alive across a burst of calls
 * for the same account without ever outliving its last consumer.
 *
 * Deliberately uses {@link SparkWallet.initialize}, not
 * `SparkWallet.getOrCreateWallet` — the latter dedupes concurrent
 * initialization through the SDK's own identity-keyed singleton registry,
 * which is redundant here (this pool already dedupes concurrent `acquire()`
 * calls for the same mnemonic) and can race with the pool's own teardown:
 * `getOrCreateWallet` can hand a new acquirer the very instance this pool is
 * concurrently disposing, since the two lifecycle mechanisms aren't
 * synchronized. `initialize` always constructs a fresh instance that this
 * pool exclusively owns, which avoids that race entirely.
 */
/**
 * `Wallet` that claims a transfer once, and whose failed initialization
 * tears down what it started. The SDK
 * opens its connections, its background stream and, on React Native, a
 * 10-second claim timer before the wallet's first sync
 * (`createClientsAndSyncWallet`, SDK 0.14.0). When that sync throws —
 * offline at boot, an operator outage — `initialize` rejects without handing
 * back the instance, so nobody could call `cleanup`: every failed start left
 * a wallet reconnecting and polling in the background, and the sync job
 * retries a failed start. `initialize` builds the wallet with `new this`, so
 * it builds this subclass and runs its `initWallet`.
 *
 * It also announces an incoming transfer the moment the stream delivers it,
 * before the SDK's claim (about 5 s of signing on a PAX A920Pro), so the
 * transfer can be recorded at once (payment/0031).
 */
const pooledWallet = (Wallet: typeof SparkWallet) =>
  class extends Wallet {
    /** What `subscribe` registered for `transfer:incoming`. */
    readonly incomingTransferHandlers = new Set<IncomingTransferHandler>()

    constructor(...args: ConstructorParameters<typeof SparkWallet>) {
      super(...args)
      // Runs before `initWallet` starts the stream, so it sees every event.
      // ponytail: wraps a private SDK method (SDK 0.14.0);
      // spark-wallet-sdk-contract.test.ts fails once an upgrade renames it.
      const sdk = this as unknown as SparkWalletPrivates
      const handleStreamEvent = sdk.handleStreamEvent.bind(this)
      sdk.handleStreamEvent = (data) => {
        try {
          const transfer =
            this.incomingTransferHandlers.size === 0
              ? undefined
              : announcedIncomingTransferOf(data)
          if (transfer !== undefined) {
            const withUserRequest = transferWithUserRequest(sdk, transfer)
            for (const handler of this.incomingTransferHandlers) {
              handler(transfer.id, withUserRequest)
            }
          }
        } catch {
          // A failing subscriber must not hold up the SDK's claim; the
          // sweep after the claim still records the transfer.
        }
        return handleStreamEvent(data)
      }
    }

    /**
     * The claims this wallet started, by transfer id. The SDK claims an
     * incoming transfer once the stream delivers it, and its 10 s claim poll
     * on React Native lists the same transfer as pending while that claim
     * still runs: the poll's claim then waits for the first and redoes all
     * of it, about 5 s of signing on a PAX A920Pro, holding up the balance
     * and the payment behind it (SDK 0.14.0). A transfer claimed, or being
     * claimed, shares that claim instead.
     */
    // ponytail: one entry per incoming transfer for the wallet's lifetime;
    // evict settled ones if a wallet ever lives through thousands.
    readonly claimsByTransferId = new Map<
      string,
      ReturnType<SparkWallet["claimTransfer"]>
    >()

    protected override claimTransfer(
      params: Parameters<SparkWallet["claimTransfer"]>[0]
    ): ReturnType<SparkWallet["claimTransfer"]> {
      const { id } = params.transfer
      const existing = this.claimsByTransferId.get(id)
      if (existing !== undefined) return existing
      const claim = super.claimTransfer(params)
      this.claimsByTransferId.set(id, claim)
      // A claim that failed is tried again, as the SDK would.
      claim.catch(() => this.claimsByTransferId.delete(id))
      return claim
    }

    protected override async initWallet(
      mnemonicOrSeed?: Uint8Array | string,
      accountNumber?: number,
      options?: ConfigOptions
    ) {
      try {
        return await super.initWallet(mnemonicOrSeed, accountNumber, options)
      } catch (error) {
        // The failed start is what the caller hears about; a cleanup that
        // fails as well has nothing to add to it.
        await this.cleanup().catch(() => undefined)
        throw error
      }
    }
  }

interface SparkWalletPoolKey {
  readonly network: SparkNetwork
  readonly mnemonic: string
}

type PooledSparkWallet = InstanceType<ReturnType<typeof pooledWallet>>

const sparkWalletPool = createRefCountedResourcePool<
  PooledSparkWallet,
  SparkWalletPoolKey
>({
  // Loaded via a dynamic import rather than a static one so that merely
  // importing this module (as every route does transitively through
  // useAppRun) doesn't pull the Spark SDK's own dependency graph into the
  // shared app bundle — it's fetched only once a wallet is actually acquired.
  create: async ({ mnemonic, network }) => {
    const { SparkWallet } = await import("@buildonspark/spark-sdk")
    const { wallet } = await pooledWallet(SparkWallet).initialize({
      // The seed, not the mnemonic: the SDK would derive the same seed in
      // pure JS (~1.6 s of blocked JS on Hermes), where this one can come
      // from the platform's native PBKDF2 (`installBip39Pbkdf2`).
      mnemonicOrSeed: mnemonicToBip39Seed(mnemonic),
      options: {
        network,
      },
    })
    return wallet
  },
  destroy: (wallet) => wallet.cleanup(),
  keyOf: ({ mnemonic, network }) => `${network}:${mnemonic}`,
})

// Mirrors the SDK's SparkWalletEvent values as literals (verified against
// its declaration) instead of importing the enum, for the same reason the
// sparkWalletPool's `create` uses a dynamic import above.
const SUPPORTED_SYNC_EVENTS = [
  "transfer:claimed",
  "balance:update",
  "deposit:confirmed",
] as const

export type SharedSparkSyncWalletEventHandlers = Partial<
  Pick<SparkWalletEvents, (typeof SUPPORTED_SYNC_EVENTS)[number]>
> & {
  /**
   * A transfer to this wallet the stream delivered, before the SDK claims it
   * (payment/0031). The promise resolves to that transfer with its SSP user
   * request, or rejects when the SSP call fails; the subscriber handles it.
   */
  readonly "transfer:incoming"?: (
    transferId: string,
    transfer: Promise<SparkWalletTransfer>
  ) => void
}

/**
 * A transfer as `SharedSparkSyncWallet.getTransfers` returns it. Named here
 * so code outside the wrapper never imports the SDK's types itself, and an
 * SDK upgrade that reshapes it shows up in one place.
 */
export type SparkWalletTransfer = WalletTransfer

export interface SharedSparkSyncWallet extends AsyncDisposable {
  readonly getTransfers: (
    limit?: number,
    offset?: number,
    createdAfter?: Date,
    createdBefore?: Date
  ) => ReturnType<SparkWallet["getTransfers"]>
  readonly getTransfer: (id: string) => ReturnType<SparkWallet["getTransfer"]>
  /** Subscribes to sync-relevant events on the shared instance; returns an unsubscribe function. */
  readonly subscribe: (
    handlers: SharedSparkSyncWalletEventHandlers
  ) => () => void
}

export const createSharedSparkSyncWallet = async (
  secret: SparkSecret,
  network: SparkNetwork = "MAINNET"
): Promise<SharedSparkSyncWallet> => {
  const lease = sparkWalletPool.acquire({
    network,
    mnemonic: sparkSecretToMnemonic(secret),
  })
  const wallet = await lease.resource

  return {
    getTransfers: (limit, offset, createdAfter, createdBefore) =>
      wallet.getTransfers(limit, offset, createdAfter, createdBefore),
    getTransfer: (id) => wallet.getTransfer(id),
    subscribe: (handlers) => {
      const entries = SUPPORTED_SYNC_EVENTS.flatMap((event) => {
        const listener = handlers[event]
        return listener === undefined ? [] : [[event, listener] as const]
      })

      // Each pair's event and listener always correspond (built from the
      // same `handlers[event]` lookup above), but the union collapses once
      // stored in a shared array, so TS can no longer verify it structurally.
      for (const [event, listener] of entries) {
        wallet.on(event, listener as never)
      }
      const onIncomingTransfer = handlers["transfer:incoming"]
      if (onIncomingTransfer) {
        wallet.incomingTransferHandlers.add(onIncomingTransfer)
      }

      return () => {
        for (const [event, listener] of entries) {
          wallet.off(event, listener as never)
        }
        if (onIncomingTransfer) {
          wallet.incomingTransferHandlers.delete(onIncomingTransfer)
        }
      }
    },
    [Symbol.asyncDispose]: lease[Symbol.asyncDispose],
  }
}

export const createDefaultSparkPaymentWallet = async (
  secret: SparkSecret,
  network: SparkNetwork = "MAINNET"
): Promise<SparkPaymentWallet> => {
  const lease = sparkWalletPool.acquire({
    network,
    mnemonic: sparkSecretToMnemonic(secret),
  })
  const wallet = await lease.resource

  return {
    createLightningInvoice: (params) => wallet.createLightningInvoice(params),
    getWalletSettings: () => wallet.getWalletSettings(),
    setPrivacyEnabled: (privacyEnabled) =>
      wallet.setPrivacyEnabled(privacyEnabled),
    getBalance: async () => {
      const balance = await wallet.getBalance()
      return { availableSats: Number(balance.satsBalance.available) }
    },
    getWithdrawalFeeQuote: async (params) => {
      const quote = await wallet.getWithdrawalFeeQuote(params)
      if (!quote) return null

      return {
        id: quote.id,
        expiresAt: quote.expiresAt,
        fast: toFeeEstimate(quote.userFeeFast, quote.l1BroadcastFeeFast),
        medium: toFeeEstimate(quote.userFeeMedium, quote.l1BroadcastFeeMedium),
        slow: toFeeEstimate(quote.userFeeSlow, quote.l1BroadcastFeeSlow),
      }
    },
    withdraw: async ({
      onchainAddress,
      exitSpeed,
      feeQuoteId,
      feeAmountSats,
      amountSats,
      deductFeeFromWithdrawalAmount,
    }) =>
      await catchRejection(async () => {
        const result = await wallet.withdraw({
          onchainAddress,
          exitSpeed: exitSpeedToSdk[exitSpeed],
          feeQuoteId,
          feeAmountSats,
          amountSats,
          deductFeeFromWithdrawalAmount,
        })
        if (!result) throw new Error("The SDK returned no coop exit request.")

        return {
          kind: "sent",
          id: result.id,
          status: result.status,
          txid: result.coopExitTxid || null,
        }
      }),
    getLightningSendFeeEstimate: ({ invoice, amountSats }) =>
      wallet.getLightningSendFeeEstimate({
        encodedInvoice: invoice,
        amountSats,
      }),
    payLightningInvoice: async ({
      invoice,
      maxFeeSats,
      amountSatsToSend,
      transferId,
    }) => {
      const { UUID } = await import("@buildonspark/spark-sdk")
      return await catchRejection(async () => {
        await wallet.payLightningInvoice({
          invoice,
          maxFeeSats,
          amountSatsToSend,
          preferSpark: true,
          transferId: UUID.parse(transferId),
        })
        return { kind: "sent" }
      })
    },
    getTransfer: async (transferId) =>
      (await wallet.getTransfer(transferId)) !== undefined,
    getIdentityPublicKey: () => wallet.getIdentityPublicKey(),
    getCoopExitRequest: async (coopExitRequestId) => {
      const request = await wallet.getCoopExitRequest(coopExitRequestId)
      return request === null ? null : { txid: request.coopExitTxid || null }
    },
    [Symbol.asyncDispose]: lease[Symbol.asyncDispose],
  }
}
