import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	DateToDateStringSchema,
	NonNegativeIntegerSchema,
	StringToNumberSchema,
} from "@/lib/types";
import { invoiceLastNumberStorage } from "@/storages/invoice-last-number-storage";

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
	defaultValues?: Partial<
		z.input<typeof invoiceLastNumberFormSchema> & { id: string }
	>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceLastNumberDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const { ndk } = useNostr();
	const form = useActionForm(invoiceLastNumberFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const { eventId } = await invoiceLastNumberStorage.insertOrUpdate(
				ndk,
				null,
				values,
			);

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={invoiceLastNumberFormComponents} />;
};
