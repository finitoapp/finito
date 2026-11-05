import { qerkoIconPath } from "@payky/app-shared/qerko-icon-path"
import type { LucideIcon, LucideProps } from "lucide-react-native"
import { forwardRef } from "react"
import Svg, { Path } from "react-native-svg"

/**
 * Qerko's "Q" as a lucide icon, as web's `QerkoIcon`: the same props and
 * size, filled with the colour the kit's `Icon` passes, so it follows the
 * theme like the payment method icons around it. Built on `react-native-svg`
 * directly, since `createLucideIcon` lives only at the package root, which
 * pulls in every icon.
 */
export const QerkoIcon: LucideIcon = forwardRef<Svg, LucideProps>(
  (
    {
      size = 24,
      color = "currentColor",
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      ...rest
    },
    ref
  ) => (
    <Svg ref={ref} width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <Path d={qerkoIconPath} fill={color} />
    </Svg>
  )
)
QerkoIcon.displayName = "QerkoIcon"
