import { createIdFromString, getOrThrow, type Id } from "@evolu/common";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";

export const invoiceNumberSeriesFormSchema = z.object({
	serialNumberDigits: StringToNumberSchema.pipe(PositiveIntegerSchema),
	yearFormat: z.enum(["default", "short"]),
	monthFormat: z.enum(["default", "hidden"]),
	dayFormat: z.enum(["default", "hidden"]),
	prefix: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
});

export const createInvoiceNumberSeriesDefaultValues = () =>
	({
		serialNumberDigits: "4",
		yearFormat: "default",
		monthFormat: "hidden",
		dayFormat: "hidden",
		prefix: "",
	}) satisfies z.input<typeof invoiceNumberSeriesFormSchema>;

const now = new Date();

const createComponents = (t: TFunction) => createAutoFormLayout(
	invoiceNumberSeriesFormSchema,
	({ builder }) => ({
		...builder.magicInput("serialNumberDigits").text({
			label: t("settings:form.invoice-number-series-form.label.number-of-digits"),
			type: "number",
			description: t(
				"settings:form.invoice-number-series-form.description.if-you-dont-issue-more-than-9999-invoices-per-time-period-number-4-will-be-optim",
			),
		}),

		...builder.magicInput("yearFormat").select({
			values: {
				default: `${t("settings:form.invoice-number-series-form.option.default")} (${now.getFullYear()})`,
				short: `${t("settings:form.invoice-number-series-form.option.short")} (${now.getFullYear().toString().substring(2)})`,
			},
			allowEmpty: false,
			label: t("settings:form.invoice-number-series-form.label.year-format"),
			variant: "toggle",
		}),

		...builder.magicInput("monthFormat").select({
			values: {
				default: `${t("settings:form.invoice-number-series-form.option.default")} (${(now.getMonth() + 1).toString().padStart(2, "0")})`,
				hidden: t("settings:form.invoice-number-series-form.option.hidden"),
			},
			allowEmpty: false,
			label: t("settings:form.invoice-number-series-form.label.month-format"),
			variant: "toggle",
		}),

		...builder.when("monthFormat", (value) => value !== "hidden", {
			...builder.magicInput("dayFormat").select({
				values: {
					default: `${t("settings:form.invoice-number-series-form.option.default")} (${now.getDate().toString().padStart(2, "0")})`,
					hidden: t("settings:form.invoice-number-series-form.option.hidden"),
				},
				allowEmpty: false,
				label: t("settings:form.invoice-number-series-form.label.day-format"),
				variant: "toggle",
			}),
		}),

		...builder.magicInput("prefix").text({
			label: t("settings:form.invoice-number-series-form.label.invoice-number-prefix"),
		}),
	}),
);

export const InvoiceNumberSeriesForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceNumberSeriesFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceNumberSeriesDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(invoiceNumberSeriesFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			getOrThrow(
				evolu.upsert(
					"invoiceNumberSeries",
					{
						...values,
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
		},
	});

	return <AutoForm form={form} components={components} />;
};
