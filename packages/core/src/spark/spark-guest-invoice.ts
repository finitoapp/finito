import { generateMnemonic } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"

import { SELF_PAY_INVOICE_EXPIRY_SECONDS } from "../modules/table-self-pay/table-self-pay-rate-utils.ts"

const SPARK_TIMEOUT_MS = 30_000

export interface GuestInvoiceWallet {
  readonly createLightningInvoice: (params: {
    readonly amountSats: number
    readonly memo: string
    readonly expirySeconds: number
    readonly receiverIdentityPubkey: string
  }) => Promise<{ readonly invoice: { readonly encodedInvoice: string } }>
}

const withinTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Spark did not answer in time."))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

interface ThrowawayWallet extends GuestInvoiceWallet {
  readonly cleanup?: () => Promise<void>
}

const initializeThrowawayWallet = async (): Promise<ThrowawayWallet> => {
  const { SparkWallet } = await import("@buildonspark/spark-sdk")
  const { wallet } = await SparkWallet.initialize({
    mnemonicOrSeed: generateMnemonic(wordlist),
    options: { network: "MAINNET" },
  })
  return wallet
}

let throwawayWallet: Promise<GuestInvoiceWallet> | null = null

export const prepareGuestInvoiceWallet = (
  e2eWallet: GuestInvoiceWallet | null = null
): Promise<GuestInvoiceWallet> => {
  if (e2eWallet !== null) return Promise.resolve(e2eWallet)
  if (throwawayWallet === null) {
    const initializing = initializeThrowawayWallet()
    throwawayWallet = withinTimeout(initializing, SPARK_TIMEOUT_MS).catch(
      (error: unknown) => {
        throwawayWallet = null
        void initializing
          .then((abandoned) => abandoned.cleanup?.())
          .catch(() => undefined)
        throw error
      }
    )
  }
  return throwawayWallet
}

export const createGuestLightningInvoice = async ({
  amountSats,
  memo,
  receiverIdentityPubkey,
  wallet = prepareGuestInvoiceWallet(),
  timeoutMs = SPARK_TIMEOUT_MS,
}: {
  readonly amountSats: number
  readonly memo: string
  readonly receiverIdentityPubkey: string
  readonly wallet?: Promise<GuestInvoiceWallet>
  readonly timeoutMs?: number
}): Promise<string> => {
  const mint = async () =>
    (await wallet).createLightningInvoice({
      amountSats,
      memo,
      expirySeconds: SELF_PAY_INVOICE_EXPIRY_SECONDS,
      receiverIdentityPubkey,
    })
  const { invoice } = await withinTimeout(mint(), timeoutMs)
  return invoice.encodedInvoice
}
