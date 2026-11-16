import { describe, expect, test } from "vitest"
import { NEW_ITEM_FROM_LIST, newItemReturn } from "./new-item-return.ts"

describe("where the create form goes once it saved", () => {
  test("returns to the items list naming a library item when the list opened the form", () => {
    expect(
      newItemReturn({
        from: NEW_ITEM_FROM_LIST,
        libraryProductId: "espresso",
        createdId: "item-1",
      })
    ).toEqual({ kind: "list", added: "item-1" })
  })

  test("goes back to whatever else opened it, the bill's empty state included", () => {
    expect(
      newItemReturn({
        from: undefined,
        libraryProductId: "espresso",
        createdId: "item-1",
      })
    ).toEqual({ kind: "back" })
  })

  test("goes back for an item not from the library", () => {
    expect(
      newItemReturn({
        from: NEW_ITEM_FROM_LIST,
        libraryProductId: null,
        createdId: "item-1",
      })
    ).toEqual({ kind: "back" })
  })
})
