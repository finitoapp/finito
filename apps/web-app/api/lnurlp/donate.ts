import { LightningReceiveRequestStatus } from "@buildonspark/spark-sdk/types"
import { err, ok, type Result } from "@evolu/common"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import {
  createDonateWallet,
  type DonateWallet,
} from "../../src/server/donate-wallet.js"
import { loadServerBrandName } from "../../src/server/server-brand.js"
import {
  DonateSparkMnemonicSchema,
  loadServerEnv,
  throwInvalidServerEnv,
} from "../../src/server/server-env.js"
import { jsonApi } from "../_http.js"

const MSATS_PER_SAT = 1_000
const DEFAULT_MIN_SENDABLE_SATS = 1
const DEFAULT_MAX_SENDABLE_SATS = 1_000_000
const DEFAULT_INVOICE_EXPIRY_SECONDS = 600

const donateEnvShape = {
  PAYKY_DONATE_SPARK_MNEMONIC: DonateSparkMnemonicSchema,
  PAYKY_DONATE_MIN_SATS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MIN_SENDABLE_SATS),
  PAYKY_DONATE_MAX_SATS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_SENDABLE_SATS),
  // Unset, "Donate to" the app this deployment serves (`PAYKY_BRAND`).
  PAYKY_DONATE_DESCRIPTION: z.string().trim().min(1).optional(),
  PAYKY_DONATE_IDENTIFIER: z.string().trim().min(1).optional(),
  PAYKY_DONATE_CALLBACK_URL: z.string().trim().url().optional(),
  PAYKY_DONATE_INVOICE_EXPIRY_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_INVOICE_EXPIRY_SECONDS),
}

interface DonateConfig {
  readonly mnemonic: string
  readonly minSendableMsats: number
  readonly maxSendableMsats: number
  readonly description: string
  readonly identifier: string
  readonly callbackUrl: string
  readonly invoiceExpirySeconds: number
}

interface LnurlPayMetadata {
  readonly tag: "payRequest"
  readonly callback: string
  readonly minSendable: number
  readonly maxSendable: number
  readonly metadata: string
}

interface LnurlPayInvoice {
  readonly pr: string
  readonly routes: readonly []
  readonly verify: string
}

interface LnurlVerifyResponse {
  readonly status: "OK"
  readonly settled: boolean
  readonly preimage: string | null
  readonly pr: string
}

type LnurlErrorKind =
  | "config"
  | "method-not-allowed"
  | "not-found"
  | "invalid-amount"
  | "invoice"
  | "verify"

interface LnurlError {
  readonly status: "ERROR"
  readonly kind: LnurlErrorKind
  readonly reason: string
}

const lnurlError = (kind: LnurlErrorKind, reason: string): LnurlError => ({
  status: "ERROR",
  kind,
  reason,
})

const { jsonResponse, preflightResponse } = jsonApi<
  LnurlPayMetadata | LnurlPayInvoice | LnurlVerifyResponse | LnurlError
>({
  cacheControl: "no-store",
  methods: "GET",
})

/**
 * The request's own URL, never `x-forwarded-proto`/`x-forwarded-host`. Those
 * headers are attacker-supplied unless every hop in front of this function is
 * known to overwrite them, and everything derived from the origin here is a
 * leg of the payment: `callback` is where the wallet asks for the invoice,
 * the LUD-21 `verify` URL is where it checks settlement, and the identifier
 * goes into the metadata the wallet hashes into the invoice description hash.
 * A poisoned host points all three at someone else.
 *
 * Behind a proxy that rewrites the request URL itself, set
 * `PAYKY_DONATE_CALLBACK_URL` — an operator-controlled value beats guessing
 * from a header the operator cannot vouch for.
 */
const getRequestOrigin = (request: Request): string =>
  new URL(request.url).origin

const loadConfig = (request: Request): Result<DonateConfig, LnurlError> => {
  const env = loadServerEnv(() =>
    createEnv({
      server: donateEnvShape,
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
      onValidationError: throwInvalidServerEnv,
    })
  )

  const appName = loadServerBrandName()

  if (
    env === null ||
    appName === null ||
    env.PAYKY_DONATE_MIN_SATS > env.PAYKY_DONATE_MAX_SATS
  ) {
    return err(lnurlError("config", "Donation endpoint is not configured."))
  }

  const callbackUrl =
    env.PAYKY_DONATE_CALLBACK_URL ??
    `${getRequestOrigin(request)}/.well-known/lnurlp/donate`

  return ok({
    mnemonic: env.PAYKY_DONATE_SPARK_MNEMONIC,
    minSendableMsats: env.PAYKY_DONATE_MIN_SATS * MSATS_PER_SAT,
    maxSendableMsats: env.PAYKY_DONATE_MAX_SATS * MSATS_PER_SAT,
    description: env.PAYKY_DONATE_DESCRIPTION ?? `Donate to ${appName}`,
    // Derived from the callback, not from the request: the two name the same
    // deployment, so a configured callback has to carry the identifier with it.
    identifier:
      env.PAYKY_DONATE_IDENTIFIER ?? `donate@${new URL(callbackUrl).host}`,
    callbackUrl,
    invoiceExpirySeconds: env.PAYKY_DONATE_INVOICE_EXPIRY_SECONDS,
  })
}

const createMetadata = (config: DonateConfig): LnurlPayMetadata => ({
  tag: "payRequest",
  callback: config.callbackUrl,
  minSendable: config.minSendableMsats,
  maxSendable: config.maxSendableMsats,
  metadata: JSON.stringify([
    ["text/plain", config.description],
    ["text/identifier", config.identifier],
  ]),
})

const parseAmountMsats = (value: string | null): Result<number, LnurlError> => {
  if (value === null) {
    return err(lnurlError("invalid-amount", "Missing amount."))
  }

  const amount = Number(value)

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return err(
      lnurlError(
        "invalid-amount",
        "Amount must be a positive integer in millisatoshi."
      )
    )
  }

  return ok(amount)
}

const validateAmountMsats = (
  amountMsats: number,
  config: DonateConfig
): Result<number, LnurlError> => {
  if (
    amountMsats < config.minSendableMsats ||
    amountMsats > config.maxSendableMsats
  ) {
    return err(
      lnurlError(
        "invalid-amount",
        "Amount is outside the allowed donation range."
      )
    )
  }

  if (amountMsats % MSATS_PER_SAT !== 0) {
    return err(
      lnurlError(
        "invalid-amount",
        "Amount must be divisible by 1000 millisatoshi."
      )
    )
  }

  return ok(amountMsats / MSATS_PER_SAT)
}

const getVerifyUrl = (callbackUrl: string, id: string): string => {
  const verifyUrl = new URL(callbackUrl)
  verifyUrl.search = ""
  verifyUrl.searchParams.set("verify", id)

  return verifyUrl.toString()
}

const createInvoice = async (
  amountSats: number,
  config: DonateConfig
): Promise<Result<LnurlPayInvoice, LnurlError>> => {
  let wallet: DonateWallet | undefined

  try {
    wallet = await createDonateWallet(config)

    const invoice = await wallet.createLightningInvoice({
      amountSats,
      memo: config.description,
      expirySeconds: config.invoiceExpirySeconds,
      includeSparkInvoice: false,
    })

    if (invoice.id === undefined || invoice.id.trim().length === 0) {
      return err(
        lnurlError("invoice", "Could not create verifiable Lightning invoice.")
      )
    }

    return ok({
      pr: invoice.invoice.encodedInvoice,
      routes: [],
      verify: getVerifyUrl(config.callbackUrl, invoice.id),
    })
  } catch {
    return err(lnurlError("invoice", "Could not create Lightning invoice."))
  } finally {
    await wallet?.cleanup()
  }
}

const isSettledLightningReceiveStatus = (
  status: LightningReceiveRequestStatus
): boolean =>
  status === LightningReceiveRequestStatus.LIGHTNING_PAYMENT_RECEIVED ||
  status === LightningReceiveRequestStatus.PAYMENT_PREIMAGE_RECOVERED ||
  status === LightningReceiveRequestStatus.TRANSFER_COMPLETED

const verifyInvoice = async (
  id: string,
  config: DonateConfig
): Promise<Result<LnurlVerifyResponse, LnurlError>> => {
  let wallet: DonateWallet | undefined

  try {
    wallet = await createDonateWallet(config)

    const invoice = await wallet.getLightningReceiveRequest(id)

    if (invoice === null) {
      return err(lnurlError("not-found", "Not found"))
    }

    const preimage =
      invoice.paymentPreimage === undefined ||
      invoice.paymentPreimage.trim().length === 0
        ? null
        : invoice.paymentPreimage

    return ok({
      status: "OK",
      settled:
        preimage !== null || isSettledLightningReceiveStatus(invoice.status),
      preimage,
      pr: invoice.invoice.encodedInvoice,
    })
  } catch {
    return err(lnurlError("verify", "Could not verify Lightning invoice."))
  } finally {
    await wallet?.cleanup()
  }
}

const handleRequest = async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return preflightResponse()

  if (request.method !== "GET") {
    return jsonResponse(
      lnurlError("method-not-allowed", "Method not allowed."),
      { status: 405 }
    )
  }

  const configResult = loadConfig(request)

  if (!configResult.ok) {
    return jsonResponse(configResult.error, { status: 500 })
  }

  const config = configResult.value
  const requestUrl = new URL(request.url)
  const verify = requestUrl.searchParams.get("verify")

  if (verify !== null) {
    if (verify.trim().length === 0) {
      return jsonResponse(lnurlError("not-found", "Not found"), {
        status: 404,
      })
    }

    const verifyResult = await verifyInvoice(verify, config)

    return jsonResponse(
      verifyResult.ok ? verifyResult.value : verifyResult.error,
      {
        status:
          !verifyResult.ok && verifyResult.error.kind === "not-found"
            ? 404
            : 200,
      }
    )
  }

  const amount = requestUrl.searchParams.get("amount")

  if (amount === null) {
    return jsonResponse(createMetadata(config))
  }

  const parsedAmountResult = parseAmountMsats(amount)

  if (!parsedAmountResult.ok) {
    return jsonResponse(parsedAmountResult.error, { status: 400 })
  }

  const amountSatsResult = validateAmountMsats(parsedAmountResult.value, config)

  if (!amountSatsResult.ok) {
    return jsonResponse(amountSatsResult.error, { status: 400 })
  }

  const invoiceResult = await createInvoice(amountSatsResult.value, config)

  return jsonResponse(
    invoiceResult.ok ? invoiceResult.value : invoiceResult.error
  )
}

export const GET = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
