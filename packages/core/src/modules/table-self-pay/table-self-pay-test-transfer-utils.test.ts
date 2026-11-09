import { describe, expect, test } from "vitest"

import { deriveSelfPaySelectionKey } from "../shared/key-derivation.ts"
import {
  NonEmptyStringSchema,
  PositiveInteger,
  VariableSymbol,
} from "../shared/schema.ts"
import { selfPayTestRoot } from "./table-self-pay-test-fixtures.ts"
import {
  createSelfPayTestTransferEvent,
  createSelfPayTestTransferFilter,
  openSelfPayTestTransfers,
} from "./table-self-pay-test-transfer-utils.ts"

const selectionKey = deriveSelfPaySelectionKey(selfPayTestRoot)

const transfer = {
  amount: PositiveInteger(45_000),
  currency: "CZK",
  variableSymbol: VariableSymbol("1234567890"),
  recipientMessage: NonEmptyStringSchema.decode(
    "PK1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  ),
} as const

describe("self-pay test transfers", () => {
  test("open as the bank transfer they stand for, at the time they were sent", () => {
    const event = createSelfPayTestTransferEvent({
      transfer,
      selectionKey,
      createdAt: 1_780_000_000,
    })

    const [opened, ...others] = openSelfPayTestTransfers({
      events: [event],
      selectionKey,
    })

    expect(others).toEqual([])
    expect(opened).toMatchObject({
      amount: 45_000,
      currency: "CZK",
      occurredAt: 1_780_000_000_000,
      note: null,
      recipientMessage: transfer.recipientMessage,
      variableSymbol: "1234567890",
      constantSymbol: null,
      specificSymbol: null,
    })
    expect(opened?.bankReference).toMatch(/^test-[0-9a-f]{32}$/u)
  })

  test("are found by the one key every guest of the account signs with", () => {
    const first = createSelfPayTestTransferEvent({
      transfer,
      selectionKey,
      createdAt: 1_780_000_000,
    })
    const second = createSelfPayTestTransferEvent({
      transfer,
      selectionKey,
      createdAt: 1_780_000_000,
    })

    expect(first.pubkey).toBe(second.pubkey)
    expect(createSelfPayTestTransferFilter(selectionKey).authors).toEqual([
      first.pubkey,
    ])
    expect(
      openSelfPayTestTransfers({ events: [first, second], selectionKey }).map(
        ({ bankReference }) => bankReference
      )
    ).toHaveLength(2)
  })

  test("ignore what another account's guest or a forger sent", () => {
    const otherAccount = createSelfPayTestTransferEvent({
      transfer,
      selectionKey: deriveSelfPaySelectionKey(new Uint8Array(32).fill(7)),
      createdAt: 1_780_000_000,
    })
    const event = createSelfPayTestTransferEvent({
      transfer,
      selectionKey,
      createdAt: 1_780_000_000,
    })
    const forged = { ...event, created_at: event.created_at + 1 }

    expect(
      openSelfPayTestTransfers({
        events: [otherAccount, forged],
        selectionKey,
      })
    ).toEqual([])
  })
})
