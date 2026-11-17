import { numberFormat } from "./number-format.ts"

/**
 * How long something has been going on, at minute resolution: "42 min",
 * "1 hr 5 min". Two unit formats joined rather than `Intl.DurationFormat`,
 * which older Android WebViews don't ship.
 */
export const formatElapsed = (ms: number, locale: string = "en-US") => {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const unit = (value: number, unit: "hour" | "minute") =>
    numberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "short",
    }).format(value)

  if (minutes < 60) return unit(minutes, "minute")
  const hours = unit(Math.floor(minutes / 60), "hour")
  return minutes % 60 === 0 ? hours : `${hours} ${unit(minutes % 60, "minute")}`
}
