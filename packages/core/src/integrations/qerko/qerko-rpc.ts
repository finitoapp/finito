import { type ConsoleDep, err, ok, type Result } from "@evolu/common"
import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"
import type { QerkoSocketConnection, QerkoSocketDep } from "./qerko-socket.ts"

/**
 * Qerko's POS websocket interface (`docs/qerko.md`, "Qerko payment"): Qerko
 * calls the POS and the POS answers, over one connection per restaurant that
 * the POS opens and authenticates. This file is the protocol only — the
 * envelope, the auth handshake, correlation, keepalive and what a close code
 * means. What a call returns is decided by the handlers the session is given.
 */

const DecimalSchema = z.string().min(1)

export const QerkoRpcErrorSchema = z.object({
  message: z.string(),
  code: z.string().nullable().optional(),
})
export type QerkoRpcError = z.output<typeof QerkoRpcErrorSchema>

/** A line Qerko shows and the POS checks again in `paymentStart`. */
export const QerkoBillItemSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  price: DecimalSchema,
  quantity: DecimalSchema,
  minQuantity: DecimalSchema.nullable().optional(),
})
export type QerkoBillItem = z.output<typeof QerkoBillItemSchema>

export const QerkoBillSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  currency: z.string(),
  items: z.array(QerkoBillItemSchema),
  allowPartialPayment: z.boolean(),
  allowTip: z.boolean(),
  denyDiscounts: z.boolean(),
  denyMenus: z.boolean(),
})
export type QerkoBill = z.output<typeof QerkoBillSchema>

export const QerkoTaxInfoSchema = z.object({
  rate: DecimalSchema,
  base: DecimalSchema,
  tax: DecimalSchema,
})
export type QerkoTaxInfo = z.output<typeof QerkoTaxInfoSchema>

export const QerkoReceiptSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: DecimalSchema,
      price: DecimalSchema,
    })
  ),
  taxInfo: z.array(QerkoTaxInfoSchema),
})
export type QerkoReceipt = z.output<typeof QerkoReceiptSchema>

/**
 * Qerko's `Payment`, as `paymentStart` sends it and REST `get-payment` and
 * `cancel-payment` return it. `state` stays a string: anything but `PAID` is
 * not a success (qerko/0008), including states Qerko adds later.
 */
export const QerkoWirePaymentSchema = z.object({
  id: z.string().min(1),
  idBill: z.string().min(1),
  currency: z.string(),
  state: z.string(),
  items: z.array(QerkoBillItemSchema),
  parts: z.array(
    z.object({
      provider: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      }),
      total: DecimalSchema,
    })
  ),
  discount: z.object({ value: DecimalSchema }).nullable().optional(),
})
export type QerkoWirePayment = z.output<typeof QerkoWirePaymentSchema>

const IncomingMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auth-response"),
    authorized: z.boolean(),
    error: QerkoRpcErrorSchema.nullable().optional(),
  }),
  z.object({
    type: z.literal("method-call-request"),
    uuid: z.string().nullable().optional(),
    method: z.string(),
    args: z.array(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("method-call-response"),
    uuid: z.string().nullable().optional(),
    calledMethod: z.string().optional(),
    result: z.unknown().optional(),
    error: QerkoRpcErrorSchema.nullable().optional(),
  }),
])

const IncomingMessageCodec = jsonCodec(IncomingMessageSchema)

/** Decodes one frame; anything malformed is `null`, logged and dropped. */
export const parseQerkoMessage = (
  text: string
): z.output<typeof IncomingMessageSchema> | null => {
  const decoded = IncomingMessageCodec.safeDecode(text)
  return decoded.success ? decoded.data : null
}

export type QerkoRpcResult<T> = Result<T, QerkoRpcError>

/** What Payky answers, the domain half of the interface. */
export interface QerkoPosHandlers {
  readonly searchBills: (
    qrIdentifier: string
  ) => Promise<QerkoRpcResult<ReadonlyArray<QerkoBill>>>
  readonly getBill: (idBill: string) => Promise<QerkoRpcResult<QerkoBill>>
  readonly paymentStart: (
    payment: QerkoWirePayment
  ) => Promise<QerkoRpcResult<null>>
  readonly paymentProcessed: (
    idPayment: string
  ) => Promise<QerkoRpcResult<QerkoReceipt>>
  readonly paymentClosed: (
    idPayment: string,
    state: string
  ) => Promise<QerkoRpcResult<null>>
}

export const qerkoRpcError = (
  code: string,
  message: string = code
): QerkoRpcError => ({ code, message })

const firstArgs = <TSchema extends z.ZodType>(
  schema: TSchema,
  args: ReadonlyArray<unknown>
): z.output<TSchema> | null => {
  const parsed = schema.safeParse(args)
  return parsed.success ? parsed.data : null
}

const badParameter = err(qerkoRpcError("BAD_PARAMETER", "Invalid arguments"))

type MethodHandler = (
  args: ReadonlyArray<unknown>,
  handlers: QerkoPosHandlers,
  console: ConsoleDep["console"]
) => Promise<QerkoRpcResult<unknown>>

const StringArgs = z.tuple([z.string().min(1)]).rest(z.unknown())
const ClosedArgs = z.tuple([z.string().min(1), z.string()]).rest(z.unknown())
const PaymentArgs = z.tuple([QerkoWirePaymentSchema]).rest(z.unknown())
const ErrorArgs = z.tuple([QerkoRpcErrorSchema]).rest(z.unknown())

/**
 * Every method Qerko may call on the POS. The table and order methods are
 * answered empty: Payky has no tables or menus to show in Qerko, and a payment
 * is found by its QR code alone.
 */
const posMethods = {
  noop: async () => ok(null),
  searchBills: async (args, handlers) => {
    const parsed = firstArgs(StringArgs, args)
    return parsed === null ? badParameter : handlers.searchBills(parsed[0])
  },
  getBill: async (args, handlers) => {
    const parsed = firstArgs(StringArgs, args)
    return parsed === null ? badParameter : handlers.getBill(parsed[0])
  },
  paymentStart: async (args, handlers) => {
    const parsed = firstArgs(PaymentArgs, args)
    return parsed === null
      ? err(qerkoRpcError("INVALID_DATA", "Invalid payment"))
      : handlers.paymentStart(parsed[0])
  },
  paymentProcessed: async (args, handlers) => {
    const parsed = firstArgs(StringArgs, args)
    return parsed === null ? badParameter : handlers.paymentProcessed(parsed[0])
  },
  paymentClosed: async (args, handlers) => {
    const parsed = firstArgs(ClosedArgs, args)
    return parsed === null
      ? badParameter
      : handlers.paymentClosed(parsed[0], parsed[1])
  },
  getTableList: async () => ok([]),
  getTableContents: async () => ok([]),
  pairCustomer: async () => ok(null),
  /** Qerko reporting a failure of ours; logged, never answered. */
  error: async (args, _handlers, console) => {
    console.warn("Qerko reported an error", firstArgs(ErrorArgs, args)?.[0])
    return ok(null)
  },
} satisfies Record<string, MethodHandler>

export type QerkoPosMethod = keyof typeof posMethods

const isQerkoPosMethod = (method: string): method is QerkoPosMethod =>
  Object.hasOwn(posMethods, method)

/** How long Qerko and Payky wait on each other. */
export const qerkoRpcTiming = {
  /**
   * For `auth-response`. Qerko answers a valid key at once but an invalid one
   * only after about 15 s, and that answer is what tells the two apart.
   */
  authTimeoutMs: 30_000,
  /** Qerko calls `noop` after 45 s of quiet, so 60 s means the line is dead. */
  silenceTimeoutMs: 60_000,
  /** For the reply to our own `noop`, sent once the session is authorized. */
  noopTimeoutMs: 5_000,
  /** Close 4503: Qerko is unavailable and asks for a pause. */
  unavailableDelayMs: 120_000,
}
export type QerkoRpcTiming = typeof qerkoRpcTiming

/**
 * Where a session is. `reconnecting` ends it; its `delayMs` is how long Qerko
 * asked to wait, `null` when it is the caller's backoff to choose. `stolen`
 * (another device took the restaurant's one connection) and `unauthorized`
 * end it for good.
 */
export type QerkoSessionState =
  | { readonly type: "connecting" }
  | { readonly type: "connected" }
  | { readonly type: "reconnecting"; readonly delayMs: number | null }
  | { readonly type: "stolen" }
  | { readonly type: "unauthorized" }

export type QerkoSessionEnd = Exclude<
  QerkoSessionState,
  { readonly type: "connecting" } | { readonly type: "connected" }
>

/** What a close code from Qerko means for the next connection. */
export const qerkoCloseOutcome = (
  code: number,
  timing: QerkoRpcTiming = qerkoRpcTiming
): QerkoSessionEnd => {
  if (code === 4409) return { type: "stolen" }
  if (code === 4401) return { type: "unauthorized" }
  if (code === 4503)
    return { type: "reconnecting", delayMs: timing.unavailableDelayMs }
  if (code === 1001) return { type: "reconnecting", delayMs: 0 }
  return { type: "reconnecting", delayMs: null }
}

export interface QerkoRpcSession {
  /** Ends the session from our side; no state is reported after it. */
  readonly close: () => void
}

/**
 * One connection: opens the socket, authenticates within Qerko's 5 s, answers
 * Qerko's calls through `handlers`, and reports its state until it ends. It
 * never reconnects itself — a new session is the caller's to open, after the
 * delay the ending state names.
 */
export const createQerkoRpcSession = ({
  qerkoSocket,
  console,
  url,
  posId,
  apiKey,
  locale,
  handlers,
  onState,
  onError,
  timing = qerkoRpcTiming,
}: QerkoSocketDep &
  ConsoleDep & {
    readonly url: string
    readonly posId: string
    readonly apiKey: string
    readonly locale?: string
    readonly handlers: QerkoPosHandlers
    readonly onState: (state: QerkoSessionState) => void
    /** A handler threw: an unexpected crash, not a protocol failure. */
    readonly onError: (error: unknown) => void
    readonly timing?: QerkoRpcTiming
  }): QerkoRpcSession => {
  let authorized = false
  let ended = false
  let uuidCounter = 0
  const outbox: string[] = []
  const pending = new Map<string, (ok: boolean) => void>()
  let authTimer: ReturnType<typeof setTimeout> | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (authTimer !== null) clearTimeout(authTimer)
    if (silenceTimer !== null) clearTimeout(silenceTimer)
    authTimer = null
    silenceTimer = null
  }

  const finish = (state: QerkoSessionEnd | null) => {
    if (ended) return
    ended = true
    clearTimers()
    for (const resolve of pending.values()) resolve(false)
    pending.clear()
    connection.close()
    if (state !== null) onState(state)
  }

  const send = (message: unknown) => {
    const text = JSON.stringify(message)
    if (authorized) connection.send(text)
    else outbox.push(text)
  }

  const resetSilence = () => {
    if (silenceTimer !== null) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      console.warn("Qerko went quiet; reconnecting")
      finish({ type: "reconnecting", delayMs: null })
    }, timing.silenceTimeoutMs)
  }

  /** Our own call to Qerko; resolves `false` without a reply in time. */
  const call = (method: string, args: ReadonlyArray<unknown>) =>
    new Promise<boolean>((resolve) => {
      uuidCounter += 1
      const uuid = `payky-${Date.now()}-${uuidCounter}`
      const timer = setTimeout(() => {
        pending.delete(uuid)
        resolve(false)
      }, timing.noopTimeoutMs)
      pending.set(uuid, (replied) => {
        clearTimeout(timer)
        resolve(replied)
      })
      send({ type: "method-call-request", uuid, method, args })
    })

  const answer = async (
    uuid: string | null | undefined,
    method: string,
    args: ReadonlyArray<unknown>
  ) => {
    let result: QerkoRpcResult<unknown>
    if (isQerkoPosMethod(method)) {
      try {
        result = await posMethods[method](args, handlers, console)
      } catch (error) {
        onError(error)
        result = err(qerkoRpcError("UNKNOWN", "Internal error"))
      }
    } else {
      result = err(qerkoRpcError("NO_SUCH_METHOD", `No such method: ${method}`))
    }
    // A call without a uuid expects no answer.
    if (ended || uuid === null || uuid === undefined) return
    send({
      type: "method-call-response",
      uuid,
      calledMethod: method,
      result: result.ok ? result.value : null,
      error: result.ok ? null : result.error,
    })
  }

  const onMessage = (text: string) => {
    if (ended) return
    resetSilence()
    const message = parseQerkoMessage(text)
    if (message === null) {
      console.warn("Unreadable Qerko message", text.slice(0, 200))
      return
    }

    if (message.type === "auth-response") {
      if (authTimer !== null) clearTimeout(authTimer)
      authTimer = null
      if (!message.authorized) {
        console.warn("Qerko refused the key", message.error)
        finish({ type: "unauthorized" })
        return
      }
      authorized = true
      for (const queued of outbox.splice(0)) connection.send(queued)
      onState({ type: "connected" })
      void call("noop", []).then((replied) => {
        if (!replied && !ended) {
          console.warn("Qerko did not answer noop; reconnecting")
          finish({ type: "reconnecting", delayMs: null })
        }
      })
      return
    }

    if (message.type === "method-call-response") {
      if (typeof message.uuid !== "string") return
      pending.get(message.uuid)?.(true)
      pending.delete(message.uuid)
      return
    }

    void answer(message.uuid, message.method, message.args ?? [])
  }

  onState({ type: "connecting" })
  const connection: QerkoSocketConnection = qerkoSocket.connect(url, {
    onOpen: () => {
      if (ended) return
      // Sent past the outbox: it is what authorizes everything queued there.
      connection.send(
        JSON.stringify({
          type: "auth-request",
          posId,
          apiKey,
          ...(locale === undefined ? {} : { locale }),
        })
      )
      authTimer = setTimeout(() => {
        console.warn("Qerko did not answer auth-request; reconnecting")
        finish({ type: "reconnecting", delayMs: null })
      }, timing.authTimeoutMs)
      resetSilence()
    },
    onMessage,
    onClose: (code, reason) => {
      if (ended) return
      console.info("Qerko closed the connection", code, reason)
      finish(qerkoCloseOutcome(code, timing))
    },
  })

  return { close: () => finish(null) }
}
