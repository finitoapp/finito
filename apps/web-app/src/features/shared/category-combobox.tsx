import {
  type CategoryChoice,
  type CategoryOption,
  categoryChoiceKey,
  categoryChoiceLabel,
  categoryOptions,
} from "@payky/app-shared/catalog-category-choice"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

/**
 * An item's category, picked from a combobox that adds one too
 * (catalog/0004): every category and "no category", filtered by what is
 * typed into the search at the top of its popup, and a row adding the
 * typed name when no category spells it. Choosing that row hands the
 * caller a `new` choice; the caller makes the category when it saves
 * (`resolveCategoryChoice`), so a form left unsaved adds none.
 */
export function CategoryCombobox({
  id,
  categories,
  value,
  onValueChange,
  disabled = false,
  className,
}: {
  readonly id?: string
  readonly categories: ReadonlyArray<{
    readonly id: CatalogCategoryId
    readonly name: string
  }>
  readonly value: CategoryChoice
  readonly onValueChange: (value: CategoryChoice) => void
  readonly disabled?: boolean
  readonly className?: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const noneLabel = t("catalog.items.form.category.none")
  const options = categoryOptions({
    categories,
    query,
    selected: value,
    noneLabel,
    addLabel: (name) => t("catalog.items.form.category.add", { name }),
  })
  const selectedKey = categoryChoiceKey(value)
  const selected: CategoryOption = options.find(
    (option) => option.key === selectedKey
  ) ?? {
    key: selectedKey,
    label: categoryChoiceLabel({ choice: value, categories, noneLabel }),
    choice: value,
  }

  return (
    <Combobox<CategoryOption>
      items={options}
      // `categoryOptions` has filtered them already, the same way as Finito.
      filter={null}
      value={selected}
      isItemEqualToValue={(item, current) => item.key === current.key}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.key}
      inputValue={query}
      onInputValueChange={setQuery}
      // Each opening starts from the whole list.
      onOpenChange={() => setQuery("")}
      onValueChange={(next) => {
        if (next !== null && next.key !== selectedKey)
          onValueChange(next.choice)
      }}
      disabled={disabled}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn("w-full justify-between font-normal", className)}
          />
        }
      >
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder={t("catalog.items.form.category.search")}
          aria-label={t("catalog.items.form.category.search")}
        />
        <ComboboxList>
          {(option: CategoryOption) => (
            <ComboboxItem key={option.key} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
