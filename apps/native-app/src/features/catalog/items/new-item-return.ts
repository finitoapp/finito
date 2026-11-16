/**
 * The `from` param of the create form when the items list opened it: its
 * "+", a scan on it, or a related product's chip on it.
 */
export const NEW_ITEM_FROM_LIST = "items"

export type NewItemReturn =
  | { readonly kind: "list"; readonly added: string }
  | { readonly kind: "back" }

/**
 * Where the create form goes once it saved an item: back to the items list
 * naming it (`?added=`), which offers its related products next
 * (catalog/0007), when the list opened the form and the item came from the
 * library; Back otherwise. Any other opener, as the bill's empty state, gets
 * the merchant back to where they were: dismissing to a list that is not on
 * the stack would put Settings › Items in that screen's place.
 */
export const newItemReturn = ({
  from,
  libraryProductId,
  createdId,
}: {
  readonly from: string | undefined
  readonly libraryProductId: string | null
  readonly createdId: string
}): NewItemReturn =>
  from === NEW_ITEM_FROM_LIST && libraryProductId !== null
    ? { kind: "list", added: createdId }
    : { kind: "back" }
