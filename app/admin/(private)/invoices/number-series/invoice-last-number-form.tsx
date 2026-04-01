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
	DateToDateStringSchema,
	NonNegativeIntegerSchema,
	StringToNumberSchema,
} from "@/lib/shared/types";

export const invoiceLastNumberFormSchema = z.object({
	serialNumber: StringToNumberSchema.pipe(NonNegativeIntegerSchema),
	date: DateToDateStringSchema.nullable(),
});

export const createInvoiceLastNumberDefaultValues = () =>
	({
		serialNumber: "0",
		date: null,
	}) satisfies z.input<typeof invoiceLastNumberFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(invoiceLastNumberFormSchema, ({ builder }) => ({
		...builder.magicInput("serialNumber").text({
			label: t(
				"settings:form.invoice-last-number-form.label.last-invoice-serial-number",
			),
			type: "number",
		}),

		...builder.magicInput("date").date({
			label: t(
				"settings:form.invoice-last-number-form.label.last-invoice-date",
			),
		}),
	}));

export const InvoiceLastNumberForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceLastNumberFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceLastNumberDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(invoiceLastNumberFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

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
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
