import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { DateStringSchema, NonNegativeIntegerSchema } from "@/lib/types";

export const InvoiceLastNumberSchema = z.object({
	serialNumber: NonNegativeIntegerSchema,
	date: DateStringSchema.nullable(),
});

export type InvoiceLastNumber = z.output<typeof InvoiceLastNumberSchema>;

export const invoiceLastNumberStorage = createNostrStorage({
	namespace: "finito_invoice_last_number",
	schema: InvoiceLastNumberSchema,
	useEncryption: true,
});
