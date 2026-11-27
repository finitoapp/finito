import {
  Children,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react"
import { type GetProps, styled, Text, View } from "tamagui"
import { ToggleGroup as TamaguiToggleGroup } from "tamagui/unstyled"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import {
  type PressFillColors,
  pressFillClause,
  useFastTransition,
} from "./press-fill.tsx"

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
 * selected item stays selected when pressed again. A selected item takes
 * the pressed fill (`button-outline-pressed`) instead of web's `bg-muted`,
 * which is lighter than the outline fill on a light page and outshouts a
 * card on a dark one. `columns` stands in for
 * the `grid grid-cols-N` class web pages put on the group. Items reach 48
 * through `hitSlop`. Base: Tamagui `ToggleGroup` (`type="single"`,
 * `disableDeactivation`), controlled through `value` (`""` for none),
 * which selects on press; the kit draws its items' fills itself.
 *
 * The fill is `itemFills`, a flat clause on the item's frame faded by the
 * kit's `fast` transition (`press-fill.tsx`); a selection change fades it
 * too. Joined segments (`spacing={0}`) round only their outer corners.
 */

type ToggleVariant = "default" | "outline"
type ToggleSize = "default" | "sm" | "lg"

interface GroupContextValue {
  readonly value: string | null
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

const ItemFrame = styled(TamaguiToggleGroup.Item, {
  name: "ToggleGroupItem",
  // Tamagui renders the item as a `<button>` on web.
  borderWidth: 0,
  flexDirection: "row",
  items: "center",
  justify: "center",
  shrink: 0,
  gap: 4,
  cursor: "web:pointer",
  // At rest too, so enabling fades back (`useKitTransition`).
  opacity: 1,

  variants: {
    variant: { default: {}, outline: {} },
    size: {
      default: { h: 32, minW: 32, px: 10 },
      sm: { h: 28, minW: 28, px: 10 },
      lg: { h: 36, minW: 36, px: 10 },
    },
    disabled: { true: { opacity: 0.5, pointerEvents: "none" } },
  } as const,
})

/**
 * An item's fill at rest and pressed (or hovered, on web); a selected item
 * keeps its pressed fill under the finger, as it stays selected.
 */
const itemFills = {
  default: { rest: "transparent", pressed: "neutral-soft" },
  outline: { rest: "neutral-soft", pressed: "button-outline-pressed" },
  selected: {
    rest: "button-outline-pressed",
    pressed: "button-outline-pressed",
  },
} as const satisfies Record<ToggleVariant | "selected", PressFillColors>

/** An item is 12 round; a small one is a pill. */
const radii = {
  default: shape.control,
  sm: shape.pill,
  lg: shape.control,
} as const satisfies Record<ToggleSize, number>

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

/** Joined segments: square inner corners. */
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
      }
    : {
        px: 8,
        borderTopLeftRadius: startRadius,
        borderBottomLeftRadius: startRadius,
        borderTopRightRadius: endRadius,
        borderBottomRightRadius: endRadius,
      }
}

export interface ToggleGroupItemProps
  extends Omit<
    GetProps<typeof ItemFrame>,
    "children" | "rounded" | "bg" | "backgroundColor"
  > {
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
  const inactive = (group?.disabled ?? false) || disabled
  const transition = useFastTransition()
  if (group === undefined)
    throw new Error("ToggleGroupItem must be inside a ToggleGroup")
  const selected = group.value === value
  const fill = itemFills[selected ? "selected" : group.variant]
  return (
    <ItemFrame
      variant={group.variant}
      size={group.size}
      disabled={inactive}
      rounded={radii[group.size]}
      bg={pressFillClause(fill)}
      transition={transition}
      value={value}
      hitSlop={hitSlops[group.size]}
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
      variant,
      size,
      joined,
      vertical,
      disabled,
    }),
    [value, variant, size, joined, vertical, disabled]
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
      <TamaguiToggleGroup
        type="single"
        value={value ?? ""}
        // Items carry plain strings; every one of them is a `Value`.
        onValueChange={(next: string) => onValueChange(next as Value)}
        disableDeactivation
        orientation={orientation}
        disabled={disabled}
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
      </TamaguiToggleGroup>
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
