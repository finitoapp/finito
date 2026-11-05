import { qerkoIconPath } from "@payky/app-shared/qerko-icon-path"
import type { LucideIcon, LucideProps } from "lucide-react"
import { forwardRef } from "react"
import { cn } from "@/lib/utils.ts"

/**
 * Qerko's "Q" as a lucide icon: the same props, size and `currentColor`, so
 * it takes the colour of the payment method icons around it, in light and
 * dark alike. It is filled where lucide's icons are stroked, since it is
 * Qerko's own mark.
 */
export const QerkoIcon: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      size = 24,
      color = "currentColor",
      className,
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      ...rest
    },
    ref
  ) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      className={cn("lucide lucide-qerko", className)}
      {...rest}
    >
      <path d={qerkoIconPath} />
    </svg>
  )
)
QerkoIcon.displayName = "QerkoIcon"
