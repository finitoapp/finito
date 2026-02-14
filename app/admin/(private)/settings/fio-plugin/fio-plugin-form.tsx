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
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const createComponents = (t: TFunction) =>
	createAutoFormLayout(fioPluginSchema, ({ builder }) => ({
		...builder.magicInput("apiUrl").text({
			label: t("settings:form.fio-plugin-form.label.api-url"),
		}),
		...builder.magicInput("numberOfSecondsBetweenChecks").text({
			label: t(
				"settings:form.fio-plugin-form.label.interval-between-payment-checks",
			),
			description: t(
				"settings:form.fio-plugin-form.description.we-recommend-using-a-number-calculated-as-30-number-of-tokens",
			),
			endAddon: t("settings:form.fio-plugin-form.end-addon.seconds"),
		}),
		...builder.card(
			{
				title: t("settings:form.fio-plugin-form.title.tokens"),
			},
			{
				...builder.arrayTableField(
					{
						name: "tokens",
						defaultValue: tokenDefaultValues,
						columns: [
							{
								title: t("settings:form.fio-plugin-form.title.id"),
								hidden: true,
							},
							{
								title: t("settings:form.fio-plugin-form.title.token"),
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("id").text({
							type: "hidden",
						}),
						...builder.magicInput("token").text({
							label: t("settings:form.fio-plugin-form.label.api-token"),
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
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(fioPluginDefaultValues, params.defaultValues ?? {});
	});
	const components = useMemo(() => createComponents(t), [t]);
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
