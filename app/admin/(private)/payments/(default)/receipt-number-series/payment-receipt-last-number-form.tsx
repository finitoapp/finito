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

export const paymentReceiptLastNumberFormSchema = z.object({
	serialNumber: StringToNumberSchema.pipe(NonNegativeIntegerSchema),
	date: DateToDateStringSchema.nullable(),
});

export const createPaymentReceiptLastNumberDefaultValues = () =>
	({
		serialNumber: "0",
		date: null,
	}) satisfies z.input<typeof paymentReceiptLastNumberFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(paymentReceiptLastNumberFormSchema, ({ builder }) => ({
		...builder.magicInput("serialNumber").text({
			label: t(
				"settings:form.receipt-last-number-form.label.last-receipt-serial-number",
			),
			type: "number",
		}),

		...builder.magicInput("date").date({
			label: t(
				"settings:form.receipt-last-number-form.label.last-receipt-date",
			),
		}),
	}));

export const PaymentReceiptLastNumberForm: React.FC<{
	defaultValues?: PartialDeep<
		z.input<typeof paymentReceiptLastNumberFormSchema>
	>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(
			createPaymentReceiptLastNumberDefaultValues(),
			params.defaultValues ?? {},
		),
	);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(paymentReceiptLastNumberFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"paymentReceiptLastNumber",
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
