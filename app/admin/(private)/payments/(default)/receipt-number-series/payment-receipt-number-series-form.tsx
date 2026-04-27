import { createIdFromString, type Id } from "@evolu/common";
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
	NonEmptyString32Schema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
} from "@/lib/shared/types";

export const paymentReceiptNumberSeriesFormSchema = z.object({
	serialNumberDigits: StringToNumberSchema.pipe(PositiveIntegerSchema),
	yearFormat: z.enum(["default", "short"]),
	monthFormat: z.enum(["default", "hidden"]),
	dayFormat: z.enum(["default", "hidden"]),
	prefix: StringToNullableStringSchema.pipe(NonEmptyString32Schema.nullable()),
});

export const createPaymentReceiptNumberSeriesDefaultValues = () =>
	({
		serialNumberDigits: "4",
		yearFormat: "default",
		monthFormat: "hidden",
		dayFormat: "hidden",
		prefix: "R",
	}) satisfies z.input<typeof paymentReceiptNumberSeriesFormSchema>;

const now = new Date();

const createComponents = (t: TFunction) =>
	createAutoFormLayout(paymentReceiptNumberSeriesFormSchema, ({ builder }) => ({
		...builder.magicInput("serialNumberDigits").text({
			label: t(
				"settings:form.receipt-number-series-form.label.number-of-digits",
			),
			type: "number",
			description: t(
				"settings:form.receipt-number-series-form.description.if-you-dont-issue-more-than-9999-receipts-per-time-period-number-4-will-be-opt",
			),
		}),

		...builder.magicInput("yearFormat").select({
			values: {
				default: `${t("settings:form.receipt-number-series-form.option.default")} (${now.getFullYear()})`,
				short: `${t("settings:form.receipt-number-series-form.option.short")} (${now.getFullYear().toString().substring(2)})`,
			},
			allowEmpty: false,
			label: t("settings:form.receipt-number-series-form.label.year-format"),
			variant: "toggle",
		}),

		...builder.magicInput("monthFormat").select({
			values: {
				default: `${t("settings:form.receipt-number-series-form.option.default")} (${(now.getMonth() + 1).toString().padStart(2, "0")})`,
				hidden: t("settings:form.receipt-number-series-form.option.hidden"),
			},
			allowEmpty: false,
			label: t("settings:form.receipt-number-series-form.label.month-format"),
			variant: "toggle",
		}),

		...builder.when("monthFormat", (value) => value !== "hidden", {
			...builder.magicInput("dayFormat").select({
				values: {
					default: `${t("settings:form.receipt-number-series-form.option.default")} (${now.getDate().toString().padStart(2, "0")})`,
					hidden: t("settings:form.receipt-number-series-form.option.hidden"),
				},
				allowEmpty: false,
				label: t("settings:form.receipt-number-series-form.label.day-format"),
				variant: "toggle",
			}),
		}),

		...builder.magicInput("prefix").text({
			label: t(
				"settings:form.receipt-number-series-form.label.receipt-number-prefix",
			),
		}),
	}));

export const PaymentReceiptNumberSeriesForm: React.FC<{
	defaultValues?: PartialDeep<
		z.input<typeof paymentReceiptNumberSeriesFormSchema>
	>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(
			createPaymentReceiptNumberSeriesDefaultValues(),
			params.defaultValues ?? {},
		),
	);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(paymentReceiptNumberSeriesFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"paymentReceiptNumberSeries",
				{
					...values,
					id,
				},
				{
					onComplete: () => {
						params.onSuccess?.(id);
					},
				},
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
