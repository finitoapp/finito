import { Platform } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { control, fontWeight, shape } from "../theme/tokens.ts"

/**
 * The one way an amount is headlined, wherever a screen does it (the
 * keypad, the payment screen, a wallet's balance, a detail): the number
 * large and its unit beside it on the baseline, bold and muted, at a third
 * of the number's size, on the side the locale puts it ("120 Kč", "$5").
 * Linky's `Amount`; the two sizes keep that one ratio. Given `onPress`, the
 * whole figure is a button (a bitcoin amount switching its unit).
 */
const sizes = {
  /** The keypad. */
  xl: { number: "6xl", unit: "xl" },
  /** Everything else. */
  lg: { number: "4xl", unit: "xs" },
} as const

export function AmountFigure({
  number,
  unit,
  unitFirst = false,
  size = "lg",
  align = "center",
  label,
  onPress,
  pressLabel,
  testID,
}: {
  readonly number: string
  readonly unit: string
  readonly unitFirst?: boolean
  readonly size?: keyof typeof sizes
  readonly align?: "center" | "start"
  /** What a screen reader says: the whole amount. */
  readonly label: string
  readonly onPress?: () => void
  /** The press's name on web, as a tooltip. */
  readonly pressLabel?: string
  readonly testID?: string
}) {
  const unitText = (
    <Text
      fontSize={sizes[size].unit}
      lineHeight={sizes[size].unit}
      fontWeight={fontWeight.bold}
      color="muted-foreground"
    >
      {unit}
    </Text>
  )
  return (
    <YStack
      items={align === "center" ? "center" : "flex-start"}
      self={align === "center" ? "stretch" : "flex-start"}
      gap={4}
      px={onPress === undefined ? 0 : 12}
      minH={onPress === undefined ? undefined : control.lg}
      justify="center"
      rounded={shape.control}
      bg={
        onPress === undefined ? "transparent" : "transparent press:neutral-soft"
      }
      cursor={onPress === undefined ? undefined : "web:pointer"}
      accessible
      role={onPress === undefined ? "heading" : "button"}
      aria-label={label}
      {...(Platform.OS === "web" && pressLabel !== undefined
        ? { title: pressLabel }
        : {})}
      onPress={onPress}
      testID={testID}
    >
      <XStack
        items="baseline"
        justify={align === "center" ? "center" : "flex-start"}
        gap={size === "xl" ? 8 : 6}
        maxW="100%"
      >
        {unitFirst ? unitText : null}
        <Text
          fontSize={sizes[size].number}
          lineHeight={sizes[size].number}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
          adjustsFontSizeToFit
          numberOfLines={1}
          shrink={1}
        >
          {number}
        </Text>
        {unitFirst ? null : unitText}
      </XStack>
    </YStack>
  )
}
