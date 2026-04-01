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
import { InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import {
	NonNegativeIntegerSchema,
	StringToNumberSchema,
} from "@/lib/shared/types";

export const invoiceSettingsFormSchema = z.object({
	defaultDueDateDays: StringToNumberSchema.pipe(NonNegativeIntegerSchema),
	defaultPaymentMethod: z.enum(InvoicePaymentMethod).nullable(),
});

export const createInvoiceSettingsDefaultValues = () =>
	({
		defaultDueDateDays: "14",
		defaultPaymentMethod: null,
	}) satisfies z.input<typeof invoiceSettingsFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(invoiceSettingsFormSchema, ({ builder }) => ({
		...builder.card(
			{},
			{
				...builder.magicInput("defaultDueDateDays").text({
					label: t(
						"settings:form.billing-settings-form.label.default-invoice-due-date",
					),
					description: t(
						"settings:form.billing-settings-form.description.in-days",
					),
				}),

				...builder.magicInput("defaultPaymentMethod").select({
					values: {
						[InvoicePaymentMethod.BankTransfer]: t(
							"settings:form.billing-settings-form.payment-method.bank-transfer",
						),
						[InvoicePaymentMethod.PaymentCard]: t(
							"settings:form.billing-settings-form.payment-method.payment-card",
						),
						[InvoicePaymentMethod.Cash]: t(
							"settings:form.billing-settings-form.payment-method.cash",
						),
					} satisfies Record<InvoicePaymentMethod, string>,
					allowEmpty: true,
					label: t(
						"settings:form.billing-settings-form.label.default-invoice-payment-method",
					),
				}),
			},
		),
	}));

export const InvoiceSettingsForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceSettingsFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createInvoiceSettingsDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(invoiceSettingsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"invoiceSettings",
				{
					id,
					defaultDueDateDays: values.defaultDueDateDays,
					defaultPaymentMethod: values.defaultPaymentMethod,
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
