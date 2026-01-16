import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { NonEmptyStringSchema, PositiveIntegerSchema } from "@/lib/types";

export const TableSchema = z.object({
	id: z.string(),
	label: NonEmptyStringSchema,
	numberOfSeats: PositiveIntegerSchema,
	qrCodes: z
		.object({
			id: NonEmptyStringSchema,
		})
		.array()
		.optional(),
});

export type Table = z.output<typeof TableSchema>;

export const tableStorage = createNostrStorage({
	namespace: "table",
	schema: TableSchema,
	useEncryption: true,
});
