import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import {
	HttpsUrlSchema,
	NonEmptyString255Schema,
	PositiveInteger,
	PositiveIntegerSchema,
} from "@/lib/types";

export const FioPluginSchema = z.object({
	apiUrl: HttpsUrlSchema,
	tokens: z
		.object({
			token: NonEmptyString255Schema,
		})
		.array(),
	numberOfSecondsBetweenChecks: PositiveIntegerSchema.default(
		PositiveInteger(30),
	),
});

export type FioPlugin = z.output<typeof FioPluginSchema>;

export const fioPluginStorage = createNostrStorage({
	namespace: "fio_plugin",
	schema: FioPluginSchema,
	useEncryption: true,
});
