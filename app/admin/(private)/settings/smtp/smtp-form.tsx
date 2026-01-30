"use client";

import { createIdFromString, getOrThrow, type Id } from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	EmailSchema,
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

export const smtpSchema = z.object({
	server: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
	port: StringToNullableNumberSchema.pipe(PositiveIntegerSchema),
	credentials: z.object({
		username: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
		password: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
	}),
	name: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	email: StringToUndefinedStringSchema.pipe(EmailSchema),
});

const smtpDefaultValues = {
	server: "",
	port: "587",
	credentials: {
		username: "",
		password: "",
	},
	name: "",
	email: "",
} satisfies z.input<typeof smtpSchema>;

const components = createAutoFormLayout(smtpSchema, ({ builder }) => ({
	...builder.magicInput("server").text({
		label: "Server",
	}),
	...builder.magicInput("port").text({
		label: "Port",
		type: "number",
	}),
	...builder.nestedField("credentials", ({ builder }) => ({
		...builder.magicInput("username").text({
			label: "Username",
		}),
		...builder.magicInput("password").text({
			label: "Password",
			type: "password",
			copyToClipboard: true,
		}),
	})),
	...builder.magicInput("email").text({
		label: "Your E-mail",
	}),
	...builder.magicInput("name").text({
		label: "Your email name",
	}),
}));

export const SmtpForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof smtpSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(smtpDefaultValues, params.defaultValues ?? {});
	});
	const form = useActionForm(smtpSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			getOrThrow(
				evolu.upsert(
					"smtp",
					{
						id,
						server: values.server,
						port: values.port,
						username: values.credentials.username,
						password: values.credentials.password,
						name: values.name,
						email: values.email,
					},
					{
						onComplete: () => {
							if (params.onSuccess) {
								params.onSuccess(id);
							}
						},
					},
				),
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
