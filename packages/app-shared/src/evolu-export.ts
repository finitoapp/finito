import { format } from "date-fns"
import type { Brand } from "./brand.ts"

export type EvoluExportDatabase = "app"

export function createEvoluExportFilename({
  brand,
  createdAt,
  database,
}: {
  readonly brand: Brand
  readonly createdAt: Date
  readonly database: EvoluExportDatabase
}): string {
  return `${brand.id}-evolu-${database}-export-${formatFilenameTimestamp(createdAt)}.sqlite`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`

  const units = ["KiB", "MiB", "GiB"] as const
  let value = bytes / 1024

  for (const unit of units) {
    if (value < 1024) return `${value.toFixed(1)} ${unit}`
    value /= 1024
  }

  return `${value.toFixed(1)} TiB`
}

export function formatExportCreatedAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date)
}

const formatFilenameTimestamp = (date: Date) =>
  format(date, "yyyy-MM-dd-HHmmss")
