"use client";

import {
	createId,
	createIdFromString,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	HttpsUrlSchema,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

export const fioPluginSchema = z.object({
	apiUrl: StringToUndefinedStringSchema.pipe(HttpsUrlSchema),
	tokens: z
		.object({
			id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
			token: StringToUndefinedStringSchema.pipe(NonEmptyString255Schema),
		})
		.array(),
	numberOfSecondsBetweenChecks: StringToNullableNumberSchema.pipe(
		PositiveIntegerSchema,
	),
});

const tokenDefaultValues = {
	id: "",
	token: "",
};

const fioPluginDefaultValues = {
	apiUrl: "https://fioapi.fio.cz",
	tokens: [
		{
			id: "",
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
							title: "ID",
						},
						{
							title: "Token",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("id").text({
						type: "hidden",
					}),
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
	defaultValues?: PartialDeep<z.input<typeof fioPluginSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(fioPluginDefaultValues, params.defaultValues ?? {});
	});
	const form = useActionForm(fioPluginSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = createIdFromString("");

			const { tokens, ...fioPlugin } = values;

			getOrThrow(
				evolu.upsert(
					"fioPlugin",
					{
						...fioPlugin,
						id,
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

			const originalTokens = new Set(
				(params.defaultValues?.tokens ?? []).map((token) => token?.id),
			);

			for (const token of tokens) {
				if (token.id) {
					originalTokens.delete(token.id);
				}

				getOrThrow(
					evolu.upsert("fioPluginToken", {
						...token,
						id: token.id ?? createId(createIdDeps),
						fioPluginId: id,
					}),
				);
			}

			for (const id of originalTokens) {
				if (id) {
					getOrThrow(
						evolu.update("fioPluginToken", {
							id: id as Id,
							isDeleted: sqliteTrue,
						}),
					);
				}
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
