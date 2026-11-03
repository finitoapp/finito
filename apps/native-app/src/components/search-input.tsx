import Search from "lucide-react-native/icons/search"
import X from "lucide-react-native/icons/x"
import { useState } from "react"
import { XStack } from "tamagui"
import { fontSize, shape } from "../theme/tokens.ts"
import { Button } from "./ui/button.tsx"
import { Icon } from "./ui/icon.tsx"
import { Input } from "./ui/input.tsx"

/**
 * Web `apps/web-app/src/components/search-input.tsx`: a 48-high search
 * field on the card background, a muted `Search` icon inside on the left and
 * a round ghost clear button on the right while there is text.
 *
 * Tailwind mirrored: the input `h-12 bg-card pl-12 text-base`, the icon
 * `left-4 size-5 text-muted-foreground`, the clear button `size="icon-sm"
 * right-2 rounded-full`.
 *
 * Native difference: web overlays the icon and pads the input past it. On
 * Android the input's left padding did not take effect and the text ran
 * under the icon, so the row draws the frame and lays the icon, the input
 * and the clear button side by side; the border turns `ring` while the input
 * has focus, as the kit Input's own border does.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  clearAriaLabel,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Already translated, as both texts. */
  readonly placeholder: string
  readonly clearAriaLabel: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <XStack
      h={48}
      items="center"
      gap={2}
      pl={16}
      pr={8}
      rounded={shape.control}
      borderWidth={1}
      borderColor={focused ? "ring" : "transparent"}
      bg="input-bg"
    >
      <Icon icon={Search} size={20} color="muted-foreground" />
      <Input
        flex={1}
        borderWidth={0}
        bg="transparent"
        fontSize={fontSize.base}
        lineHeight={fontSize.base}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value === "" ? null : (
        <Button
          variant="ghost"
          size="icon-sm"
          rounded={shape.pill}
          aria-label={clearAriaLabel}
          iconStart={X}
          onPress={() => onChange("")}
        />
      )}
    </XStack>
  )
}
