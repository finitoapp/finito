import { describe, expect, test } from "vitest"

import {
  deriveQerkoPaymentReadiness,
  describeQerkoLocationsFailure,
  describeQerkoPairingFailure,
  describeQerkoPaymentError,
  describeQerkoTerminalStatus,
  describeQerkoTerminalsFailure,
  isQerkoCodeComplete,
  isQerkoStepCancellable,
  parseQerkoIdentificationNumber,
  preselectedQerkoLocationId,
  selectableQerkoLocations,
  selectableQerkoPaymentLocations,
} from "./qerko-terminal-flow.ts"

const location = (id: string) => ({
  id,
  name: `Cafe ${id}`,
  address: {
    street: "Dlouhá",
    descriptiveNumber: "1",
    city: "Praha",
    zipCode: "11000",
    country: "CZ" as const,
  },
})

const qerkoLocations = (
  ids: ReadonlyArray<string>,
  pairedLocationId: string | null = null
) => ({
  legalEntity: {
    id: "le",
    name: "Cafe s.r.o.",
    identificationNumber: "12345678",
    country: "CZ" as const,
  },
  locations: ids.map(location),
  pairedLocationId,
})

describe("Qerko payment locations", () => {
  test("lists each location with its address on one line", () => {
    expect(selectableQerkoPaymentLocations(qerkoLocations(["a"]))).toEqual([
      { locationId: "a", name: "Cafe a", address: "Dlouhá 1, 11000 Praha" },
    ])
  })

  test("preselects the paired location, else the only one", () => {
    expect(preselectedQerkoLocationId(qerkoLocations(["a", "b"], "b"))).toBe(
      "b"
    )
    expect(preselectedQerkoLocationId(qerkoLocations(["a"]))).toBe("a")
    expect(preselectedQerkoLocationId(qerkoLocations(["a", "b"]))).toBeNull()
  })

  test("a refused key asks to pair again, an unknown location for another", () => {
    expect(
      describeQerkoLocationsFailure({ type: "QerkoHttpError", status: 401 })
    ).toEqual({
      key: "settings.qerkoPayment.location.keyRejected",
      keyRejected: true,
    })
    expect(
      describeQerkoLocationsFailure({ type: "QerkoHttpError", status: 404 })
    ).toEqual({
      key: "settings.qerkoPayment.location.notFound",
      keyRejected: false,
    })
    expect(describeQerkoLocationsFailure({ type: "FetchError" })).toEqual({
      key: "settings.qerkoPayment.location.failed",
      keyRejected: false,
    })
  })
})

describe("parseQerkoIdentificationNumber", () => {
  test("drops the spaces a company id is grouped by", () => {
    expect(parseQerkoIdentificationNumber(" 123 456 78 ")).toBe("12345678")
  })

  test.each(["", "   "])("reads %j as not entered", (input) => {
    expect(parseQerkoIdentificationNumber(input)).toBeNull()
  })
})

describe("isQerkoCodeComplete", () => {
  test("wants exactly four digits", () => {
    expect(isQerkoCodeComplete("1234")).toBe(true)
    expect(isQerkoCodeComplete("123")).toBe(false)
    expect(isQerkoCodeComplete("12345")).toBe(false)
    expect(isQerkoCodeComplete("12a4")).toBe(false)
  })
})

describe("describeQerkoPairingFailure", () => {
  test("a wrong code keeps the code step and counts the attempts left", () => {
    expect(
      describeQerkoPairingFailure({
        type: "QerkoPairingInvalidCode",
        remainingAttempts: 2,
      })
    ).toEqual({
      key: "settings.qerkoTerminal.code.invalid",
      attemptsLeft: 2,
      restart: false,
    })
  })

  test.each([
    ["QerkoPairingCodeExpired", "settings.qerkoTerminal.code.expired"],
    [
      "QerkoPairingMaxAttemptsReached",
      "settings.qerkoTerminal.code.maxAttempts",
    ],
  ])("%s sends the wizard back to the first step", (type, key) => {
    expect(describeQerkoPairingFailure({ type })).toEqual({
      key,
      attemptsLeft: null,
      restart: true,
    })
  })

  test("anything else is a connection problem and keeps the code step", () => {
    expect(describeQerkoPairingFailure({ type: "FetchError" })).toEqual({
      key: "settings.qerkoTerminal.error.unreachable",
      attemptsLeft: null,
      restart: false,
    })
  })
})

describe("selectableQerkoLocations", () => {
  test("keeps only activated terminals and the locations that have one", () => {
    const terminal = (id: string, enabled: boolean) => ({
      id,
      tid: `tid-${id}`,
      enabled,
      platform: "physical" as const,
    })

    expect(
      selectableQerkoLocations({
        legalEntity: {
          name: "Cafe",
          identificationNumber: "1",
          country: "CZ",
        },
        locations: [
          {
            id: "l1",
            name: "Main",
            terminals: [terminal("a", true), terminal("b", false)],
          },
          { id: "l2", name: "Closed", terminals: [terminal("c", false)] },
        ],
      })
    ).toEqual([
      {
        locationId: "l1",
        locationName: "Main",
        terminals: [
          {
            terminalId: "a",
            tid: "tid-a",
            locationName: "Main",
            platform: "physical",
          },
        ],
      },
    ])
  })
})

describe("describeQerkoTerminalStatus", () => {
  test("a connected terminal is fine", () => {
    expect(
      describeQerkoTerminalStatus({
        type: "status",
        authorizationServerConnection: "ok",
      })
    ).toEqual({ key: "settings.qerkoTerminal.test.connected", ok: true })
  })

  test("a terminal that cannot reach the processor is not", () => {
    expect(
      describeQerkoTerminalStatus({
        type: "status",
        authorizationServerConnection: "error",
      })
    ).toEqual({ key: "settings.qerkoTerminal.test.bankUnreachable", ok: false })
  })

  test("any other answer names the problem", () => {
    expect(describeQerkoTerminalStatus({ type: "terminalBusy" })).toEqual({
      key: "settings.qerkoTerminal.test.busy",
      ok: false,
    })
  })
})

describe("describeQerkoPaymentError", () => {
  test("a key Qerko refuses says to pair again, not that Qerko is unreachable", () => {
    expect(
      describeQerkoPaymentError({ type: "QerkoHttpError", status: 401 })
    ).toBe("paymentWait.qerko.error.keyRejected")
    expect(
      describeQerkoPaymentError({ type: "QerkoHttpError", status: 502 })
    ).toBe("paymentWait.qerko.error.unreachable")
  })

  test("a refusal to start names its reason", () => {
    expect(
      describeQerkoPaymentError({
        type: "QerkoTerminalNotStarted",
        reason: "terminalNotConnected",
      })
    ).toBe("paymentWait.qerko.notStarted.notConnected")
  })

  test("a decline never reads like a connection problem", () => {
    expect(
      describeQerkoPaymentError({
        type: "QerkoTerminalPaymentFailed",
        reason: "declined",
      })
    ).toBe("paymentWait.qerko.failed.declined")
  })

  test("a dropped connection and an unknown error each have a message", () => {
    expect(describeQerkoPaymentError({ type: "FetchError" })).toBe(
      "paymentWait.qerko.error.unreachable"
    )
    expect(describeQerkoPaymentError({ type: "SomethingNew" })).toBe(
      "paymentWait.qerko.error.generic"
    )
  })
})

describe("isQerkoStepCancellable", () => {
  test("is false once the card is being authorized", () => {
    expect(isQerkoStepCancellable("waitingForCard")).toBe(true)
    expect(isQerkoStepCancellable("authorizing")).toBe(false)
    expect(isQerkoStepCancellable("finishing")).toBe(false)
  })
})

describe("describeQerkoTerminalsFailure", () => {
  test("a key Qerko refuses needs a new pairing", () => {
    for (const status of [401, 403]) {
      expect(
        describeQerkoTerminalsFailure({ type: "QerkoHttpError", status })
      ).toEqual({
        key: "settings.qerkoTerminal.terminals.keyRejected",
        keyRejected: true,
      })
    }
  })

  test("a server error or no connection is worth another try", () => {
    expect(
      describeQerkoTerminalsFailure({ type: "QerkoHttpError", status: 503 })
        .keyRejected
    ).toBe(false)
    expect(describeQerkoTerminalsFailure({ type: "FetchError" })).toEqual({
      key: "settings.qerkoTerminal.terminals.failed",
      keyRejected: false,
    })
  })
})

describe("deriveQerkoPaymentReadiness", () => {
  const ready = {
    hasLocation: true,
    enabled: true,
    connectionDeviceId: "this",
    thisDeviceId: "this",
    connection: "connected",
  } as const

  test("is active once this device is connected, or another device serves", () => {
    expect(deriveQerkoPaymentReadiness(ready)).toEqual({ type: "active" })
    expect(
      deriveQerkoPaymentReadiness({
        ...ready,
        connectionDeviceId: "other",
        connection: "idle",
      })
    ).toEqual({ type: "active" })
  })

  test.each([["idle"], ["connecting"], ["reconnecting"]] as const)(
    "is connecting while this device's connection is %s",
    (connection) => {
      expect(deriveQerkoPaymentReadiness({ ...ready, connection })).toEqual({
        type: "connecting",
      })
    }
  )

  test("names the first thing that keeps payments out", () => {
    expect(
      deriveQerkoPaymentReadiness({
        ...ready,
        hasLocation: false,
        enabled: false,
      })
    ).toEqual({ type: "notAccepting", blocker: "noLocation" })
    expect(deriveQerkoPaymentReadiness({ ...ready, enabled: false })).toEqual({
      type: "notAccepting",
      blocker: "disabled",
    })
    expect(
      deriveQerkoPaymentReadiness({ ...ready, connectionDeviceId: null })
    ).toEqual({ type: "notAccepting", blocker: "noDevice" })
    expect(
      deriveQerkoPaymentReadiness({ ...ready, connection: "stolen" })
    ).toEqual({ type: "notAccepting", blocker: "stolen" })
  })
})
