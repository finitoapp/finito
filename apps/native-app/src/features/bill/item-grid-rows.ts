export type ItemGridRow<Item, Group> =
  | { readonly type: "heading"; readonly key: string; readonly group: Group }
  | {
      readonly type: "items"
      readonly key: string
      readonly items: ReadonlyArray<Item>
    }

/** Web's 12rem minimum width of an item brick in the wide bill grid. */
const MIN_BRICK_WIDTH = 192

/** The gap between the bill grid's bricks. */
const GRID_GAP = 8

/**
 * How many columns of item bricks fit in `width`, as web's
 * `lg:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]` fills them: as many
 * 12rem bricks and their gaps as fit, never fewer than the phone's two.
 */
export function itemGridColumns(width: number): number {
  return Math.max(
    2,
    Math.floor((width + GRID_GAP) / (MIN_BRICK_WIDTH + GRID_GAP))
  )
}

/**
 * The bill grid's rows of `columns` items, as web's CSS grid lays them out:
 * two columns on a phone, as many as fit on a wide window
 * (`itemGridColumns`, web's `lg:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]`).
 * With headings on, each group starts with a full-width heading row and its
 * items on a fresh row, so a group's short last row leaves the cells beside
 * it empty. `items` arrive sorted by group, as the grouped query returns
 * them.
 */
export function buildItemGridRows<Item extends { readonly id: string }, Group>(
  items: ReadonlyArray<Item>,
  groupOf: (item: Item) => Group,
  showHeadings: boolean,
  columns: number
): ReadonlyArray<ItemGridRow<Item, Group>> {
  const rows: Array<ItemGridRow<Item, Group>> = []
  let pending: Item[] = []
  const flush = () => {
    const [first] = pending
    if (first !== undefined)
      rows.push({ type: "items", key: first.id, items: pending })
    pending = []
  }
  items.forEach((item, index) => {
    const previous = items[index - 1]
    const group = groupOf(item)
    if (
      showHeadings &&
      (previous === undefined || groupOf(previous) !== group)
    ) {
      flush()
      rows.push({ type: "heading", key: `heading:${item.id}`, group })
    }
    pending.push(item)
    if (pending.length === columns) flush()
  })
  flush()
  return rows
}
