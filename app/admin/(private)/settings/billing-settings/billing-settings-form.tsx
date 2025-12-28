import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxInput } from "@/components/combobox-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import { formatIban } from "@/lib/format-utils";
import {
	FiatCurrency,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PercentSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
	Timezone,
} from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";
import { billingSettingsStorage } from "@/storages/billing-settings-storage";
import { InvoicePaymentMethod } from "@/storages/invoice-storage";
import { PaymentMethod } from "@/storages/payment-storage";

export const billingSettingsFormSchema = z.object({
	defaultInvoiceDueDateDays: StringToNumberSchema.pipe(
		NonNegativeIntegerSchema,
	),
	defaultCurrency: z.enum(FiatCurrency),
	defaultTimezone: z.enum(Timezone),
	taxRates: z
		.object({
			name: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
			rate: StringToNumberSchema.pipe(PercentSchema),
		})
		.array(),
	defaultPayment: z.discriminatedUnion("method", [
		z.object({
			method: z.null(),
			bankAccountKey: z
				.string()
				.nullable()
				.pipe(NonEmptyStringSchema.nullable()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			bankAccountKey: z.string().nullable().pipe(NonEmptyStringSchema),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
			bankAccountKey: z
				.string()
				.nullable()
				.pipe(NonEmptyStringSchema.nullable()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			bankAccountKey: z.string().nullable().pipe(NonEmptyStringSchema),
		}),
	]),
	invoiceEmailSettings: z.discriminatedUnion("enable", [
		z.object({
			enable: z.literal(false),
			subject: z.string(),
			body: z.string(),
		}),
		z.object({
			enable: z.literal(true),
			subject: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
			body: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
		}),
	]),
	defaultPaymentMethod: z.enum(PaymentMethod),
	defaultBankTransferCzKey: z
		.string()
		.nullable()
		.transform((value) => value ?? undefined)
		.pipe(NonEmptyStringSchema.optional()),
	defaultLnZapKey: z
		.string()
		.nullable()
		.transform((value) => value ?? undefined)
		.pipe(NonEmptyStringSchema.optional()),
	defaultLnSparkKey: z
		.string()
		.nullable()
		.transform((value) => value ?? undefined)
		.pipe(NonEmptyStringSchema.optional()),
});

export const createBillingSettingsDefaultValues = () =>
	({
		defaultInvoiceDueDateDays: "14",
		defaultCurrency: FiatCurrency.USD,
		defaultTimezone: Timezone["Europe/Prague"],
		taxRates: [
			{
				name: "",
				rate: "21",
			},
		],
		defaultPayment: {
			method: null,
			bankAccountKey: null,
		},
		invoiceEmailSettings: {
			enable: false,
			subject: "",
			body: "",
		},
		defaultPaymentMethod: PaymentMethod.Cash,
		defaultBankTransferCzKey: null,
		defaultLnZapKey: null,
		defaultLnSparkKey: null,
	}) satisfies z.input<typeof billingSettingsFormSchema>;

export const billingSettingsFormComponents = createAutoFormLayout(
	billingSettingsFormSchema,
	({ builder }) => ({
		...builder.card(
			{
				title: "Invoice default settings",
			},
			{
				...builder.magicInput("defaultInvoiceDueDateDays").text({
					label: "Default invoice due date",
					description: "In days",
				}),

				...builder.magicInput("defaultCurrency").select({
					values: FiatCurrency,
					allowEmpty: false,
					label: "Default currency",
				}),

				...builder.magicInput("defaultTimezone").select({
					values: Timezone,
					allowEmpty: false,
					label: "Timezone",
				}),

				...builder.nestedField("defaultPayment", ({ builder }) => ({
					...builder.magicInput("method").select({
						values: {
							[InvoicePaymentMethod.BankTransfer]: "Bank transfer",
							[InvoicePaymentMethod.PaymentCard]: "Payment card",
							[InvoicePaymentMethod.Cash]: "Cash",
						} satisfies Record<InvoicePaymentMethod, string>,
						allowEmpty: true,
						label: "Default invoice payment method",
					}),

					...builder.when(
						"defaultPayment.method",
						(value) =>
							value !== null &&
							(
								[
									InvoicePaymentMethod.BankTransfer,
									InvoicePaymentMethod.PaymentCard,
								] as string[]
							).includes(value),
						{
							...builder.createComponent("bankAccountKey", (props) => {
								const { ndk } = useNostr();
								const ComboboxInput = useMemo(
									() =>
										createComboboxInput({
											label: "Default bank account",
											fetchItems: async () => {
												const items = await accountStorage.select(ndk);

												return items.data
													.filter((item) => item.value._tag === "iban")
													.map((item) => ({
														label:
															item.value._tag === "iban"
																? `${formatIban(item.value.iban)} (${item.value.name})`
																: "-",
														value: item.key ?? "-",
													}));
											},
										}),
									[ndk],
								);

								return <ComboboxInput {...props} />;
							}),
						},
					),
				})),
			},
		),

		...builder.card(
			{
				title: "Payment default settings",
			},
			{
				...builder.magicInput("defaultPaymentMethod").select({
					values: {
						[PaymentMethod.Cash]: "Cash",
						[PaymentMethod.LnZap]: "LN Zap",
						[PaymentMethod.LnSpark]: "LN Spark",
						[PaymentMethod.BankTransferCZ]: "Bank transfer (CZ)",
					} satisfies Record<PaymentMethod, string>,
					allowEmpty: false,
					label: "Default payment method",
				}),

				...builder.createComponent("defaultBankTransferCzKey", (props) => {
					const { ndk } = useNostr();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default bank account",
								fetchItems: async () => {
									const items = await accountStorage.select(ndk);

									return items.data
										.filter((item) => item.value._tag === "iban")
										.map((item) => ({
											label:
												item.value._tag === "iban"
													? `${formatIban(item.value.iban)} (${item.value.name})`
													: "-",
											value: item.key ?? "-",
										}));
								},
							}),
						[ndk],
					);

					return <ComboboxInput {...props} />;
				}),

				...builder.createComponent("defaultLnZapKey", (props) => {
					const { ndk } = useNostr();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default LN Zap wallet",
								fetchItems: async () => {
									const items = await accountStorage.select(ndk);

									return items.data
										.filter((item) => item.value._tag === "lud16")
										.map((item) => ({
											label:
												item.value._tag === "lud16" ? item.value.name : "-",
											value: item.key ?? "-",
										}));
								},
							}),
						[ndk],
					);

					return <ComboboxInput {...props} />;
				}),

				...builder.createComponent("defaultLnSparkKey", (props) => {
					const { ndk } = useNostr();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default LN Spark wallet",
								fetchItems: async () => {
									const items = await accountStorage.select(ndk);

									return items.data
										.filter((item) => item.value._tag === "spark")
										.map((item) => ({
											label:
												item.value._tag === "spark" ? item.value.name : "-",
											value: item.key ?? "-",
										}));
								},
							}),
						[ndk],
					);

					return <ComboboxInput {...props} />;
				}),
			},
		),

		...builder.card(
			{
				title: "Invoice email",
			},
			{
				...builder.nestedField("invoiceEmailSettings", ({ builder }) => ({
					...builder.magicInput("enable").checkbox({
						label: "Enable invoice emails",
					}),
					...builder.when("invoiceEmailSettings.enable", true, {
						...builder.magicInput("subject").text({
							label: "Email subject",
						}),
						...builder.magicInput("body").textarea({
							label: "Email body",
							rows: 8,
						}),
					}),
				})),
			},
		),

		...builder.card(
			{
				title: "Tax rates",
			},
			{
				...builder.arrayTableField(
					{
						name: "taxRates",
						addRowLabel: "Add rate",
						defaultValue: {
							name: "",
							rate: "",
						},
						columns: [
							{
								title: "Name",
							},
							{
								title: "Rate",
								className: "w-[130px]",
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("name").text({}),
						...builder.magicInput("rate").text({
							placeholder: "0",
							type: "number",
							endAddon: "%",
						}),
					}),
				),
			},
		),
	}),
);

export const BillingSettingsForm: React.FC<{
	defaultValues?: PartialDeep<
		z.input<typeof billingSettingsFormSchema> & { id: string }
	>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(
			createBillingSettingsDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const { ndk } = useNostr();
	const form = useActionForm(billingSettingsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const { eventId } = await billingSettingsStorage.insertOrUpdate(
				ndk,
				null,
				{
					...values,
					invoiceEmailSettings: values.invoiceEmailSettings.enable
						? {
								subject: values.invoiceEmailSettings.subject,
								body: values.invoiceEmailSettings.body,
							}
						: undefined,
				},
			);

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	console.log("err", form.form.formState.errors);

	return <AutoForm form={form} components={billingSettingsFormComponents} />;
};
