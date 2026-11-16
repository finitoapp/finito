import type { LibraryProduct } from "@payky/core/integrations/product-library/product-library-client"
import { searchLibraryProducts } from "@payky/core/integrations/product-library/product-library-search"
import { libraryCategoryName } from "@payky/core/integrations/product-library/product-library-utils"
import { useMemo, useState } from "react"
import { Text, View, XStack, YStack } from "tamagui"
import { LibraryPicture } from "../../components/library-picture.tsx"
import {
  Combobox,
  ComboboxItem,
  ComboboxList,
} from "../../components/ui/combobox.tsx"
import { Input } from "../../components/ui/input.tsx"
import { useProductLibrary } from "../../hooks/use-product-library.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, shape } from "../../theme/tokens.ts"

/** How many library products the name field suggests at most. */
const SUGGESTION_LIMIT = 6

/** The side of a suggestion's picture. */
const SUGGESTION_PICTURE_SIZE = 32

/**
 * An item's name field in the create forms, suggesting products of the
 * product library under it (`docs/plans/product-library.md`): while it is
 * focused and holds text, up to six products whose name or synonym matches,
 * each with its picture and its library category. Typing on ignores them, so
 * the item is saved with exactly what was typed; choosing one hands it to
 * `onChoose`, which fills the form (`libraryProductPrefill`), and hides the
 * list until the name is edited again. Without a loaded library it is the
 * plain name field.
 *
 * Built on the kit's combobox parts, whose input is the name field itself
 * rather than a search in a sheet: the list sits under the field, in the
 * form. Choosing keeps the field focused, so on Android the keyboard stays
 * (`keyboardShouldPersistTaps`); on the web the list keeps a press from
 * blurring the field, which would take the list away before the press
 * lands. Native-only for now: the product library lands in Finito first.
 */
export function LibraryNameField({
  value,
  onChangeText,
  onChoose,
  placeholder,
  invalid,
  disabled,
  autoFocus,
}: {
  readonly value: string
  readonly onChangeText: (value: string) => void
  readonly onChoose: (product: LibraryProduct) => void
  /** Already translated. */
  readonly placeholder: string
  readonly invalid: boolean
  readonly disabled: boolean
  readonly autoFocus?: boolean
}) {
  const { t, language } = useTranslation()
  const { library } = useProductLibrary()
  const [focused, setFocused] = useState(false)
  // Set once a suggestion is chosen, cleared by the next edit of the name.
  const [chosen, setChosen] = useState(false)
  const active = library !== undefined && focused && !chosen && !disabled
  const suggestions = useMemo(
    () =>
      library === undefined || !active
        ? []
        : searchLibraryProducts(library, {
            query: value,
            language,
            limit: SUGGESTION_LIMIT,
          }),
    [library, active, value, language]
  )

  return (
    <Combobox<string>
      value={null}
      onValueChange={(id) => {
        const product = suggestions.find((candidate) => candidate.id === id)
        if (product === undefined) return
        setChosen(true)
        onChoose(product)
      }}
      inputValue={value}
      onInputValueChange={(next) => {
        setChosen(false)
        onChangeText(next)
      }}
      disabled={disabled}
    >
      <Input
        value={value}
        disabled={disabled}
        invalid={invalid}
        autoComplete="off"
        autoCorrect={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => {
          setChosen(false)
          onChangeText(next)
        }}
      />
      {library === undefined || suggestions.length === 0 ? null : (
        <View onMouseDown={(event) => event.preventDefault()}>
          <ComboboxList aria-label={t("catalog.library.suggestionsLabel")}>
            {suggestions.map((product) => (
              <ComboboxItem key={product.id} value={product.id}>
                <XStack items="center" gap={10}>
                  <View
                    w={SUGGESTION_PICTURE_SIZE}
                    h={SUGGESTION_PICTURE_SIZE}
                    rounded={shape.control}
                    bg="neutral-soft"
                    overflow="hidden"
                  >
                    <LibraryPicture
                      libraryProductId={product.id}
                      size={SUGGESTION_PICTURE_SIZE}
                    />
                  </View>
                  <YStack flex={1} minW={0} gap={2}>
                    <Text
                      fontSize={fontSize.sm}
                      lineHeight={fontSize.sm}
                      numberOfLines={1}
                    >
                      {product.names[language]}
                    </Text>
                    <Text
                      fontSize={fontSize.xs}
                      lineHeight={fontSize.xs}
                      color="muted-foreground"
                      numberOfLines={1}
                    >
                      {libraryCategoryName(library, product, language) ?? ""}
                    </Text>
                  </YStack>
                </XStack>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </View>
      )}
    </Combobox>
  )
}
