import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { NonEmptyStringSchema, PositiveIntegerSchema } from "@/lib/types";

const RawSchema = z.object({
	serialNumberDigits: PositiveIntegerSchema,
	yearFormat: z.enum(["default", "short"]),
	prefix: NonEmptyStringSchema.optional(),
});

export const InvoiceNumberSeriesSchema = z.discriminatedUnion("monthFormat", [
	RawSchema.extend({
		monthFormat: z.literal("default"),
		dayFormat: z.enum(["default", "hidden"]),
	}),
	RawSchema.extend({
		monthFormat: z.literal("hidden"),
	}),
]);

export type InvoiceNumberSeries = z.output<typeof InvoiceNumberSeriesSchema>;

export const invoiceNumberSeriesStorage = createNostrStorage({
	namespace: "finito_invoice_number_series",
	schema: InvoiceNumberSeriesSchema,
	useEncryption: true,
});
