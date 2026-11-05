import { createConsole, err, ok } from "@evolu/common"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  createQerkoApiDep,
  createQerkoPaymentQrPayload,
  getQerkoSocketUrl,
} from "./qerko-client.ts"
import {
  createQerkoRpcSession,
  parseQerkoMessage,
  type QerkoPosHandlers,
  type QerkoSessionState,
  qerkoCloseOutcome,
  qerkoRpcError,
  qerkoRpcTiming,
} from "./qerko-rpc.ts"
import type { QerkoSocketDep, QerkoSocketHandlers } from "./qerko-socket.ts"

const uuid = "e959060f-4c88-48e3-b315-0b3a17ed7d64"

// Fixtures in the shape of Qerko's reference SDK (`IncomingMessageParserTest`).
const fixtures = {
  noop: { uuid, method: "noop", args: [], type: "method-call-request" },
  searchBills: {
    uuid,
    method: "searchBills",
    args: ["qr_identifier", null],
    type: "method-call-request",
  },
  getBill: {
    uuid,
    method: "getBill",
    args: ["id_of_bill", null],
    type: "method-call-request",
  },
  getTableList: { uuid, method: "getTableList", type: "method-call-request" },
  paymentStart: {
    uuid,
    method: "paymentStart",
    args: [
      {
        currency: "CZK",
        discount: { name: "Discount", source: "PROMO", value: "2" },
        id: "id_of_payment",
        idBill: "id_of_bill",
        idCustomer: "id_of_customer",
        items: [
          {
            id: "id_of_bill_item",
            minQuantity: "1",
            name: "Položka",
            price: "19.9",
            quantity: "1",
            tags: ["tag"],
          },
        ],
        state: "STARTED",
        parts: [
          {
            provider: { id: "p1", name: "Card", type: "CARD" },
            total: "10",
          },
          {
            provider: { id: "p2", name: "Ticket", type: "MEAL_TICKET" },
            total: "9.9",
          },
        ],
        tipBrutto: "25",
        tipNetto: "20",
      },
    ],
    type: "method-call-request",
  },
  paymentProcessed: {
    uuid,
    method: "paymentProcessed",
    args: ["id_of_payment"],
    type: "method-call-request",
  },
  paymentClosed: {
    uuid,
    method: "paymentClosed",
    args: ["id_of_payment", "PAID"],
    type: "method-call-request",
  },
  errorWithoutUuid: {
    uuid: null,
    method: "error",
    args: [{ message: "Invalid type: undefined", code: "BAD_PARAMETER" }, uuid],
    type: "method-call-request",
  },
  authorized: { type: "auth-response", authorized: true, error: null },
  unauthorized: {
    type: "auth-response",
    authorized: false,
    error: { message: "Invalid Pos-Id", code: "POS_UNKNOWN" },
  },
} as const

const bill = {
  id: "id_of_bill",
  name: "#1",
  currency: "CZK",
  items: [{ name: "Platba #1", price: "19.90", quantity: "1" }],
  allowPartialPayment: false,
  allowTip: false,
  denyDiscounts: true,
  denyMenus: true,
}

const createHandlers = (): QerkoPosHandlers & {
  readonly calls: Array<ReadonlyArray<unknown>>
} => {
  const calls: Array<ReadonlyArray<unknown>> = []
  return {
    calls,
    searchBills: async (qr) => {
      calls.push(["searchBills", qr])
      return ok([bill])
    },
    getBill: async (id) => {
      calls.push(["getBill", id])
      return err(qerkoRpcError("BILL_CLOSED"))
    },
    paymentStart: async (payment) => {
      calls.push(["paymentStart", payment.id, payment.parts.length])
      return ok(null)
    },
    paymentProcessed: async (id) => {
      calls.push(["paymentProcessed", id])
      return ok({ items: [], taxInfo: [] })
    },
    paymentClosed: async (id, state) => {
      calls.push(["paymentClosed", id, state])
      return ok(null)
    },
  }
}

const setup = (overrides: Partial<QerkoPosHandlers> = {}) => {
  const sent: unknown[] = []
  const states: QerkoSessionState[] = []
  let socketHandlers: QerkoSocketHandlers | null = null
  let closed = 0
  const qerkoSocket: QerkoSocketDep["qerkoSocket"] = {
    connect: (_url, handlers) => {
      socketHandlers = handlers
      return {
        send: (text) => sent.push(JSON.parse(text)),
        close: () => {
          closed += 1
        },
      }
    },
  }
  const handlers = { ...createHandlers(), ...overrides }
  const errors: unknown[] = []
  const session = createQerkoRpcSession({
    qerkoSocket,
    console: createConsole(),
    url: "wss://test",
    posId: "payky",
    apiKey: "key",
    handlers,
    onState: (state) => states.push(state),
    onError: (error) => errors.push(error),
  })
  const socket = () => {
    if (socketHandlers === null) throw new Error("not connected")
    return socketHandlers
  }
  const receive = (message: unknown) =>
    socket().onMessage(JSON.stringify(message))
  const authorize = () => {
    socket().onOpen()
    receive(fixtures.authorized)
  }
  const replies = () =>
    sent.filter(
      (message): message is { type: string; uuid: string } =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "method-call-response"
    )
  return {
    session,
    sent,
    states,
    socket,
    receive,
    authorize,
    replies,
    handlers,
    errors,
    closed: () => closed,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("parseQerkoMessage", () => {
  test.each(Object.entries(fixtures))(
    "reads the %s fixture",
    (_name, fixture) => {
      expect(parseQerkoMessage(JSON.stringify(fixture))).not.toBeNull()
    }
  )

  test("drops what is not JSON or not an envelope", () => {
    expect(parseQerkoMessage("{not json")).toBeNull()
    expect(parseQerkoMessage(JSON.stringify({ type: "hello" }))).toBeNull()
  })
})

describe("createQerkoRpcSession", () => {
  test("sends auth-request first and nothing else before authorization", async () => {
    const test = setup()
    test.socket().onOpen()
    test.receive(fixtures.noop)
    await vi.advanceTimersByTimeAsync(0)

    expect(test.sent).toEqual([
      { type: "auth-request", posId: "payky", apiKey: "key" },
    ])

    test.receive(fixtures.authorized)
    await vi.advanceTimersByTimeAsync(0)

    expect(test.states).toEqual([{ type: "connecting" }, { type: "connected" }])
    expect(test.sent.slice(1)).toEqual(
      expect.arrayContaining([
        {
          type: "method-call-response",
          uuid,
          calledMethod: "noop",
          result: null,
          error: null,
        },
        expect.objectContaining({
          type: "method-call-request",
          method: "noop",
        }),
      ])
    )
  })

  test("dispatches Qerko's calls to the handlers and answers by uuid", async () => {
    const test = setup()
    test.authorize()
    test.receive(fixtures.searchBills)
    test.receive(fixtures.getBill)
    test.receive(fixtures.paymentStart)
    test.receive(fixtures.paymentProcessed)
    test.receive(fixtures.paymentClosed)
    test.receive(fixtures.getTableList)
    await vi.advanceTimersByTimeAsync(0)

    expect(test.handlers.calls).toEqual([
      ["searchBills", "qr_identifier"],
      ["getBill", "id_of_bill"],
      ["paymentStart", "id_of_payment", 2],
      ["paymentProcessed", "id_of_payment"],
      ["paymentClosed", "id_of_payment", "PAID"],
    ])
    expect(test.replies()).toHaveLength(6)
    expect(test.replies()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          calledMethod: "searchBills",
          result: [bill],
        }),
        expect.objectContaining({
          calledMethod: "getBill",
          result: null,
          error: { code: "BILL_CLOSED", message: "BILL_CLOSED" },
        }),
        expect.objectContaining({ calledMethod: "paymentStart", error: null }),
        expect.objectContaining({
          calledMethod: "paymentProcessed",
          result: { items: [], taxInfo: [] },
        }),
        expect.objectContaining({ calledMethod: "paymentClosed", error: null }),
        expect.objectContaining({ calledMethod: "getTableList", result: [] }),
      ])
    )
  })

  test("answers an unknown method with NO_SUCH_METHOD and a bad payment with INVALID_DATA", async () => {
    const test = setup()
    test.authorize()
    test.receive({ ...fixtures.noop, method: "orderStart" })
    test.receive({ ...fixtures.paymentStart, args: [{ id: "x" }] })
    await vi.advanceTimersByTimeAsync(0)

    expect(test.replies()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: "NO_SUCH_METHOD" }),
      }),
      expect.objectContaining({
        error: expect.objectContaining({ code: "INVALID_DATA" }),
      }),
    ])
  })

  test("never answers a call without a uuid", async () => {
    const test = setup()
    test.authorize()
    test.receive(fixtures.errorWithoutUuid)
    test.receive({ ...fixtures.paymentClosed, uuid: null })
    await vi.advanceTimersByTimeAsync(0)

    expect(test.replies()).toEqual([])
    expect(test.handlers.calls).toEqual([
      ["paymentClosed", "id_of_payment", "PAID"],
    ])
  })

  test("a handler that throws is reported and answered with an error", async () => {
    const thrown = new Error("boom")
    const test = setup({
      searchBills: async () => {
        throw thrown
      },
    })
    test.authorize()
    test.receive(fixtures.searchBills)
    await vi.advanceTimersByTimeAsync(0)

    expect(test.errors).toEqual([thrown])
    expect(test.replies()).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: "UNKNOWN" }),
      }),
    ])
  })

  test("a refused key ends the session as unauthorized", () => {
    const test = setup()
    test.socket().onOpen()
    test.receive(fixtures.unauthorized)

    expect(test.states.at(-1)).toEqual({ type: "unauthorized" })
    expect(test.closed()).toBe(1)
  })

  test("reconnects when auth-response never comes", async () => {
    const test = setup()
    test.socket().onOpen()
    await vi.advanceTimersByTimeAsync(qerkoRpcTiming.authTimeoutMs)

    expect(test.states.at(-1)).toEqual({
      type: "reconnecting",
      delayMs: null,
    })
  })

  test("reconnects after a minute without any message", async () => {
    const test = setup()
    test.authorize()
    const noop = test.sent.find(
      (message): message is { uuid: string } =>
        (message as { method?: unknown }).method === "noop"
    )
    test.receive({
      type: "method-call-response",
      uuid: noop?.uuid,
      calledMethod: "noop",
      result: null,
      error: null,
    })
    await vi.advanceTimersByTimeAsync(qerkoRpcTiming.silenceTimeoutMs - 1)
    expect(test.states.at(-1)).toEqual({ type: "connected" })

    test.receive(fixtures.noop)
    await vi.advanceTimersByTimeAsync(qerkoRpcTiming.silenceTimeoutMs - 1)
    expect(test.states.at(-1)).toEqual({ type: "connected" })

    await vi.advanceTimersByTimeAsync(1)
    expect(test.states.at(-1)).toEqual({
      type: "reconnecting",
      delayMs: null,
    })
  })

  test("reconnects when our noop gets no answer within 5 s", async () => {
    const test = setup()
    test.authorize()
    await vi.advanceTimersByTimeAsync(qerkoRpcTiming.noopTimeoutMs)

    expect(test.states.at(-1)).toEqual({
      type: "reconnecting",
      delayMs: null,
    })
  })

  test.each([
    [1001, { type: "reconnecting", delayMs: 0 }],
    [4503, { type: "reconnecting", delayMs: 120_000 }],
    [4401, { type: "unauthorized" }],
    [4409, { type: "stolen" }],
    [1006, { type: "reconnecting", delayMs: null }],
  ])("a close with %i ends the session as %j", (code, state) => {
    const test = setup()
    test.authorize()
    test.socket().onClose(code, "")

    expect(test.states.at(-1)).toEqual(state)
    expect(qerkoCloseOutcome(code)).toEqual(state)
  })

  test("closing it ourselves reports nothing more", async () => {
    const test = setup()
    test.authorize()
    test.session.close()
    test.socket().onClose(1000, "")
    await vi.advanceTimersByTimeAsync(qerkoRpcTiming.silenceTimeoutMs)

    expect(test.states).toEqual([{ type: "connecting" }, { type: "connected" }])
  })
})

describe("Qerko URLs", () => {
  test("the websocket follows the environment, the QR host does not", () => {
    const qerkoApi = createQerkoApiDep({ posId: "payky" }).qerkoApi

    expect(getQerkoSocketUrl(qerkoApi, "sandbox")).toBe(
      "wss://sandbox.qerko.com/api/v2/pos/ws"
    )
    expect(getQerkoSocketUrl(qerkoApi, "production")).toBe(
      "wss://qerko.com/api/v2/pos/ws"
    )
    expect(
      createQerkoPaymentQrPayload({
        restaurantId: "r-1",
        qrIdentifier: "payment-1",
      })
    ).toBe("https://qerko.com/~qr/pos/r-1~payment-1")
  })

  test("the e2e base URL override reaches the websocket too", () => {
    const qerkoApi = createQerkoApiDep({
      posId: "payky",
      baseUrl: "http://mock.test/qerko",
    }).qerkoApi

    expect(getQerkoSocketUrl(qerkoApi, "sandbox")).toBe(
      "ws://mock.test/qerko/ws"
    )
  })
})
