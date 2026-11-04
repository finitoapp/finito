import { Children, createContext, type ReactNode, useContext } from "react"
import { styled, Text, View } from "tamagui"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/reui/timeline.tsx`, only what its one
 * user draws (the reconciliations of a payment): a vertical, controlled
 * `Timeline` with `TimelineItem`, `TimelineHeader`, `TimelineDate`,
 * `TimelineTitle`, `TimelineIndicator`, `TimelineSeparator` and
 * `TimelineContent`. The horizontal orientation is left out.
 *
 * Tailwind mirrored (vertical): the item `relative flex-col gap-0.5 ms-8
 * not-last:pb-6`; the indicator `absolute -left-6 -translate-x-1/2 top-0
 * size-4 rounded-full border-2 border-primary/20`, `border-primary` once
 * completed; the separator `absolute -left-6 -translate-x-1/2
 * translate-y-4.5 w-0.5 h-[calc(100%-1.25rem)] bg-primary/10`, `bg-primary`
 * when the next item is completed, hidden on the last item; the date `mb-1
 * text-xs font-medium text-muted-foreground`; the title `text-sm
 * font-medium`; the content `text-sm text-muted-foreground`.
 *
 * Native differences: an item takes `last` (web's `group-last:`), the
 * translate offsets are written out as `l`/`t`, and `TimelineContent`
 * is a plain view whose texts carry their own size and color, as RN text
 * does not inherit them.
 */

interface ItemState {
  readonly completed: boolean
  readonly nextCompleted: boolean
  readonly last: boolean
}

const TimelineValueContext = createContext(0)
const TimelineItemContext = createContext<ItemState>({
  completed: false,
  nextCompleted: false,
  last: false,
})

export function Timeline({
  value,
  children,
}: {
  readonly value: number
  readonly children?: ReactNode
}) {
  return (
    <TimelineValueContext value={value}>
      <View>{children}</View>
    </TimelineValueContext>
  )
}

export function TimelineItem({
  step,
  last = false,
  children,
}: {
  readonly step: number
  readonly last?: boolean
  readonly children?: ReactNode
}) {
  const activeStep = useContext(TimelineValueContext)
  return (
    <TimelineItemContext
      value={{
        completed: step <= activeStep,
        nextCompleted: step + 1 <= activeStep,
        last,
      }}
    >
      <View ml={32} pb={last ? 0 : 24} gap={2}>
        {children}
      </View>
    </TimelineItemContext>
  )
}

export const TimelineHeader = View

export const TimelineDate = styled(Text, {
  name: "TimelineDate",
  mb: 4,
  fontSize: fontSize.xs,
  lineHeight: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: "muted-foreground",
})

/** Each string child is a text run; other children (a badge) sit beside it. */
export function TimelineTitle({ children }: { readonly children?: ReactNode }) {
  return (
    <View flexDirection="row" flexWrap="wrap" items="center" gap={8}>
      {Children.map(children, (child) =>
        typeof child === "string" ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
          >
            {child}
          </Text>
        ) : (
          child
        )
      )}
    </View>
  )
}

export function TimelineIndicator() {
  const { completed } = useContext(TimelineItemContext)
  return (
    <View
      position="absolute"
      t={0}
      l={-32}
      w={16}
      h={16}
      rounded={radius.full}
      bg={completed ? "primary" : "primary-20"}
    />
  )
}

export function TimelineSeparator() {
  const { nextCompleted, last } = useContext(TimelineItemContext)
  if (last) return null
  return (
    <View
      position="absolute"
      t={18}
      b={2}
      l={-25}
      w={2}
      bg={nextCompleted ? "primary" : "primary-10"}
    />
  )
}

export const TimelineContent = View
