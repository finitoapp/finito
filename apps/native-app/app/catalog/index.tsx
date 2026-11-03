import { Redirect } from "expo-router"

/** The catalog opens on Sales, the tables-and-bills grid (navigation/0002). */
export default function CatalogIndex() {
  return <Redirect href="/catalog/sales" />
}
