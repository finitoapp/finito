import { router } from "expo-router"
import ArrowLeft from "lucide-react-native/icons/arrow-left"
import { type ReactNode, useContext, useEffect, useState } from "react"
import { Animated } from "react-native"
import { Text, View, XStack } from "tamagui"
import { useTranslation } from "../hooks/use-translation.ts"
import { control, fontSize, fontWeight } from "../theme/tokens.ts"
import { ScreenGapContext, screenPadding, useScreenScroll } from "./screen.tsx"
import { Button } from "./ui/button.tsx"
import { Icon } from "./ui/icon.tsx"

/** Back to the previous screen, or home when this one was opened cold. */
const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"))

/**
 * Web `apps/web-app/src/components/fade-header.tsx`: a centered title between
 * two slots, the start one holding a ghost back button, drawn as fazole.fit's
 * `TopBar` (Linky's `packages/ui/src/navigation.tsx`): a 44-high bar `py-2
 * gap-2`, 44-wide slots, a round ghost icon button with `ArrowLeft`, and a
 * bold 14 title in the muted text color, with a 12 muted subtitle under it.
 *
 * Inside a `Screen` it fades out over the first 75 px of scroll and drifts
 * up at 1/2.5 of the scroll speed, as web's fixed bar does: it stays the
 * first child of the scroll content and is shifted down by the rest of the
 * offset. Once faded it stops taking touches, so a tap on the content under
 * it never goes back.
 *
 * Native differences: `px-4` comes from `Screen`'s padding; the title is
 * one line. Web's bar is fixed at the top edge, so inside a `Screen` it
 * cancels the screen's top padding to sit at the same height as on the
 * screens that pad only the sides (activity).
 */

const fadeDistance = 75
const driftRatio = 1 / 2.5
/**
 * Web's content starts 16 px below its fixed header (`py-6`, an `h-6`
 * spacer and `gap-6` under the bar); this bar sits in the flow, so inside a
 * `Screen`, whose gap between its other children is wider, it takes back
 * the difference.
 */
const headerGap = 16

export function FadeHeader({
  title,
  subtitle,
  startAddon,
  endAddon,
  customStartAddonOnClick,
}: {
  /** Already translated. */
  readonly title?: string
  /** A muted second line under the title, as web's bill header has. */
  readonly subtitle?: string
  /** Replaces the back button; `null` leaves the slot empty. */
  readonly startAddon?: ReactNode | null
  /** A trailing control, such as a list's "+". */
  readonly endAddon?: ReactNode
  readonly customStartAddonOnClick?: () => void
}) {
  const { t } = useTranslation()
  const scrollY = useScreenScroll()
  const screenGap = useContext(ScreenGapContext)
  const [faded, setFaded] = useState(false)

  useEffect(() => {
    if (scrollY === null) return
    const listener = scrollY.addListener(({ value }) => {
      setFaded(value >= fadeDistance)
    })
    return () => scrollY.removeListener(listener)
  }, [scrollY])

  const bar = (
    <XStack items="center" gap={8} py={8} minH={control.md}>
      <View minW={control.md} items="flex-start">
        {startAddon === undefined ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.back")}
            onPress={customStartAddonOnClick ?? goBack}
          >
            <Icon icon={ArrowLeft} size={20} color="color" />
          </Button>
        ) : (
          startAddon
        )}
      </View>
      <View flex={1} items="center">
        <Text
          text="center"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.bold}
          color="muted-foreground"
          numberOfLines={1}
          role="heading"
          aria-level={2}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View minW={control.md} items="flex-end">
        {endAddon}
      </View>
    </XStack>
  )
  if (scrollY === null) return bar
  return (
    <Animated.View
      pointerEvents={faded ? "none" : "auto"}
      style={{
        marginTop: -screenPadding,
        marginBottom: headerGap - (screenGap ?? headerGap),
        zIndex: 10,
        opacity: scrollY.interpolate({
          inputRange: [0, fadeDistance],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1 - driftRatio],
              extrapolateLeft: "clamp",
            }),
          },
        ],
      }}
    >
      {bar}
    </Animated.View>
  )
}
