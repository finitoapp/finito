import {
  type CategoryChoice,
  categoryChoiceKey,
  categoryChoiceLabel,
  categoryOptions,
} from "@payky/app-shared/catalog-category-choice"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import Pencil from "lucide-react-native/icons/pencil"
import { useState } from "react"
import { Button } from "../../components/ui/button.tsx"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "../../components/ui/combobox.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

interface Category {
  readonly id: CatalogCategoryId
  readonly name: string
}

/**
 * An item's category, picked from a combobox that adds one too, as web's
 * `CategoryCombobox` (catalog/0004): every category and "no category",
 * filtered by the search at the top of the sheet, and a row adding the
 * typed name when no category spells it. Choosing that row hands the
 * caller a `new` choice, which it turns into a category when it saves
 * (`resolveCategoryChoice`).
 *
 * With `onEdit`, each category's row has a pencil that closes the sheet
 * and hands the category over to rename or delete: Finito has no
 * categories screen.
 */
export function CategoryCombobox({
  categories,
  value,
  onValueChange,
  onEdit,
  disabled = false,
}: {
  readonly categories: ReadonlyArray<Category>
  readonly value: CategoryChoice
  readonly onValueChange: (value: CategoryChoice) => void
  readonly onEdit?: (category: Category) => void
  readonly disabled?: boolean
}) {
  const { t } = useTranslation()
  const label = t("catalog.items.form.category.label")
  const noneLabel = t("catalog.items.form.category.none")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const options = categoryOptions({
    categories,
    query,
    selected: value,
    noneLabel,
    addLabel: (name) => t("catalog.items.form.category.add", { name }),
  })
  const selectedKey = categoryChoiceKey(value)

  return (
    <Combobox
      value={selectedKey}
      items={{
        [selectedKey]: categoryChoiceLabel({
          choice: value,
          categories,
          noneLabel,
        }),
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Each opening starts from the whole list.
        setQuery("")
      }}
      onValueChange={(key) => {
        const option = options.find((candidate) => candidate.key === key)
        if (option !== undefined && key !== selectedKey)
          onValueChange(option.choice)
      }}
      disabled={disabled}
    >
      <ComboboxTrigger aria-label={label}>
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent title={label}>
        <ComboboxInput placeholder={t("catalog.items.form.category.search")} />
        <ComboboxList>
          {options.map((option) => {
            const { choice } = option
            const category =
              choice.kind === "existing"
                ? categories.find((candidate) => candidate.id === choice.id)
                : undefined
            return (
              <ComboboxItem
                key={option.key}
                value={option.key}
                trailing={
                  onEdit === undefined || category === undefined ? undefined : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      iconStart={Pencil}
                      aria-label={t("catalog.items.form.category.edit.aria", {
                        name: category.name,
                      })}
                      onPress={() => {
                        setOpen(false)
                        onEdit(category)
                      }}
                    />
                  )
                }
              >
                {option.label}
              </ComboboxItem>
            )
          })}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
