import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { DonationsInvoiceSettingsPage } from "@/features/settings/donations/donations-invoice-settings-page.tsx"

// Falls back to "" instead of throwing, which the page already treats as
// "nothing given": a `validateSearch` throw on a stale or hand-typed link
// escapes to the global error boundary (see `_terminal.bill.tsx`).
const DonateInvoiceSearchSchema = z.object({
  invoice: z.string().trim().min(1).optional().default("").catch(""),
  verify: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || z.url().safeParse(value).success,
      "Expected a valid verify URL."
    )
    .optional()
    .default("")
    .catch(""),
})

export const Route = createFileRoute("/_terminal/settings/donations-invoice")({
  component: DonationsInvoiceRoute,
  validateSearch: (search) => DonateInvoiceSearchSchema.parse(search),
  staticData: {
    access: "free",
    menu: { tab: "settings" },
  },
})

function DonationsInvoiceRoute() {
  const { invoice, verify } = Route.useSearch()

  return <DonationsInvoiceSettingsPage invoice={invoice} verify={verify} />
}
