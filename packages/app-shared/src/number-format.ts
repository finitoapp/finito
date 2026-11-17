const formats = new Map<string, Intl.NumberFormat>()

/**
 * `new Intl.NumberFormat(locale, options)`, built once per locale and
 * options. Building one resolves the locale's data and costs far more than
 * formatting with it, and amounts are formatted on every render of every
 * row, figure and keypad: on a PAX A920Pro's Hermes the formats built anew
 * took ~25 ms of one navigation (2026-11-17). Throws as the constructor does
 * (an unknown currency), and caches nothing then.
 */
export const numberFormat = (
  locale: string,
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat => {
  // A one-way key; the options are literals built the same way each time.
  const key = `${locale}|${JSON.stringify(options)}`
  const cached = formats.get(key)
  if (cached !== undefined) return cached
  const format = new Intl.NumberFormat(locale, options)
  formats.set(key, format)
  return format
}
