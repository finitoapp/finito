import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import {
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { invoiceNumberSeriesStorage } from "@/storages/invoice-number-series-storage";

export const invoiceNumberSeriesFormSchema = z.object({
	serialNumberDigits: StringToNumberSchema.pipe(PositiveIntegerSchema),
	yearFormat: z.enum(["default", "short"]),
	monthFormat: z.enum(["default", "hidden"]),
	dayFormat: z.enum(["default", "hidden"]),
	prefix: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
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

export const billingSettingsFormComponents = createAutoFormLayout(
	invoiceNumberSeriesFormSchema,
	({ builder }) => ({
		...builder.magicInput("serialNumberDigits").text({
			label: "Number of digits",
			type: "number",
			description:
				"If you don't issue more than 9999 invoices per time period, number 4 will be optimal for you.",
		}),

		...builder.magicInput("yearFormat").select({
			values: {
				default: `default (${now.getFullYear()})`,
				short: `short (${now.getFullYear().toString().substring(2)})`,
			},
			allowEmpty: false,
			label: "Year format",
			variant: "toggle",
		}),

		...builder.magicInput("monthFormat").select({
			values: {
				default: `default (${(now.getMonth() + 1).toString().padStart(2, "0")})`,
				hidden: "hidden",
			},
			allowEmpty: false,
			label: "Month format",
			variant: "toggle",
		}),

		...builder.when("monthFormat", (value) => value !== "hidden", {
			...builder.magicInput("dayFormat").select({
				values: {
					default: `default (${now.getDate().toString().padStart(2, "0")})`,
					hidden: "hidden",
				},
				allowEmpty: false,
				label: "Day format",
				variant: "toggle",
			}),
		}),

		...builder.magicInput("prefix").text({
			label: "Invoice number prefix",
		}),
	}),
);

export const InvoiceNumberSeriesForm: React.FC<{
	defaultValues?: Partial<
		z.input<typeof invoiceNumberSeriesFormSchema> & { id: string }
	>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceNumberSeriesDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const storageDeps = useStorageDeps();
	const form = useActionForm(invoiceNumberSeriesFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const { eventId } = await invoiceNumberSeriesStorage.insertOrUpdate(
				storageDeps,
				null,
				values,
			);

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={billingSettingsFormComponents} />;
};
