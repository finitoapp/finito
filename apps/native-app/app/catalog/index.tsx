import { Redirect } from "expo-router"

/** The catalog opens on its items, as web's `/catalog` (navigation/0001). */
export default function CatalogIndex() {
  return <Redirect href="/catalog/items" />
}
