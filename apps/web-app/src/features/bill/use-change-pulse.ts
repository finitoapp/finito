import { useAnimationControls, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

const changePulseAnimation = {
  opacity: [0.6, 1, 1],
  scale: [0.94, 1.03, 1],
}

/**
 * Pulses (opacity dip + scale bounce) whenever `value` changes, matching the
 * amount-entry pulse in AmountKeypad's AmountDisplay. Skips the
 * pulse on mount so components rendered in bulk (e.g. a grid of item
 * quantities) don't all flash together on initial paint.
 */
export function useChangePulse(value: string | number) {
  const controls = useAnimationControls()
  const lastValueRef = useRef(value)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (lastValueRef.current === value) return
    lastValueRef.current = value

    if (shouldReduceMotion) return

    controls.stop()
    void controls.start({
      ...changePulseAnimation,
      transition: { duration: 0.32, ease: "easeOut", times: [0, 0.55, 1] },
    })
  }, [controls, value, shouldReduceMotion])

  return controls
}
