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
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createEvoluComboboxInput } from "@/components/combobox-input";
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

const createComponents = (t: TFunction) => {
	const DefaultBankAccountComboboxInput = createEvoluComboboxInput({
		label: t("settings:form.billing-settings-form.label.default-bank-account"),
		createQuery: (evolu) =>
			evolu.createQuery((db) =>
				db
					.selectFrom("account")
					.leftJoin("accountIban", "accountIban.id", "account.id")
					.select(["account.id", "account.name", "accountIban.iban"])
					.where("_tag", "=", "accountIban")
					.where("account.isDeleted", "is not", sqliteTrue),
			),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: `${formatIban(row.iban ?? "")} (${row.name ?? "-"})`,
				value: row.id ?? "-",
			})),
	});

	const DefaultLnZapComboboxInput = createEvoluComboboxInput({
		label: t("settings:form.billing-settings-form.label.default-ln-zap-wallet"),
		createQuery: (evolu) =>
			evolu.createQuery((db) =>
				db
					.selectFrom("account")
					.selectAll()
					.where("_tag", "=", "lud16")
					.where("isDeleted", "is not", sqliteTrue),
			),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: row.name ?? "-",
				value: row.id ?? "-",
			})),
	});

	const DefaultLnSparkComboboxInput = createEvoluComboboxInput({
		label: t(
			"settings:form.billing-settings-form.label.default-ln-spark-wallet",
		),
		createQuery: (evolu) =>
			evolu.createQuery((db) =>
				db
					.selectFrom("account")
					.selectAll()
					.where("_tag", "=", "accountSpark")
					.where("isDeleted", "is not", sqliteTrue),
			),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: row.name ?? "-",
				value: row.id ?? "-",
			})),
	});

	return createAutoFormLayout(billingSettingsFormSchema, ({ builder }) => ({
		...builder.card(
			{
				title: t(
					"settings:form.billing-settings-form.title.invoice-default-settings",
				),
			},
			{
				...builder.magicInput("defaultInvoiceDueDateDays").text({
					label: t(
						"settings:form.billing-settings-form.label.default-invoice-due-date",
					),
					description: t(
						"settings:form.billing-settings-form.description.in-days",
					),
				}),

				...builder.magicInput("defaultCurrency").select({
					values: FiatCurrency,
					allowEmpty: false,
					label: t(
						"settings:form.billing-settings-form.label.default-currency",
					),
				}),

				...builder.magicInput("defaultTimezone").select({
					values: Timezone,
					allowEmpty: false,
					label: t("settings:form.billing-settings-form.label.timezone"),
				}),

				...builder.nestedField("defaultPayment", ({ builder }) => ({
					...builder.magicInput("method").select({
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
							...builder.createComponent("bankAccountKey", (props) => (
								<DefaultBankAccountComboboxInput {...props} />
							)),
						},
					),
				})),
			},
		),

		...builder.card(
			{
				title: t(
					"settings:form.billing-settings-form.title.payment-default-settings",
				),
			},
			{
				...builder.magicInput("defaultPaymentMethod").select({
					values: {
						[PaymentMethod.Cash]: t(
							"settings:form.billing-settings-form.default-payment-method.cash",
						),
						[PaymentMethod.LnZap]: t(
							"settings:form.billing-settings-form.default-payment-method.ln-zap",
						),
						[PaymentMethod.LnSpark]: t(
							"settings:form.billing-settings-form.default-payment-method.ln-spark",
						),
						[PaymentMethod.BankTransferCZ]: t(
							"settings:form.billing-settings-form.default-payment-method.bank-transfer-cz",
						),
					} satisfies Record<PaymentMethod, string>,
					allowEmpty: false,
					label: t(
						"settings:form.billing-settings-form.label.default-payment-method",
					),
				}),

				...builder.createComponent("defaultBankTransferCzKey", (props) => (
					<DefaultBankAccountComboboxInput {...props} />
				)),

				...builder.createComponent("defaultLnZapKey", (props) => (
					<DefaultLnZapComboboxInput {...props} />
				)),

				...builder.createComponent("defaultLnSparkKey", (props) => (
					<DefaultLnSparkComboboxInput {...props} />
				)),
			},
		),

		...builder.card(
			{
				title: t("settings:form.billing-settings-form.title.invoice-email"),
			},
			{
				...builder.nestedField("invoiceEmailSettings", ({ builder }) => ({
					...builder.magicInput("enable").checkbox({
						label: t(
							"settings:form.billing-settings-form.label.enable-invoice-emails",
						),
					}),
					...builder.when("invoiceEmailSettings.enable", true, {
						...builder.magicInput("subject").text({
							label: t(
								"settings:form.billing-settings-form.label.email-subject",
							),
						}),
						...builder.magicInput("body").textarea({
							label: t("settings:form.billing-settings-form.label.email-body"),
							rows: 8,
						}),
					}),
				})),
			},
		),

		...builder.card(
			{
				title: t("settings:form.billing-settings-form.title.tax-rates"),
			},
			{
				...builder.arrayTableField(
					{
						name: "taxRates",
						addRowLabel: t(
							"settings:form.billing-settings-form.addRowLabel.add-rate",
						),
						defaultValue: {
							id: "",
							name: "",
							rate: "",
						},
						columns: [
							{
								title: t("settings:form.billing-settings-form.title.id"),
								hidden: true,
							},
							{
								title: t("settings:form.billing-settings-form.title.name"),
							},
							{
								title: t("settings:form.billing-settings-form.title.rate"),
								className: "w-[130px]",
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("id").text({ type: "hidden" }),
						...builder.magicInput("name").text({}),
						...builder.magicInput("rate").text({
							placeholder: t(
								"settings:form.billing-settings-form.placeholder.0",
							),
							type: "number",
							endAddon: "%",
						}),
					}),
				),
			},
		),
	}));
};

export const BillingSettingsForm: React.FC<{
	defaultValues?: PartialDeep<
		z.input<typeof billingSettingsFormSchema> & {
			id: Id;
			taxRates?: Array<{ id: Id; name: string; rate: string }>;
		}
	>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(
			createBillingSettingsDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
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
				const taxRateId = (taxRate as { id?: Id }).id;
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

	return <AutoForm form={form} components={components} />;
};
