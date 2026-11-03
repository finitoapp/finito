import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import Check from "lucide-react-native/icons/check"
import X from "lucide-react-native/icons/x"
import { ScrollView } from "react-native"
import { View, XStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import { Field, FieldLabel } from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * An item's category, made where it is used (navigation/0003), as Linky's
 * contact groups: the categories there are as chips, one of them selected,
 * and a field for a new name under them. Typing a name drops the chip;
 * tapping a chip clears the name; tapping the selected chip again leaves
 * the item without one. The caller turns a name into a category on save
 * (`findOrCreateCatalogCategory`): the new-item form with the rest of the
 * form, the edit form through `onCommitDraft`, which puts Save and Discard
 * in the field while a name is typed, as `InlineEditField` does.
 */
export function CategoryField({
  categories,
  value,
  onValueChange,
  draft,
  onDraftChange,
  onCommitDraft,
  disabled = false,
  saving = false,
}: {
  readonly categories: ReadonlyArray<{
    readonly id: CatalogCategoryId
    readonly name: string
  }>
  readonly value: CatalogCategoryId | null
  readonly onValueChange: (value: CatalogCategoryId | null) => void
  readonly draft: string
  readonly onDraftChange: (draft: string) => void
  readonly onCommitDraft?: () => void
  readonly disabled?: boolean
  readonly saving?: boolean
}) {
  const { t } = useTranslation()
  const label = t("catalog.items.form.category.label")
  const typing = draft.trim() !== ""

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {categories.length === 0 ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
        >
          <ToggleGroup
            value={typing ? null : value}
            onValueChange={(next) => {
              onDraftChange("")
              onValueChange(next === value && !typing ? null : next)
            }}
            variant="outline"
            disabled={disabled || saving}
            aria-label={label}
          >
            {categories.map((category) => (
              <ToggleGroupItem
                key={category.id}
                value={category.id}
                minH={44}
                px={16}
              >
                {category.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </ScrollView>
      )}
      <View position="relative">
        <Input
          value={draft}
          placeholder={t("catalog.items.form.category.new.placeholder")}
          disabled={disabled || saving}
          autoCorrect={false}
          aria-label={t("catalog.items.form.category.new.placeholder")}
          pr={onCommitDraft !== undefined && typing ? 80 : 10}
          onChangeText={(text) => {
            onDraftChange(text)
            if (text.trim() !== "") onValueChange(null)
          }}
          onSubmitEditing={onCommitDraft}
        />
        {onCommitDraft === undefined || !typing ? null : (
          <XStack position="absolute" t={0} b={0} r={4} items="center" gap={2}>
            <Button
              size="icon"
              iconStart={Check}
              aria-label={t("inlineEdit.save")}
              pending={saving}
              onPress={onCommitDraft}
            />
            <Button
              variant="outline"
              size="icon"
              iconStart={X}
              aria-label={t("inlineEdit.discard")}
              disabled={saving}
              onPress={() => onDraftChange("")}
            />
          </XStack>
        )}
      </View>
    </Field>
  )
}
