import { View } from "tamagui"
import { radius } from "../theme/tokens.ts"
import { Skeleton } from "./ui/skeleton.tsx"
import { VerticalNavShell, VerticalNavTitle } from "./vertical-nav.tsx"

/** Web's `placeholderFadeOpacity`: rows fade from 1 down to 0.2. */
const fadeOpacity = (index: number, count: number) =>
  count > 1 ? 1 - (index * 0.8) / (count - 1) : 1

/**
 * Web `apps/web-app/src/components/list-skeleton.tsx`: the loading
 * placeholder of a `VerticalNav`-shaped list, an icon, a two-line label and
 * an action per row, each a `Skeleton`, the rows fading out down the list.
 */
export function ListSkeleton({
  rows = 5,
  title,
}: {
  readonly rows?: number
  /** The real list's title, known before its rows are, so it doesn't pop in. */
  readonly title?: string
}) {
  return (
    <VerticalNavShell>
      {title === undefined ? null : (
        <VerticalNavTitle>{title}</VerticalNavTitle>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows, never reordered
          key={index}
          flexDirection="row"
          items="center"
          gap={12}
          minH={56}
          px={12}
          py={8}
          opacity={fadeOpacity(index, rows)}
        >
          <Skeleton w={20} h={20} rounded={radius.full} />
          <View flex={1} items="flex-start" gap={8}>
            <Skeleton w={96} h={14} />
            <Skeleton w={64} h={12} />
          </View>
          <View pl={8}>
            <Skeleton w={48} h={12} />
          </View>
        </View>
      ))}
    </VerticalNavShell>
  )
}
