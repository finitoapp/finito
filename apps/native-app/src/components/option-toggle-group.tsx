import type { LucideIcon } from "lucide-react-native"
import Check from "lucide-react-native/icons/check"
import { Text, View } from "tamagui"
import { Icon } from "./ui/icon.tsx"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.tsx"

/** Every text is already translated. */
export interface OptionToggleGroupOption<Value extends string> {
  readonly value: Value
  readonly icon?: LucideIcon
  readonly title: string
  readonly description?: string
}

interface OptionToggleGroupProps<Value extends string> {
  readonly value: Value | null
  readonly options: ReadonlyArray<OptionToggleGroupOption<Value>>
  readonly onChange: (value: Value) => void
  readonly disabled?: boolean
}

/**
 * Web `apps/web-app/src/components/option-toggle-group.tsx`: a vertical
 * single-select list of icon + title + description options, as an outline
 * `ToggleGroup` with `spacing={2}`. An item is `justify-start gap-6 px-6
 * py-4`, selected the soft accent (web: `border-primary bg-primary/5`, no
 * frame here) with a primary check; the title is semibold, the
 * description `text-xs text-muted-foreground`.
 */
export function OptionToggleGroup<Value extends string>({
  value,
  options,
  onChange,
  disabled,
}: OptionToggleGroupProps<Value>) {
  return (
    <ToggleGroup
      value={value}
      onValueChange={onChange}
      spacing={2}
      orientation="vertical"
      variant="outline"
      disabled={disabled}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.title}
            h="auto"
            justify="flex-start"
            gap={24}
            px={24}
            py={16}
            {...(selected ? { bg: "accent" } : {})}
          >
            {option.icon === undefined ? null : (
              <Icon icon={option.icon} color="muted-foreground" />
            )}
            <View flex={1} gap={4}>
              <Text fontWeight="600">{option.title}</Text>
              {option.description === undefined ? null : (
                <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                  {option.description}
                </Text>
              )}
            </View>
            <View opacity={selected ? 1 : 0}>
              <Icon icon={Check} color="primary" />
            </View>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
