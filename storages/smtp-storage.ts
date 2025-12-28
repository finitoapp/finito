import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { EmailSchema, NonEmptyStringSchema } from "@/lib/types";

export const SmtpSchema = z.object({
	server: NonEmptyStringSchema,
	port: z.number(),
	credentials: z.object({
		username: NonEmptyStringSchema,
		password: NonEmptyStringSchema,
	}),
	name: NonEmptyStringSchema.optional(),
	email: EmailSchema,
});

export type Smtp = z.output<typeof SmtpSchema>;

export const smtpStorage = createNostrStorage({
	namespace: "finito_smtp",
	schema: SmtpSchema,
	useEncryption: true,
});
