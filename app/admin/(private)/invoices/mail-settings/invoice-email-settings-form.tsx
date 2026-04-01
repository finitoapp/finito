import {
	createIdFromString,
	type Id,
	sqliteFalse,
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
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const invoiceEmailSettingsFormSchema = z.object({
	invoiceEmailSettings: z.discriminatedUnion("enable", [
		z.object({
			enable: z.literal(false),
			subject: z.string(),
			body: z.string(),
		}),
		z.object({
			enable: z.literal(true),
			subject: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
			body: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		}),
	]),
});

export const createInvoiceEmailSettingsDefaultValues = () =>
	({
		invoiceEmailSettings: {
			enable: false,
			subject: "",
			body: "",
		},
	}) satisfies z.input<typeof invoiceEmailSettingsFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(invoiceEmailSettingsFormSchema, ({ builder }) => ({
		...builder.card(
			{},
			{
				...builder.nestedField("invoiceEmailSettings", ({ builder }) => ({
					...builder.magicInput("enable").checkbox({
						label: t(
							"settings:form.billing-settings-form.label.enable-invoice-emails",
						),
					}),
					...builder.when("invoiceEmailSettings.enable", true, {
						...builder.magicInput("subject").text({
							label: t(
								"settings:form.billing-settings-form.label.email-subject",
							),
						}),
						...builder.magicInput("body").textarea({
							label: t("settings:form.billing-settings-form.label.email-body"),
							rows: 8,
						}),
					}),
				})),
			},
		),
	}));

export const InvoiceEmailSettingsForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceEmailSettingsFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceEmailSettingsDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(invoiceEmailSettingsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"invoiceEmailSettings",
				{
					id,
					enable: values.invoiceEmailSettings.enable ? sqliteTrue : sqliteFalse,
					subject: values.invoiceEmailSettings.enable
						? values.invoiceEmailSettings.subject
						: null,
					body: values.invoiceEmailSettings.enable
						? values.invoiceEmailSettings.body
						: null,
				},
				{
					onComplete: () => {
						if (params.onSuccess) {
							params.onSuccess(id);
						}
					},
				},
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
