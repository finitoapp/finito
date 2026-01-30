import type { InferEnumType } from "@/lib/types";

export const InvoiceStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
} as const;
export type InvoiceStatus = InferEnumType<typeof InvoiceStatus>;
