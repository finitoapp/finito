import { type GetProps, styled } from "tamagui"
import { Separator as TamaguiSeparator } from "tamagui/unstyled"

/**
 * Web `apps/web-app/src/components/ui/separator.tsx`: `shrink-0 bg-border`,
 * `h-px w-full` or (`vertical`) `w-px self-stretch`.
 *
 * Base: Tamagui `Separator`, a 1 px border rule (its `vertical` variant for
 * web's `orientation="vertical"`), held to its line: Tamagui's is `flex: 1`,
 * which would grow it along a column.
 */
const SeparatorFrame = styled(TamaguiSeparator, {
  name: "Separator",
  grow: 0,
  self: "stretch",
  borderColor: "border-color",
})

export function Separator({
  orientation = "horizontal",
  ...props
}: Omit<GetProps<typeof SeparatorFrame>, "vertical"> & {
  readonly orientation?: "horizontal" | "vertical"
}) {
  return <SeparatorFrame vertical={orientation === "vertical"} {...props} />
}
