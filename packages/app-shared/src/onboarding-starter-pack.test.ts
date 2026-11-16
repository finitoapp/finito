import { testProductLibrary } from "@payky/core/testing/product-library"
import { describe, expect, test } from "vitest"
import { initialOnboardingFormState } from "./onboarding-form-state.ts"
import {
  canFinishOnboarding,
  isStarterProductChecked,
  isStarterProductPriceInvalid,
  type OnboardingStarterPack,
  offeredStarterPacks,
  offersStarterPacks,
  onboardingStarterItems,
  pickStarterPack,
  setStarterProductChecked,
  setStarterProductPrice,
  starterPackOffer,
} from "./onboarding-starter-pack.ts"

const cafe = (
  prices: Readonly<Record<string, string>>,
  unchecked: ReadonlyArray<string> = []
): OnboardingStarterPack =>
  unchecked.reduce(
    (state, id) => setStarterProductChecked(state, id, false),
    Object.entries(prices).reduce(
      (state, [id, price]) => setStarterProductPrice(state, id, price),
      pickStarterPack(initialOnboardingFormState.starterPack, "cafe")
    )
  )

const context = (starterPack: OnboardingStarterPack) =>
  ({
    library: testProductLibrary,
    accountType: "new",
    homeMode: "pos",
    starterPack,
    language: "en",
  }) as const

describe("starter packs on the last step", () => {
  test("starts with no starter pack", () => {
    const { starterPack } = initialOnboardingFormState
    expect(starterPack.packId).toBeNull()
    expect(onboardingStarterItems(context(starterPack))).toEqual([])
    expect(canFinishOnboarding(context(starterPack))).toBe(true)
  })

  test("offers starter packs only to a new account selling from items once the library has loaded", () => {
    const offer = {
      library: testProductLibrary,
      accountType: "new",
      homeMode: "pos",
      language: "en",
    } as const
    expect(offersStarterPacks(offer)).toBe(true)
    expect(offersStarterPacks({ ...offer, library: undefined })).toBe(false)
    expect(offersStarterPacks({ ...offer, homeMode: "numpad" })).toBe(false)
    expect(offersStarterPacks({ ...offer, homeMode: null })).toBe(false)
    for (const accountType of [
      "restore",
      "transfer",
      "fromPayky",
      "existingMnemonic",
    ] as const) {
      expect(offersStarterPacks({ ...offer, accountType })).toBe(false)
    }
  })

  test("lists a pack's suggestable products in its order, named in the device language and all checked", () => {
    expect(
      offeredStarterPacks(testProductLibrary, "cs").map((pack) => pack.id)
    ).toEqual(["cafe", "bar"])
    const offer = starterPackOffer(testProductLibrary, "bar", "cs")
    expect(offer.map(({ name }) => name)).toEqual([
      "Točené pivo 0,5 l",
      "Točené pivo 0,3 l",
      "Nealkoholické pivo",
    ])
    const picked = pickStarterPack(
      initialOnboardingFormState.starterPack,
      "bar"
    )
    expect(
      offer.every(({ product }) => isStarterProductChecked(picked, product.id))
    ).toBe(true)
    // The retired Irish coffee is never offered.
    expect(
      starterPackOffer(testProductLibrary, "cafe", "en").map(
        ({ product }) => product.id
      )
    ).toEqual(["espresso", "cappuccino", "croissant"])
  })

  test("cannot finish until every checked product has a typed price", () => {
    expect(canFinishOnboarding(context(cafe({})))).toBe(false)
    expect(
      canFinishOnboarding(context(cafe({ espresso: "45", cappuccino: "59" })))
    ).toBe(false)
    expect(
      canFinishOnboarding(
        context(cafe({ espresso: "45", cappuccino: "59", croissant: "" }))
      )
    ).toBe(false)
    expect(
      canFinishOnboarding(
        context(cafe({ espresso: "45", cappuccino: "59", croissant: "35" }))
      )
    ).toBe(true)
  })

  test("takes 0 as a typed price but not a negative or unreadable one", () => {
    const free = cafe({ espresso: "0", cappuccino: "59", croissant: "35" })
    expect(canFinishOnboarding(context(free))).toBe(true)
    expect(isStarterProductPriceInvalid(free, "espresso")).toBe(false)
    for (const typed of ["-5", "abc"]) {
      const refused = setStarterProductPrice(free, "espresso", typed)
      expect(canFinishOnboarding(context(refused))).toBe(false)
      expect(isStarterProductPriceInvalid(refused, "espresso")).toBe(true)
    }
    // A blank field is missing, not wrong.
    expect(isStarterProductPriceInvalid(cafe({}), "espresso")).toBe(false)
  })

  test("submits only the checked products with the prices typed", () => {
    const starterPack = cafe({ espresso: "45", cappuccino: "59,50" }, [
      "croissant",
    ])
    expect(canFinishOnboarding(context(starterPack))).toBe(true)
    expect(onboardingStarterItems(context(starterPack))).toEqual([
      {
        name: "Espresso",
        libraryProductId: "espresso",
        unitAmount: 4500,
        categoryName: "Coffee",
        taxRatePercentage: 1200,
      },
      {
        name: "Cappuccino",
        libraryProductId: "cappuccino",
        unitAmount: 5950,
        categoryName: "Coffee",
        taxRatePercentage: 1200,
      },
    ])
  })

  test("names and categorizes the items in the device language, with the library's VAT for the account's country", () => {
    const starterPack = setStarterProductPrice(
      pickStarterPack(initialOnboardingFormState.starterPack, "bar"),
      "draft-lager-large",
      "55"
    )
    const items = onboardingStarterItems({
      ...context(
        setStarterProductChecked(
          setStarterProductChecked(starterPack, "draft-lager-small", false),
          "non-alcoholic-beer",
          false
        )
      ),
      language: "cs",
    })
    expect(items).toEqual([
      {
        name: "Točené pivo 0,5 l",
        libraryProductId: "draft-lager-large",
        unitAmount: 5500,
        categoryName: "Pivo",
        taxRatePercentage: 2100,
      },
    ])
  })

  test("submits no starter items when selling on the keypad", () => {
    const starterPack = cafe({})
    expect(
      onboardingStarterItems({ ...context(starterPack), homeMode: "numpad" })
    ).toEqual([])
    expect(
      canFinishOnboarding({ ...context(starterPack), homeMode: "numpad" })
    ).toBe(true)
  })

  test("submits no starter items when starting empty, and keeps the prices typed", () => {
    const priced = cafe({ espresso: "45" })
    const empty = pickStarterPack(priced, null)
    expect(onboardingStarterItems(context(empty))).toEqual([])
    expect(canFinishOnboarding(context(empty))).toBe(true)
    expect(empty.prices).toEqual({ espresso: "45" })
  })

  test("submits no starter items without a library or for an account being opened", () => {
    const starterPack = cafe({ espresso: "45", cappuccino: "59" })
    expect(
      onboardingStarterItems({ ...context(starterPack), library: undefined })
    ).toEqual([])
    expect(
      onboardingStarterItems({
        ...context(starterPack),
        accountType: "existingMnemonic",
      })
    ).toEqual([])
  })

  test("checks every product of a newly picked pack again", () => {
    const unchecked = cafe({}, ["espresso"])
    expect(isStarterProductChecked(unchecked, "espresso")).toBe(false)
    expect(
      isStarterProductChecked(pickStarterPack(unchecked, "cafe"), "espresso")
    ).toBe(false)
    const again = pickStarterPack(pickStarterPack(unchecked, "bar"), "cafe")
    expect(isStarterProductChecked(again, "espresso")).toBe(true)
  })
})
