import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { type InferEnumType, Uuid7Schema } from "@/lib/types";

export const InvoiceStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
} as const;
export type InvoiceStatus = InferEnumType<typeof InvoiceStatus>;

export const InvoiceStatusSchema = z.object({
	invoiceId: Uuid7Schema, // Uuid is required by isdoc spec. (http://www.isdoc.cz/)
	status: z.enum(InvoiceStatus),
});

export const invoiceStatusStorage = createNostrStorage({
	namespace: "finito_invoice_status",
	schema: InvoiceStatusSchema,
	useEncryption: true,
});
