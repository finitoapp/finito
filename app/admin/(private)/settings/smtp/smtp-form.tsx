"use client";

import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	EmailSchema,
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { smtpStorage } from "@/storages/smtp-storage";

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
	defaultValues?: Partial<z.input<typeof smtpSchema>>;
}> = (params) => {
	const { ndk } = useNostr();
	const [defaultValues] = useState(() => {
		return merge(smtpDefaultValues, params.defaultValues ?? {});
	});
	const form = useActionForm(smtpSchema, {
		defaultValues,
		saveAction: async (values) => {
			await smtpStorage.insertOrUpdate({ ndk }, null, values);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
