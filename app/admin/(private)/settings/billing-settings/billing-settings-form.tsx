import {
	createId,
	createIdFromString,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxInput } from "@/components/combobox-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { formatIban } from "@/lib/format-utils";
import {
	FiatCurrency,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PercentSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
	Timezone,
} from "@/lib/types";
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
			id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
			name: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
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
	defaultBankTransferCzKey: NonEmptyStringSchema.nullable(),
	defaultLnZapKey: NonEmptyStringSchema.nullable(),
	defaultLnSparkKey: NonEmptyStringSchema.nullable(),
});

export const createBillingSettingsDefaultValues = () =>
	({
		defaultInvoiceDueDateDays: "14",
		defaultCurrency: FiatCurrency.USD,
		defaultTimezone: Timezone["Europe/Prague"],
		taxRates: [
			{
				id: "",
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
								const evolu = useEvolu();
								const ComboboxInput = useMemo(
									() =>
										createComboboxInput({
											label: "Default bank account",
											fetchItems: async () => {
												const query = evolu.createQuery((db) =>
													db
														.selectFrom("account")
														.leftJoin(
															"accountIban",
															"accountIban.id",
															"account.id",
														)
														.select([
															"account.id",
															"account.name",
															"accountIban.iban",
														])
														.where("_tag", "=", "accountIban")
														.where("account.isDeleted", "is not", sqliteTrue),
												);
												const items = await evolu.loadQuery(query);

												return items.map((item) => {
													return {
														label: `${formatIban(item.iban)} (${item.name})`,
														value: item.id ?? "-",
													};
												});
											},
										}),
									[evolu],
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
					const evolu = useEvolu();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default bank account",
								fetchItems: async () => {
									const query = evolu.createQuery((db) =>
										db
											.selectFrom("account")
											.leftJoin("accountIban", "accountIban.id", "account.id")
											.select([
												"account.id",
												"account.name",
												"accountIban.iban",
											])
											.where("_tag", "=", "accountIban")
											.where("account.isDeleted", "is not", sqliteTrue),
									);
									const items = await evolu.loadQuery(query);

									return items.map((item) => {
										return {
											label: `${formatIban(item.iban)} (${item.name})`,
											value: item.id ?? "-",
										};
									});
								},
							}),
						[evolu],
					);

					return <ComboboxInput {...props} />;
				}),

				...builder.createComponent("defaultLnZapKey", (props) => {
					const evolu = useEvolu();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default LN Zap wallet",
								fetchItems: async () => {
									const query = evolu.createQuery((db) =>
										db
											.selectFrom("account")
											.selectAll()
											.where("_tag", "=", "lud16")
											.where("isDeleted", "is not", sqliteTrue),
									);
									const items = await evolu.loadQuery(query);

									return items.map((item) => ({
										label: item.name,
										value: item.id ?? "-",
									}));
								},
							}),
						[evolu],
					);

					return <ComboboxInput {...props} />;
				}),

				...builder.createComponent("defaultLnSparkKey", (props) => {
					const evolu = useEvolu();
					const ComboboxInput = useMemo(
						() =>
							createComboboxInput({
								label: "Default LN Spark wallet",
								fetchItems: async () => {
									const query = evolu.createQuery((db) =>
										db
											.selectFrom("account")
											.selectAll()
											.where("_tag", "=", "accountSpark")
											.where("isDeleted", "is not", sqliteTrue),
									);
									const items = await evolu.loadQuery(query);

									return items.map((item) => ({
										label: item.name,
										value: item.id ?? "-",
									}));
								},
							}),
						[evolu],
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
							id: "",
							name: "",
							rate: "",
						},
						columns: [
							{
								title: "ID",
								hidden: true,
							},
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
						...builder.magicInput("id").text({ type: "hidden" }),
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
		z.input<typeof billingSettingsFormSchema> & {
			id: Id;
			taxRates?: Array<{ id: Id; name: string; rate: string }>;
		}
	>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createBillingSettingsDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const form = useActionForm(billingSettingsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = params.defaultValues?.id ?? createIdFromString("");

			getOrThrow(
				evolu.upsert(
					"billingSettings",
					{
						id,
						defaultInvoiceDueDateDays: values.defaultInvoiceDueDateDays,
						defaultCurrency: values.defaultCurrency,
						defaultTimezone: values.defaultTimezone,
						defaultPaymentMethodMethod: values.defaultPayment.method,
						defaultPaymentMethodBankAccountKey: values.defaultPayment
							.bankAccountKey as Id,
						defaultPaymentMethod: values.defaultPaymentMethod,
						defaultBankTransferCzKey: values.defaultBankTransferCzKey as Id,
						defaultLnZapKey: values.defaultLnZapKey as Id,
						defaultLnSparkKey: values.defaultLnSparkKey as Id,
						invoiceEmailSettingsEnable: values.invoiceEmailSettings.enable
							? sqliteTrue
							: sqliteFalse,
						invoiceEmailSettingsSubject: values.invoiceEmailSettings.enable
							? values.invoiceEmailSettings.subject
							: null,
						invoiceEmailSettingsBody: values.invoiceEmailSettings.enable
							? values.invoiceEmailSettings.body
							: null,
					},
					{
						onComplete: () => {
							if (params.onSuccess) {
								params.onSuccess(id as Id);
							}
						},
					},
				),
			);

			const originalTaxRates = new Set(
				(params.defaultValues?.taxRates ?? []).map((taxRate) => taxRate?.id),
			);

			for (const taxRate of values.taxRates) {
				const taxRateId = (taxRate as any).id as Id | undefined;
				if (taxRateId) {
					originalTaxRates.delete(taxRateId);
				}

				getOrThrow(
					evolu.upsert("billingSettingsTaxRate", {
						id: taxRateId ?? createId(createIdDeps),
						billingSettingsId: id,
						name: taxRate.name,
						rate: taxRate.rate,
					}),
				);
			}

			for (const taxRateId of originalTaxRates) {
				if (taxRateId) {
					getOrThrow(
						evolu.update("billingSettingsTaxRate", {
							id: taxRateId,
							isDeleted: sqliteTrue,
						}),
					);
				}
			}
		},
	});

	console.log("err", form.form.formState.errors);

	return <AutoForm form={form} components={billingSettingsFormComponents} />;
};
