import { createStyledContext, styled, Text, View } from "tamagui"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/ui/card.tsx`: the same parts and `size`
 * (`default` | `sm`), passed from `Card` to its parts by a styled context,
 * in fazole.fit's card (Linky's `packages/ui/src/layout.tsx` `Card`): a
 * 16-round `bg-card` surface with no ring, set off by its fill alone.
 *
 * Tailwind mirrored otherwise: `Card` `flex-col gap-4 py-4 overflow-hidden`
 * (sm: `gap-3 py-3`); `CardHeader` `gap-1 px-4` (sm `px-3`); `CardTitle`
 * `text-base font-medium` (sm `text-sm`); `CardDescription` `text-sm
 * text-muted-foreground`; `CardContent` `px-4` (sm `px-3`); `CardFooter`
 * `bg-muted/50 p-4` (sm `p-3`), without web's top rule.
 *
 * Native differences: web drops the card's bottom padding when it has a
 * footer (`has-data-[slot=card-footer]:pb-0`); here the footer cancels it
 * with a negative bottom margin. Web's `CardAction` is the header grid's
 * second column; here it sits absolutely in the header's top-right corner,
 * so a long title must leave it room.
 */

const CardContext = createStyledContext<{ size: "default" | "sm" }>({
  size: "default",
})

export const Card = styled(View, {
  name: "Card",
  context: CardContext,
  bg: "card",
  rounded: shape.card,
  overflow: "hidden",

  variants: {
    size: {
      default: { py: 16, gap: 16 },
      sm: { py: 12, gap: 12 },
    },
  } as const,

  defaultVariants: { size: "default" },
})

export const CardHeader = styled(View, {
  name: "CardHeader",
  context: CardContext,
  gap: 4,

  variants: {
    size: { default: { px: 16 }, sm: { px: 12 } },
  } as const,
})

export const CardTitle = styled(Text, {
  name: "CardTitle",
  context: CardContext,
  color: "card-foreground",
  fontWeight: fontWeight.semibold,

  variants: {
    size: {
      default: { fontSize: fontSize.base, lineHeight: fontSize.base },
      sm: { fontSize: fontSize.sm, lineHeight: fontSize.sm },
    },
  } as const,
})

export const CardDescription = styled(Text, {
  name: "CardDescription",
  color: "muted-foreground",
  fontSize: fontSize.sm,
  lineHeight: fontSize.sm,
})

export const CardAction = styled(View, {
  name: "CardAction",
  context: CardContext,
  position: "absolute",
  t: 0,

  variants: {
    size: { default: { r: 16 }, sm: { r: 12 } },
  } as const,
})

export const CardContent = styled(View, {
  name: "CardContent",
  context: CardContext,

  variants: {
    size: { default: { px: 16 }, sm: { px: 12 } },
  } as const,
})

export const CardFooter = styled(View, {
  name: "CardFooter",
  context: CardContext,
  flexDirection: "row",
  items: "center",
  bg: "muted-50",

  variants: {
    size: {
      default: { p: 16, mb: -16 },
      sm: { p: 12, mb: -12 },
    },
  } as const,
})
