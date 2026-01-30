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
	DateToDateStringSchema,
	NonNegativeIntegerSchema,
	StringToNumberSchema,
} from "@/lib/types";

export const invoiceLastNumberFormSchema = z.object({
	serialNumber: StringToNumberSchema.pipe(NonNegativeIntegerSchema),
	date: DateToDateStringSchema.nullable(),
});

export const createInvoiceLastNumberDefaultValues = () =>
	({
		serialNumber: "0",
		date: null,
	}) satisfies z.input<typeof invoiceLastNumberFormSchema>;

export const invoiceLastNumberFormComponents = createAutoFormLayout(
	invoiceLastNumberFormSchema,
	({ builder }) => ({
		...builder.magicInput("serialNumber").text({
			label: "Last invoice serial number",
			type: "number",
		}),

		...builder.magicInput("date").date({
			label: "Last invoice date",
		}),
	}),
);

export const InvoiceLastNumberForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceLastNumberFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceLastNumberDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const form = useActionForm(invoiceLastNumberFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			getOrThrow(
				evolu.upsert(
					"invoiceLastNumber",
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

	return <AutoForm form={form} components={invoiceLastNumberFormComponents} />;
};
