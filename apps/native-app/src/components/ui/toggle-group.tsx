import {
  Children,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react"
import { type GetProps, styled, Text, View } from "tamagui"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/toggle-group.tsx` with the item look of
 * `ui/toggle.tsx`: the same `variant` (`default` | `outline`), `size`
 * (`default` | `sm` | `lg`), `spacing` and `orientation`.
 *
 * Tailwind mirrored: item `gap-1 rounded-lg text-sm font-medium
 * aria-pressed:bg-muted disabled:opacity-50`; `outline` `border
 * border-input`; sizes `h-8 min-w-8 px-2.5`, `sm` `h-7 min-w-7 rounded-md
 * text-[0.8rem]`, `lg` `h-9 min-w-9`; the group `gap-[spacing × 4px]`, and
 * at `spacing={0}` joined segments with only the outer corners rounded.
 *
 * Native differences: single selection only, as every web use is, with a
 * plain `value`/`onValueChange` instead of web's one-element arrays; a
 * selected item stays selected when pressed again. `columns` stands in for
 * the `grid grid-cols-N` class web pages put on the group. Items reach 48
 * through `hitSlop`. Base: a controlled Tamagui `View`, not Tamagui
 * `ToggleGroup`, which has not been tried on the device.
 */

type ToggleVariant = "default" | "outline"
type ToggleSize = "default" | "sm" | "lg"

interface GroupContextValue {
  readonly value: string | null
  readonly onValueChange: (value: string) => void
  readonly variant: ToggleVariant
  readonly size: ToggleSize
  readonly joined: boolean
  readonly vertical: boolean
  readonly disabled: boolean
}

const GroupContext = createContext<GroupContextValue | undefined>(undefined)

const PositionContext = createContext<{
  readonly first: boolean
  readonly last: boolean
}>({ first: true, last: true })

const ItemFrame = styled(View, {
  name: "ToggleGroupItem",
  flexDirection: "row",
  items: "center",
  justify: "center",
  shrink: 0,
  gap: 4,
  rounded: shape.control,
  bg: "transparent press:neutral-soft",
  cursor: "web:pointer",

  variants: {
    variant: {
      default: {},
      outline: { bg: "neutral-soft press:button-outline-pressed" },
    },
    size: {
      default: { h: 32, minW: 32, px: 10 },
      sm: { h: 28, minW: 28, px: 10, rounded: shape.pill },
      lg: { h: 36, minW: 36, px: 10 },
    },
    selected: { true: { bg: "muted" } },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

const ItemText = styled(Text, {
  name: "ToggleGroupItemText",
  color: "color",
  fontWeight: fontWeight.medium,

  variants: {
    size: {
      default: { fontSize: fontSize.sm, lineHeight: fontSize.sm },
      sm: { fontSize: 12.8 },
      lg: { fontSize: fontSize.sm, lineHeight: fontSize.sm },
    },
  } as const,
})

const hitSlops = { default: 8, sm: 10, lg: 6 } as const

/** Joined segments: square inner corners, one shared border between items. */
const joinedStyle = (
  vertical: boolean,
  { first, last }: { readonly first: boolean; readonly last: boolean }
) => {
  const startRadius = first ? shape.control : 0
  const endRadius = last ? shape.control : 0
  return vertical
    ? {
        px: 8,
        borderTopLeftRadius: startRadius,
        borderTopRightRadius: startRadius,
        borderBottomLeftRadius: endRadius,
        borderBottomRightRadius: endRadius,
        ...(first ? {} : { borderTopWidth: 0 }),
      }
    : {
        px: 8,
        borderTopLeftRadius: startRadius,
        borderBottomLeftRadius: startRadius,
        borderTopRightRadius: endRadius,
        borderBottomRightRadius: endRadius,
        ...(first ? {} : { borderLeftWidth: 0 }),
      }
}

export interface ToggleGroupItemProps
  extends Omit<GetProps<typeof ItemFrame>, "children"> {
  readonly value: string
  /** Already translated text, or custom content. */
  readonly children: ReactNode
  readonly "aria-label"?: string
  /** Disables this item alone, as web's item `disabled`. */
  readonly disabled?: boolean
}

export function ToggleGroupItem({
  value,
  children,
  "aria-label": ariaLabel,
  disabled = false,
  ...frameProps
}: ToggleGroupItemProps) {
  const group = useContext(GroupContext)
  const position = useContext(PositionContext)
  if (group === undefined)
    throw new Error("ToggleGroupItem must be inside a ToggleGroup")
  const selected = group.value === value
  const inactive = group.disabled || disabled
  return (
    <ItemFrame
      variant={group.variant}
      size={group.size}
      selected={selected}
      disabled={inactive}
      hitSlop={hitSlops[group.size]}
      onPress={inactive ? undefined : () => group.onValueChange(value)}
      role="radio"
      aria-checked={selected}
      aria-disabled={inactive}
      aria-label={
        ariaLabel ?? (typeof children === "string" ? children : undefined)
      }
      {...(group.joined ? joinedStyle(group.vertical, position) : {})}
      {...frameProps}
    >
      {typeof children === "string" ? (
        <ItemText size={group.size} numberOfLines={1}>
          {children}
        </ItemText>
      ) : (
        children
      )}
    </ItemFrame>
  )
}

export interface ToggleGroupProps<Value extends string> {
  readonly value: Value | null
  readonly onValueChange: (value: Value) => void
  /** Translated group name announced by screen readers. */
  readonly "aria-label"?: string
  readonly variant?: ToggleVariant
  readonly size?: ToggleSize
  /** Tailwind spacing steps between items (× 4 px); 0 joins them. */
  readonly spacing?: number
  readonly orientation?: "horizontal" | "vertical"
  /** Lays the items out in rows of this many equal columns. */
  readonly columns?: number
  readonly disabled?: boolean
  readonly children: ReactNode
}

export function ToggleGroup<Value extends string>({
  value,
  onValueChange,
  "aria-label": ariaLabel,
  variant = "default",
  size = "default",
  spacing = 2,
  orientation = "horizontal",
  columns,
  disabled = false,
  children,
}: ToggleGroupProps<Value>) {
  const vertical = orientation === "vertical"
  const joined = spacing === 0
  const context = useMemo<GroupContextValue>(
    () => ({
      value,
      // Items carry plain strings; every one of them is a `Value`.
      onValueChange: (next) => onValueChange(next as Value),
      variant,
      size,
      joined,
      vertical,
      disabled,
    }),
    [value, onValueChange, variant, size, joined, vertical, disabled]
  )
  const items = Children.toArray(children)
  const positioned = items.map((item, index) => (
    <PositionContext
      // biome-ignore lint/suspicious/noArrayIndexKey: positions are the identity here
      key={index}
      value={{ first: index === 0, last: index === items.length - 1 }}
    >
      {item}
    </PositionContext>
  ))
  const gap = spacing * 4
  return (
    <GroupContext value={context}>
      <View
        role="radiogroup"
        aria-label={ariaLabel}
        flexDirection={vertical ? "column" : "row"}
        items={vertical ? "stretch" : "center"}
        gap={columns === undefined ? gap : undefined}
      >
        {columns === undefined ? (
          positioned
        ) : (
          <View gap={gap} flex={1}>
            {chunk(positioned, columns).map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
              <View key={rowIndex} flexDirection="row" gap={gap}>
                {row.map((cell, cellIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  <View key={cellIndex} flex={1}>
                    {cell}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    </GroupContext>
  )
}

const chunk = <T,>(
  items: ReadonlyArray<T>,
  size: number
): ReadonlyArray<ReadonlyArray<T | null>> =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, row) =>
    Array.from(
      { length: size },
      (_, column) => items[row * size + column] ?? null
    )
  )
