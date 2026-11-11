# 0004 An item picks or adds its category in a combobox, and Finito edits one from there

Status: accepted
Date: 2026-11-11

## Context

Payky's item forms picked a category from a select, so a new category
needed the categories screen first. navigation/0003 made Finito's
categories on the item instead, Linky's way: the categories as chips and a
field for a new name under them, and no categories screen, "so a category
has no rename or delete of its own". In use, the chips sat in one
horizontal row, so past a handful of categories most of them were off the
screen; the form had two controls for one choice; a typo became a chip
for good, and no category could be renamed or deleted in Finito at all.

## Decision

- **Both apps pick an item's category from a combobox.** The field shows
  the item's category or "no category"; opening it shows a search over
  "no category" and every category in its order. Typing filters the
  categories by name, case and diacritics aside, and adds a last row
  "Add “name”" unless a category already spells the typed name, case and
  surrounding spaces aside (`categoryOptions`). The item forms under
  Settings and the create-item dialog of a bill all use it, in Payky and
  in Finito.
- **A typed name becomes a category when the item is saved.** Choosing
  "Add" holds the name in the form; the create forms make the category
  with the item (`resolveCategoryChoice`, `findOrCreateCatalogCategory`),
  so a form left unsaved adds none. The edit form saves a choice the
  moment it is made, as its other selects do, the new category first.
- **Finito renames or deletes a category from the combobox.** Each
  category's row has a pencil, which closes the list and opens a dialog
  with the category's name, Save, Cancel and Delete. Payky keeps its
  categories screen for that and has no pencil.
  - A rename to a name another category spells, case and surrounding
    spaces aside, is refused (`CatalogCategoryNameTaken`), not merged: two
    categories of one name would be two rows nobody tells apart, and a
    merge would move items the merchant did not open. Its own name in
    another case is a rename.
  - A delete asks first, with the copy of Payky's category screen, then
    soft-deletes the category. Its items are not rewritten; every read
    treats an item whose category is deleted as uncategorized, as Payky's
    delete already left them.
- The `catalog` permission the item form's route needs covers the dialog,
  which is reached only from there.

## Alternatives considered

- Keeping Finito's chips and offering only the categories some item holds,
  with a pencil beside the label for the selected one: the row still hid
  most categories, and a category made in Payky with no item yet was not
  offered in Finito.
- A categories screen in Finito: rejected by navigation/0003 as one more
  screen for a name chosen where it is used, and still so.
- Making the category the moment "Add" is chosen, also in the create
  forms: a form abandoned afterwards would leave a category nobody asked
  for, synced to every device.
- Opening a category to edit by a long press on its row: Finito has no long
  press anywhere else, so it would go unfound.
- Merging into the category that already has the name: moves items out of
  sight and cannot be undone.

## Consequences

- Web vendors shadcn's `combobox` (with its `input-group`), and Finito's
  kit has a `combobox` of the same parts, opening the list in its sheet
  with the search on top.
- A category nobody uses is still offered; it is deleted from the
  combobox in Finito or from the categories screen in Payky.
- An item's `categoryId` still names its deleted category; a category
  added again under that name afterwards is a new one, and the items of
  the deleted one stay uncategorized.

## Enforced by

- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > lists no category and every category while nothing is typed`
- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > filters by what is typed, case and diacritics aside, and offers to add it`
- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > offers no second category for a name one already spells`
- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > adds the name when nothing matches`
- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > keeps a typed name waiting for the item's save as a row`
- `packages/app-shared/src/catalog-category-choice.test.ts > the category combobox (catalog/0004) > shows a deleted category as none`
- `apps/web-app/e2e/catalog-categories.spec.ts > a category typed in the item form's combobox is added with the item`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is made on the item (navigation/0003) > creates the category the first time and reuses it by name afterwards`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is renamed from the item (catalog/0004) > renames it, its own name in another case included`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is renamed from the item (catalog/0004) > refuses a name another category spells, writing nothing`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > a category is renamed from the item (catalog/0004) > takes the name of a deleted category`
- `packages/core/src/modules/catalog-category/catalog-category-actions.test.ts > catalog category actions > soft-deletes a catalog category and hides it from queries`
- `packages/core/src/modules/catalog-item/catalog-item-queries.test.ts > catalogItemsPageQuery > groups items by category order, the uncategorized last`
