/**
 * Two names spell the same category when they differ only in case or
 * surrounding spaces: "drinks" under "Drinks" is no second category.
 */
export const sameCategoryName = (a: string, b: string): boolean =>
  a.trim().localeCompare(b.trim(), undefined, { sensitivity: "accent" }) === 0
