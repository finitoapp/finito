import type { Language } from "@payky/app-shared/i18n/resources"

/**
 * The café every app's documentation screenshots show, per language: the
 * catalog, the carts, the tables and the amounts the scenarios type, so the
 * apps' screenshots and mockups tell the same story.
 */

export interface CatalogItem {
  readonly name: string
  readonly price: string
}

export interface CartItem extends CatalogItem {
  readonly quantity: number
}

/**
 * A fuller-looking catalog grid for the bill screenshot. Only the first
 * two items are actually added to the cart (2x and 1x, see
 * `billCartByLanguage`); the rest just fill out the grid.
 */
export const billCatalogByLanguage: Record<
  Language,
  ReadonlyArray<CatalogItem>
> = {
  en: [
    { name: "Coffee", price: "4.5" },
    { name: "Croissant", price: "3.25" },
    { name: "Sandwich", price: "6" },
    { name: "Orange Juice", price: "3.5" },
    { name: "Bagel", price: "4" },
    { name: "Iced Tea", price: "3.75" },
  ],
  cs: [
    { name: "Káva", price: "65" },
    { name: "Croissant", price: "55" },
    { name: "Sendvič", price: "89" },
    { name: "Pomerančový džus", price: "45" },
    { name: "Bagel", price: "60" },
    { name: "Ledový čaj", price: "55" },
  ],
  sk: [
    { name: "Káva", price: "2.5" },
    { name: "Croissant", price: "2" },
    { name: "Sendvič", price: "3.5" },
    { name: "Pomarančový džús", price: "1.8" },
    { name: "Bagel", price: "2.2" },
    { name: "Ľadový čaj", price: "2" },
  ],
}

export const billCartByLanguage: Record<Language, ReadonlyArray<CartItem>> = {
  en: [
    { name: "Coffee", price: "4.5", quantity: 2 },
    { name: "Croissant", price: "3.25", quantity: 1 },
  ],
  cs: [
    { name: "Káva", price: "65", quantity: 2 },
    { name: "Croissant", price: "55", quantity: 1 },
  ],
  sk: [
    { name: "Káva", price: "2.5", quantity: 2 },
    { name: "Croissant", price: "2", quantity: 1 },
  ],
}

export const tableNamesByLanguage: Record<
  Language,
  readonly [string, string, string, string, string, string]
> = {
  en: ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5", "Table 6"],
  cs: ["Stůl 1", "Stůl 2", "Stůl 3", "Stůl 4", "Stůl 5", "Stůl 6"],
  sk: ["Stôl 1", "Stôl 2", "Stôl 3", "Stôl 4", "Stôl 5", "Stôl 6"],
}

export const tablesCartItemByLanguage: Record<Language, CartItem> = {
  en: { name: "Coffee", price: "4.5", quantity: 1 },
  cs: { name: "Káva", price: "65", quantity: 1 },
  sk: { name: "Káva", price: "2.5", quantity: 1 },
}

/** The split screenshot moves one of each brick off a bill holding all of them. */
export const splitCartByLanguage: Record<Language, ReadonlyArray<CartItem>> = {
  en: [...billCartByLanguage.en, { name: "Sandwich", price: "6", quantity: 1 }],
  cs: [...billCartByLanguage.cs, { name: "Sendvič", price: "89", quantity: 1 }],
  sk: [
    ...billCartByLanguage.sk,
    { name: "Sendvič", price: "3.5", quantity: 1 },
  ],
}

/** Days of demo history the stats screenshot waits for: its week and a day to compare. */
export const statsHistoryDays = 8

// A koruna amount reads as a real sale; the euro and dollar defaults already do.
export const paymentAmountByLanguage: Record<Language, string> = {
  en: "5.9",
  cs: "249",
  sk: "5.9",
}
