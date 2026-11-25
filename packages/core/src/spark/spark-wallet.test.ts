import { SparkWalletEvent } from "@buildonspark/spark-sdk"
import {
  type SubscribeToEventsResponse,
  type Transfer,
  TransferStatus,
  TransferType,
} from "@buildonspark/spark-sdk/proto/spark"
import { ExitSpeed } from "@buildonspark/spark-sdk/types"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { SparkSecret } from "../modules/shared/key-derivation.ts"

const {
  sdkClaimTransferMock,
  sdkHandleStreamEventMock,
  constructTransfersWithUserRequestMock,
  initializeMock,
  failedInitCleanupMock,
  FakeUUID,
  FakeSparkValidationError,
  FakeSdkSparkWallet,
} = vi.hoisted(() => {
  const initializeMock = vi.fn()
  const failedInitCleanupMock = vi.fn(async () => undefined)
  const sdkClaimTransferMock = vi.fn(
    async (_transferId: string): Promise<ReadonlyArray<string>> => []
  )
  const sdkHandleStreamEventMock = vi.fn(async (_data: unknown) => undefined)
  const constructTransfersWithUserRequestMock = vi.fn(
    async (transfers: ReadonlyArray<{ readonly id: string }>) =>
      transfers.map(({ id }) => ({ id, userRequest: { id: `request-${id}` } }))
  )
  /**
   * The SDK's `SparkWallet` as far as the wrapper sees it: a class the
   * wrapper subclasses, whose `initialize` is the mock above. Its own
   * `initWallet` fails as the SDK's does when the first sync throws, for
   * a test that makes `initialize` run it.
   */
  class FakeSdkSparkWallet {
    static initialize = initializeMock
    protected async initWallet(): Promise<never> {
      throw new Error("Spark wallet sync failed")
    }
    protected claimTransfer({ transfer }: { transfer: { id: string } }) {
      return sdkClaimTransferMock(transfer.id)
    }
    protected handleStreamEvent(data: unknown) {
      return sdkHandleStreamEventMock(data)
    }
    protected constructTransfersWithUserRequest(
      transfers: ReadonlyArray<{ readonly id: string }>
    ) {
      return constructTransfersWithUserRequestMock(transfers)
    }
    cleanup = failedInitCleanupMock
  }
  class FakeUUID {
    readonly value: string
    constructor(value: string) {
      this.value = value
    }
    static parse(value: string) {
      return new FakeUUID(value)
    }
  }
  class FakeSparkValidationError extends Error {}
  return {
    sdkClaimTransferMock,
    sdkHandleStreamEventMock,
    constructTransfersWithUserRequestMock,
    initializeMock,
    failedInitCleanupMock,
    FakeUUID,
    FakeSparkValidationError,
    FakeSdkSparkWallet,
  }
})

vi.mock("@buildonspark/spark-sdk", () => ({
  SparkWallet: FakeSdkSparkWallet,
  UUID: FakeUUID,
  SparkValidationError: FakeSparkValidationError,
  SparkWalletEvent: {
    TransferClaimed: "transfer:claimed",
    BalanceUpdate: "balance:update",
    DepositConfirmed: "deposit:confirmed",
  },
}))

beforeEach(() => {
  initializeMock.mockClear()
  failedInitCleanupMock.mockClear()
})

const { createDefaultSparkPaymentWallet, createSharedSparkSyncWallet } =
  await import("./spark-wallet.ts")

let nextSecretValue = 0

const nextSecret = () => {
  nextSecretValue += 1
  return SparkSecret(nextSecretValue.toString(16).padStart(32, "0"))
}

const createFakeSdkWallet = (
  overrides: Partial<{
    readonly getBalance: () => Promise<unknown>
    readonly getWithdrawalFeeQuote: () => Promise<unknown>
    readonly withdraw: () => Promise<unknown>
    readonly payLightningInvoice: (params: unknown) => Promise<unknown>
    readonly getTransfer: (id: string) => Promise<unknown>
  }> = {}
) => ({
  getBalance: vi.fn(async () => ({ satsBalance: { available: 0n } })),
  getWithdrawalFeeQuote: vi.fn(async () => null),
  withdraw: vi.fn(async () => null),
  createLightningInvoice: vi.fn(),
  payLightningInvoice: vi.fn(
    async (_params: unknown): Promise<unknown> => ({})
  ),
  getWalletSettings: vi.fn(),
  setPrivacyEnabled: vi.fn(),
  getTransfers: vi.fn(),
  getTransfer: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  cleanup: vi.fn(async () => undefined),
  ...overrides,
})

describe("createDefaultSparkPaymentWallet", () => {
  test("maps the SDK balance to availableSats as a number", async () => {
    const fakeWallet = createFakeSdkWallet({
      getBalance: vi.fn(async () => ({ satsBalance: { available: 12345n } })),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(await wallet.getBalance()).toEqual({ availableSats: 12345 })
  })

  test("maps a withdrawal fee quote from the SDK shape", async () => {
    const fakeWallet = createFakeSdkWallet({
      getWithdrawalFeeQuote: vi.fn(async () => ({
        id: "quote-1",
        expiresAt: "2026-01-01T00:00:00Z",
        userFeeFast: { originalValue: 10 },
        l1BroadcastFeeFast: { originalValue: 5 },
        userFeeMedium: { originalValue: 8 },
        l1BroadcastFeeMedium: { originalValue: 4 },
        userFeeSlow: { originalValue: 2 },
        l1BroadcastFeeSlow: { originalValue: 1 },
      })),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())
    const quote = await wallet.getWithdrawalFeeQuote({
      amountSats: 1000,
      withdrawalAddress: "bc1qexample",
    })

    expect(quote).toEqual({
      id: "quote-1",
      expiresAt: "2026-01-01T00:00:00Z",
      fast: { userFeeSats: 10, l1BroadcastFeeSats: 5, totalFeeSats: 15 },
      medium: { userFeeSats: 8, l1BroadcastFeeSats: 4, totalFeeSats: 12 },
      slow: { userFeeSats: 2, l1BroadcastFeeSats: 1, totalFeeSats: 3 },
    })
  })

  test("returns null when the SDK returns no fee quote", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(
      await wallet.getWithdrawalFeeQuote({
        amountSats: 1000,
        withdrawalAddress: "bc1qexample",
      })
    ).toBeNull()
  })

  test("maps each SparkExitSpeed to the SDK enum when withdrawing", async () => {
    const fakeWithdraw = vi.fn(async () => ({
      id: "withdrawal-1",
      status: "WAITING_ON_TX_CONFIRMATIONS",
      coopExitTxid: null,
    }))
    const fakeWallet = createFakeSdkWallet({ withdraw: fakeWithdraw })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())
    await wallet.withdraw({
      onchainAddress: "bc1qexample",
      exitSpeed: "medium",
      feeQuoteId: "quote-1",
      feeAmountSats: 5,
    })

    expect(fakeWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({ exitSpeed: ExitSpeed.MEDIUM })
    )
  })

  test("maps a completed withdrawal's coopExitTxid to txid", async () => {
    const fakeWallet = createFakeSdkWallet({
      withdraw: vi.fn(async () => ({
        id: "withdrawal-1",
        status: "SUCCEEDED",
        coopExitTxid: "txid-1",
      })),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())
    const result = await wallet.withdraw({
      onchainAddress: "bc1qexample",
      exitSpeed: "fast",
      feeQuoteId: "quote-1",
      feeAmountSats: 5,
    })

    expect(result).toEqual({
      kind: "sent",
      id: "withdrawal-1",
      status: "SUCCEEDED",
      txid: "txid-1",
    })
  })

  test("throws when the SDK returns no coop exit request", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    await expect(
      wallet.withdraw({
        onchainAddress: "bc1qexample",
        exitSpeed: "slow",
        feeQuoteId: "quote-1",
        feeAmountSats: 5,
      })
    ).rejects.toThrow()
  })

  test("reports a SparkValidationError from withdraw as rejected", async () => {
    const fakeWallet = createFakeSdkWallet({
      withdraw: vi.fn(async () => {
        throw new FakeSparkValidationError("Fee quote expired")
      }),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(
      await wallet.withdraw({
        onchainAddress: "bc1qexample",
        exitSpeed: "slow",
        feeQuoteId: "quote-1",
        feeAmountSats: 5,
      })
    ).toEqual({ kind: "rejected", message: "Fee quote expired" })
  })

  test("pays a Lightning invoice preferring Spark, with the transfer id as an SDK UUID", async () => {
    const payLightningInvoice = vi.fn(async (_params: unknown) => ({}))
    const fakeWallet = createFakeSdkWallet({ payLightningInvoice })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())
    const result = await wallet.payLightningInvoice({
      invoice: "lnbc1test",
      maxFeeSats: 13,
      transferId: "0192f7a4-0000-7000-8000-000000000001",
    })

    expect(result).toEqual({ kind: "sent" })
    const [params] = payLightningInvoice.mock.calls[0] ?? []
    expect(params).toMatchObject({
      invoice: "lnbc1test",
      maxFeeSats: 13,
      preferSpark: true,
    })
    expect((params as { transferId: unknown }).transferId).toBeInstanceOf(
      FakeUUID
    )
  })

  test("reports a SparkValidationError from a Lightning payment as rejected", async () => {
    const fakeWallet = createFakeSdkWallet({
      payLightningInvoice: vi.fn(async () => {
        throw new FakeSparkValidationError("maxFeeSats does not cover fee")
      }),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(
      await wallet.payLightningInvoice({
        invoice: "lnbc1test",
        maxFeeSats: 1,
        transferId: "0192f7a4-0000-7000-8000-000000000001",
      })
    ).toEqual({ kind: "rejected", message: "maxFeeSats does not cover fee" })
  })

  test("lets any other Lightning payment error through", async () => {
    const fakeWallet = createFakeSdkWallet({
      payLightningInvoice: vi.fn(async () => {
        throw new Error("network down")
      }),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    await expect(
      wallet.payLightningInvoice({
        invoice: "lnbc1test",
        maxFeeSats: 1,
        transferId: "0192f7a4-0000-7000-8000-000000000001",
      })
    ).rejects.toThrow("network down")
  })

  test("getTransfer answers whether the transfer exists", async () => {
    const fakeWallet = createFakeSdkWallet({
      getTransfer: vi.fn(async (id: string) =>
        id === "known" ? { id } : undefined
      ),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(await wallet.getTransfer("known")).toBe(true)
    expect(await wallet.getTransfer("unknown")).toBe(false)
  })

  test("getTransfer throws on an SDK error instead of answering false", async () => {
    const fakeWallet = createFakeSdkWallet({
      getTransfer: vi.fn(async () => {
        throw new Error("unavailable")
      }),
    })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using wallet = await createDefaultSparkPaymentWallet(nextSecret())

    await expect(wallet.getTransfer("known")).rejects.toThrow("unavailable")
  })
})

describe("Spark wallet initialization", () => {
  test("cleans up a wallet whose initialization failed, which the SDK hands nobody", async () => {
    // What the SDK's `initialize` does: build the wallet with `new this` and
    // run its `initWallet`, rejecting without the instance when it throws.
    initializeMock.mockImplementationOnce(async function (
      this: new () => { readonly initWallet: () => Promise<unknown> }
    ) {
      return await new this().initWallet()
    })

    await expect(createSharedSparkSyncWallet(nextSecret())).rejects.toThrow(
      "Spark wallet sync failed"
    )
    expect(failedInitCleanupMock).toHaveBeenCalledTimes(1)
  })
})

describe("Spark wallet pool sharing", () => {
  test("shares one SDK instance across concurrent leases for the same secret", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    const secret = nextSecret()
    await using walletA = await createDefaultSparkPaymentWallet(secret)
    await using walletB = await createDefaultSparkPaymentWallet(secret)

    await walletA.getBalance()
    await walletB.getBalance()

    expect(initializeMock).toHaveBeenCalledTimes(1)
    expect(fakeWallet.cleanup).not.toHaveBeenCalled()
  })

  test("creates separate SDK instances for different secrets", async () => {
    const fakeWalletA = createFakeSdkWallet()
    const fakeWalletB = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWalletA })
    initializeMock.mockResolvedValueOnce({ wallet: fakeWalletB })

    await using walletA = await createDefaultSparkPaymentWallet(nextSecret())
    await using walletB = await createDefaultSparkPaymentWallet(nextSecret())

    await walletA.getBalance()
    await walletB.getBalance()

    expect(fakeWalletA.getBalance).toHaveBeenCalledTimes(1)
    expect(fakeWalletB.getBalance).toHaveBeenCalledTimes(1)
  })

  test("destroys the SDK instance only once every lease is disposed", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    const secret = nextSecret()
    const walletA = await createDefaultSparkPaymentWallet(secret)
    const walletB = await createDefaultSparkPaymentWallet(secret)

    await walletA[Symbol.asyncDispose]()
    expect(fakeWallet.cleanup).not.toHaveBeenCalled()

    await walletB[Symbol.asyncDispose]()
    expect(fakeWallet.cleanup).toHaveBeenCalledTimes(1)
  })

  test("defaults to the MAINNET network", async () => {
    initializeMock.mockResolvedValueOnce({ wallet: createFakeSdkWallet() })

    await using _wallet = await createDefaultSparkPaymentWallet(nextSecret())

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: { network: "MAINNET" } })
    )
  })

  test("passes a requested network through to the SDK", async () => {
    initializeMock.mockResolvedValueOnce({ wallet: createFakeSdkWallet() })

    await using _wallet = await createDefaultSparkPaymentWallet(
      nextSecret(),
      "REGTEST"
    )

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: { network: "REGTEST" } })
    )
  })

  test("keeps MAINNET and REGTEST instances separate for the same secret", async () => {
    const fakeMainnetWallet = createFakeSdkWallet()
    const fakeRegtestWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeMainnetWallet })
    initializeMock.mockResolvedValueOnce({ wallet: fakeRegtestWallet })

    const secret = nextSecret()
    await using mainnetWallet = await createDefaultSparkPaymentWallet(secret)
    await using regtestWallet = await createDefaultSparkPaymentWallet(
      secret,
      "REGTEST"
    )

    await mainnetWallet.getBalance()
    await regtestWallet.getBalance()

    expect(initializeMock).toHaveBeenCalledTimes(2)
    expect(fakeMainnetWallet.getBalance).toHaveBeenCalledTimes(1)
    expect(fakeRegtestWallet.getBalance).toHaveBeenCalledTimes(1)
  })
})

describe("createSharedSparkSyncWallet", () => {
  test("subscribes only to the provided event handlers", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using syncWallet = await createSharedSparkSyncWallet(nextSecret())
    const balanceUpdateHandler = vi.fn()
    syncWallet.subscribe({
      [SparkWalletEvent.BalanceUpdate]: balanceUpdateHandler,
    })

    expect(fakeWallet.on).toHaveBeenCalledTimes(1)
    expect(fakeWallet.on).toHaveBeenCalledWith(
      "balance:update",
      balanceUpdateHandler
    )
  })

  test("unsubscribe removes exactly the handlers it registered", async () => {
    const fakeWallet = createFakeSdkWallet()
    initializeMock.mockResolvedValueOnce({ wallet: fakeWallet })

    await using syncWallet = await createSharedSparkSyncWallet(nextSecret())
    const balanceUpdateHandler = vi.fn()
    const transferClaimedHandler = vi.fn()
    const unsubscribe = syncWallet.subscribe({
      [SparkWalletEvent.BalanceUpdate]: balanceUpdateHandler,
      [SparkWalletEvent.TransferClaimed]: transferClaimedHandler,
    })

    unsubscribe()

    expect(fakeWallet.off).toHaveBeenCalledTimes(2)
    expect(fakeWallet.off).toHaveBeenCalledWith(
      "balance:update",
      balanceUpdateHandler
    )
    expect(fakeWallet.off).toHaveBeenCalledWith(
      "transfer:claimed",
      transferClaimedHandler
    )
  })
})

describe("Spark wallet claims", () => {
  test("claims a transfer once when the claim poll lists it again, and retries a failed claim", async () => {
    // The wallet `initialize` builds, to call its claims as the SDK does.
    interface ClaimingWallet {
      readonly claimTransfer: (params: object) => Promise<unknown>
    }
    const built: { wallet?: ClaimingWallet } = {}
    initializeMock.mockImplementationOnce(async function (
      this: new () => ClaimingWallet
    ) {
      built.wallet = new this()
      return { wallet: built.wallet }
    })
    await using _wallet = await createSharedSparkSyncWallet(nextSecret())
    const { wallet } = built
    if (wallet === undefined) throw new Error("No wallet was built.")
    const claim = (id: string) => wallet.claimTransfer({ transfer: { id } })

    sdkClaimTransferMock.mockClear()
    let release = () => {}
    sdkClaimTransferMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(["leaf-1"])
        })
    )
    // The stream's claim, then the poll's while the first still runs.
    const streamClaim = claim("transfer-1")
    const pollClaim = claim("transfer-1")
    release()
    expect(await streamClaim).toEqual(["leaf-1"])
    expect(await pollClaim).toEqual(["leaf-1"])
    // A poll that listed it before the claim ended.
    expect(await claim("transfer-1")).toEqual(["leaf-1"])
    expect(sdkClaimTransferMock).toHaveBeenCalledTimes(1)

    sdkClaimTransferMock.mockRejectedValueOnce(new Error("unavailable"))
    await expect(claim("transfer-2")).rejects.toThrow("unavailable")
    await claim("transfer-2")
    expect(sdkClaimTransferMock.mock.calls).toEqual([
      ["transfer-1"],
      ["transfer-2"],
      ["transfer-2"],
    ])
  })
})

describe("Spark wallet incoming transfers", () => {
  // The wallet `initialize` builds, to deliver stream events as the SDK does.
  interface StreamWallet {
    readonly handleStreamEvent: (
      data: SubscribeToEventsResponse
    ) => Promise<unknown>
  }
  const createStreamWallet = async () => {
    const built: { wallet?: StreamWallet } = {}
    initializeMock.mockImplementationOnce(async function (
      this: new () => StreamWallet
    ) {
      built.wallet = new this()
      return { wallet: built.wallet }
    })
    const syncWallet = await createSharedSparkSyncWallet(nextSecret())
    const { wallet } = built
    if (wallet === undefined) throw new Error("No wallet was built.")
    return { syncWallet, wallet }
  }

  const receiverTransferEvent = (
    transfer: Partial<Transfer>
  ): SubscribeToEventsResponse => ({
    event: {
      $case: "receiverTransfer",
      receiverTransfer: {
        traceId: "",
        transfer: {
          id: "transfer-1",
          type: TransferType.TRANSFER,
          status: TransferStatus.TRANSFER_STATUS_SENDER_KEY_TWEAKED,
          senderIdentityPublicKey: Uint8Array.of(2, 1),
          receiverIdentityPublicKey: Uint8Array.of(2, 2),
          ...transfer,
        } as Transfer,
      },
    },
  })

  beforeEach(() => {
    sdkHandleStreamEventMock.mockClear()
    constructTransfersWithUserRequestMock.mockClear()
  })

  test("announces an incoming transfer before the SDK claims it", async () => {
    const { syncWallet, wallet } = await createStreamWallet()
    await using _syncWallet = syncWallet
    const onIncomingTransfer = vi.fn()
    const unsubscribe = syncWallet.subscribe({
      "transfer:incoming": onIncomingTransfer,
    })
    const event = receiverTransferEvent({
      id: "transfer-1",
      type: TransferType.PREIMAGE_SWAP,
    })

    const handled = wallet.handleStreamEvent(event)
    // The SDK's own handler, which claims the transfer, starts at once.
    expect(sdkHandleStreamEventMock).toHaveBeenCalledWith(event)
    await handled

    expect(onIncomingTransfer).toHaveBeenCalledTimes(1)
    const [transferId, transfer] = onIncomingTransfer.mock.calls[0] ?? []
    expect(transferId).toBe("transfer-1")
    expect(onIncomingTransfer.mock.invocationCallOrder[0]).toBeLessThan(
      sdkHandleStreamEventMock.mock.invocationCallOrder[0] ?? 0
    )
    expect(await transfer).toEqual({
      id: "transfer-1",
      userRequest: { id: "request-transfer-1" },
    })
    expect(constructTransfersWithUserRequestMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: "transfer-1" }),
    ])

    unsubscribe()
    await wallet.handleStreamEvent(receiverTransferEvent({ id: "transfer-2" }))
    expect(onIncomingTransfer).toHaveBeenCalledTimes(1)
  })

  test("does not announce a self transfer or a counter swap", async () => {
    const { syncWallet, wallet } = await createStreamWallet()
    await using _syncWallet = syncWallet
    const onIncomingTransfer = vi.fn()
    syncWallet.subscribe({ "transfer:incoming": onIncomingTransfer })

    const events = [
      receiverTransferEvent({
        senderIdentityPublicKey: Uint8Array.of(2, 2),
        receiverIdentityPublicKey: Uint8Array.of(2, 2),
      }),
      receiverTransferEvent({ type: TransferType.COUNTER_SWAP }),
      receiverTransferEvent({ type: TransferType.COUNTER_SWAP_V3 }),
      // Claimed already: the SDK claims it no more.
      receiverTransferEvent({
        status: TransferStatus.TRANSFER_STATUS_COMPLETED,
      }),
    ]
    for (const event of events) await wallet.handleStreamEvent(event)

    expect(sdkHandleStreamEventMock).toHaveBeenCalledTimes(events.length)
    expect(onIncomingTransfer).not.toHaveBeenCalled()
    expect(constructTransfersWithUserRequestMock).not.toHaveBeenCalled()
  })
})
