import { CheckIcon } from "lucide-react"
import type { ReactNode } from "react"
import { ToggleGroupItem } from "@/components/ui/toggle-group.tsx"

export function ChoiceToggleItem({
  value,
  children,
}: {
  readonly value: string
  readonly children: ReactNode
}) {
  return (
    <ToggleGroupItem
      value={value}
      className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal aria-pressed:border-primary"
    >
      <CheckIcon
        aria-hidden
        className="invisible text-primary group-aria-pressed/toggle:visible"
      />
      {children}
    </ToggleGroupItem>
  )
}
