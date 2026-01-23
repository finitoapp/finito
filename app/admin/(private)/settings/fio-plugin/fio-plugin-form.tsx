"use client";

import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import {
	HttpsUrlSchema,
	NonEmptyString255Schema,
	PositiveIntegerSchema,
	StringToNullableNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { fioPluginStorage } from "@/storages/fio-plugin-storage";

export const fioPluginSchema = z.object({
	apiUrl: StringToUndefinedStringSchema.pipe(HttpsUrlSchema),
	tokens: z
		.object({
			token: StringToUndefinedStringSchema.pipe(NonEmptyString255Schema),
		})
		.array(),
	numberOfSecondsBetweenChecks: StringToNullableNumberSchema.pipe(
		PositiveIntegerSchema,
	),
});

const tokenDefaultValues = {
	token: "",
};

const fioPluginDefaultValues = {
	apiUrl: "https://fioapi.fio.cz",
	tokens: [
		{
			token: "",
		},
	],
	numberOfSecondsBetweenChecks: "30",
} satisfies z.input<typeof fioPluginSchema>;

const components = createAutoFormLayout(fioPluginSchema, ({ builder }) => ({
	...builder.magicInput("apiUrl").text({
		label: "API URL",
	}),
	...builder.magicInput("numberOfSecondsBetweenChecks").text({
		label: "Interval between payment checks",
		description:
			"We recommend using a number calculated as '30 / number of tokens'",
		endAddon: "Seconds",
	}),
	...builder.card(
		{
			title: "Tokens",
		},
		{
			...builder.arrayTableField(
				{
					name: "tokens",
					defaultValue: tokenDefaultValues,
					columns: [
						{
							title: "Token",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("token").text({
						label: "API Token",
						type: "password",
						copyToClipboard: true,
					}),
				}),
			),
		},
	),
}));

export const FioPluginForm: React.FC<{
	defaultValues?: Partial<z.input<typeof fioPluginSchema>>;
}> = (params) => {
	const storageDeps = useStorageDeps();
	const [defaultValues] = useState(() => {
		return merge(fioPluginDefaultValues, params.defaultValues ?? {});
	});
	const form = useActionForm(fioPluginSchema, {
		defaultValues,
		saveAction: async (values) => {
			await fioPluginStorage.insertOrUpdate(storageDeps, null, values);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
