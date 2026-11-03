import type { LucideIcon } from "lucide-react-native"
import { useTheme } from "tamagui"
import type { ThemeColor } from "../../theme/themes.ts"

export interface IconProps {
  readonly icon: LucideIcon
  /** 20 by default, Linky's `md` icon (`sm` 16, `lg` 24, `xl` 40). */
  readonly size?: number
  /** Web's `currentColor`: pass the theme key of the surrounding text. */
  readonly color?: ThemeColor
  readonly strokeWidth?: number
}

/**
 * A lucide icon colored from the theme. Web uses `lucide-react` at the same
 * version, so an icon has the same name on both.
 *
 * Import each icon from its own module,
 * `import ArrowLeft from "lucide-react-native/icons/arrow-left"`, never from
 * the package root: Metro does not tree-shake, and the root pulls in all
 * ~1,900 icons (+2 MB of bytecode). Type-only imports of the root are fine.
 */
export function Icon({
  icon: LucideComponent,
  size = 20,
  color = "color",
  strokeWidth = 2,
}: IconProps) {
  const theme = useTheme()
  return (
    <LucideComponent
      size={size}
      color={theme[color]?.val}
      strokeWidth={strokeWidth}
    />
  )
}
