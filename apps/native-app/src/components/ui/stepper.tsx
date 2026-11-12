import { createContext, type ReactNode, useContext } from "react"
import { View } from "tamagui"
import type { ThemeColor } from "../../theme/themes.ts"
import { radius } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/reui/stepper.tsx`, only the parts its one
 * user draws (the account-transfer progress dots): a controlled horizontal
 * `Stepper` with `StepperNav`, `StepperItem`, `StepperIndicator` and
 * `StepperSeparator`. Panels, triggers, titles, keyboard focus and the
 * vertical orientation are left out until a screen needs them.
 *
 * Tailwind mirrored: the item `flex items-center not-last:flex-1`; the
 * indicator `size-6 rounded-full bg-accent`, `bg-primary` when active or
 * completed; the separator `h-0.5 flex-1 m-0.5 rounded-sm bg-muted`.
 *
 * Native differences: an item takes `last` (web's `not-last:`), and the
 * call-site `className` of the indicator becomes `size` and `inactiveColor`.
 */

type StepState = "active" | "completed" | "inactive"

const StepperValueContext = createContext(0)
const StepItemContext = createContext<StepState>("inactive")

export function Stepper({
  value,
  children,
}: {
  readonly value: number
  readonly children?: ReactNode
}) {
  return (
    <StepperValueContext value={value}>
      <View w="100%" importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </StepperValueContext>
  )
}

export function StepperNav({ children }: { readonly children?: ReactNode }) {
  return (
    <View flexDirection="row" w="100%">
      {children}
    </View>
  )
}

export function StepperItem({
  step,
  last = false,
  children,
}: {
  readonly step: number
  readonly last?: boolean
  readonly children?: ReactNode
}) {
  const activeStep = useContext(StepperValueContext)
  const state: StepState =
    step < activeStep
      ? "completed"
      : step === activeStep
        ? "active"
        : "inactive"
  return (
    <StepItemContext value={state}>
      <View
        flexDirection="row"
        items="center"
        justify="center"
        flex={last ? undefined : 1}
      >
        {children}
      </View>
    </StepItemContext>
  )
}

export function StepperIndicator({
  size = 24,
  inactiveColor = "accent",
}: {
  readonly size?: number
  readonly inactiveColor?: ThemeColor
}) {
  const state = useContext(StepItemContext)
  return (
    <View
      w={size}
      h={size}
      shrink={0}
      rounded={radius.full}
      bg={state === "inactive" ? inactiveColor : "primary"}
    />
  )
}

export function StepperSeparator() {
  return <View flex={1} h={2} m={2} rounded={radius.sm} bg="track" />
}
