import type { FormEventHandler, ReactNode } from "react"

import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"

interface FormCardProps {
  readonly title: ReactNode
  readonly description: ReactNode
  /** Rendered inside the `aria-live` paragraph; pass `null` to hide it. */
  readonly savedMessage: ReactNode
  readonly submitLabel: ReactNode
  readonly pending: boolean
  readonly onSubmit: FormEventHandler<HTMLFormElement>
  readonly children: ReactNode
}

/**
 * Layout for a settings form card: header, content, and the footer with the
 * `aria-live` saved message and the submit button.
 */
export function FormCard({
  title,
  description,
  savedMessage,
  submitLabel,
  pending,
  onSubmit,
  children,
}: FormCardProps) {
  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {savedMessage}
          </p>
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
