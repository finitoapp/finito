import {
	createId,
	createIdFromString,
	createRandomBytes,
	type Id,
	type KyselyNotNull,
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
import { createQuery } from "@/lib/evolu";
import { InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import { PaymentMethod } from "@/lib/evolu/model/payment";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	FiatCurrency,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	NonNegativeIntegerSchema,
	PercentSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	Timezone,
} from "@/lib/shared/types";
import { formatIban } from "@/lib/shared/utils/format";

export const billingSettingsFormSchema = z.object({
	ownContactId: TableIdSchema.nullable(),
	defaultInvoiceDueDateDays: StringToNumberSchema.pipe(
		NonNegativeIntegerSchema,
	),
	defaultCurrency: z.enum(FiatCurrency),
	defaultTimezone: z.enum(Timezone),
	taxRates: z
		.object({
			id: TableIdSchema,
			name: StringToNullableStringSchema.pipe(
				NonEmptyString255Schema.nullable(),
			),
			rate: StringToNumberSchema.pipe(PercentSchema),
		})
		.array(),
	defaultPayment: z.discriminatedUnion("method", [
		z.object({
			method: z.null(),
			bankAccountKey: z.string().nullable().pipe(TableIdSchema.nullable()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			bankAccountKey: z.string().nullable().pipe(TableIdSchema),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
			bankAccountKey: z.string().nullable().pipe(TableIdSchema.nullable()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			bankAccountKey: z.string().nullable().pipe(TableIdSchema),
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
			subject: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
			body: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		}),
	]),
	defaultPaymentMethod: z.enum(PaymentMethod),
	defaultBankTransferCzKey: TableIdSchema.nullable(),
	defaultLnZapKey: TableIdSchema.nullable(),
	defaultLnSparkKey: TableIdSchema.nullable(),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createTaxRate = () => ({
	id: createId(createIdDeps),
	name: "",
	rate: "21",
});

export const createBillingSettingsDefaultValues = () =>
	({
		ownContactId: null,
		defaultInvoiceDueDateDays: "14",
		defaultCurrency: FiatCurrency.USD,
		defaultTimezone: Timezone["Europe/Prague"],
		taxRates: [createTaxRate()],
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
	const OwnContactComboboxInput = createEvoluComboboxInput({
		label: t("settings:form.billing-settings-form.label.own-contact"),
		query: createQuery((db) =>
			db
				.selectFrom("contact")
				.select(["contact.id", "contact.name"])
				.where("contact.isDeleted", "is not", sqliteTrue)
				.where("contact.name", "is not", null)
				.$narrowType<{
					name: KyselyNotNull;
				}>(),
		),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: row.name,
				value: row.id,
			})),
	});

	const DefaultBankAccountComboboxInput = createEvoluComboboxInput({
		label: t("settings:form.billing-settings-form.label.default-bank-account"),
		query: createQuery((db) =>
			db
				.selectFrom("account")
				.innerJoin("accountIban", "accountIban.id", "account.id")
				.select(["account.id", "account.name", "accountIban.iban"])
				.where("_tag", "=", "accountIban")
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("account.name", "is not", null)
				.where("accountIban.iban", "is not", null)
				.$narrowType<{
					name: KyselyNotNull;
					iban: KyselyNotNull;
				}>(),
		),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: `${formatIban(row.iban)} (${row.name})`,
				value: row.id,
			})),
	});

	const DefaultLnZapComboboxInput = createEvoluComboboxInput({
		label: t("settings:form.billing-settings-form.label.default-ln-zap-wallet"),
		query: createQuery((db) =>
			db
				.selectFrom("account")
				.selectAll()
				.where("_tag", "=", "accountLud16")
				.where("isDeleted", "is not", sqliteTrue)
				.$narrowType<{
					name: KyselyNotNull;
				}>(),
		),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: row.name,
				value: row.id,
			})),
	});

	const DefaultLnSparkComboboxInput = createEvoluComboboxInput({
		label: t(
			"settings:form.billing-settings-form.label.default-ln-spark-wallet",
		),
		query: createQuery((db) =>
			db
				.selectFrom("account")
				.selectAll()
				.where("_tag", "=", "accountSpark")
				.where("isDeleted", "is not", sqliteTrue)
				.$narrowType<{
					name: KyselyNotNull;
				}>(),
		),
		mapRowsToItems: (rows) =>
			rows.map((row) => ({
				label: row.name,
				value: row.id,
			})),
	});

	return createAutoFormLayout(billingSettingsFormSchema, ({ builder }) => ({
		...builder.card(
			{
				title: t("settings:form.billing-settings-form.title.general-settings"),
			},
			{
				...builder.createComponent("ownContactId", (props) => (
					<OwnContactComboboxInput {...props} />
				)),
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
			},
		),

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
						defaultValue: createTaxRate,
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
						...builder.magicInput("id").hidden(undefined),
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
	defaultValues?: PartialDeep<z.input<typeof billingSettingsFormSchema>>;
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
			const id = createIdFromString("");

			evolu.upsert(
				"billingSettings",
				{
					id,
					ownContactId: values.ownContactId,
					defaultInvoiceDueDateDays: values.defaultInvoiceDueDateDays,
					defaultCurrency: values.defaultCurrency,
					defaultTimezone: values.defaultTimezone,
					defaultPaymentMethodMethod: values.defaultPayment.method,
					defaultPaymentMethodBankAccountKey:
						values.defaultPayment.bankAccountKey,
					defaultPaymentMethod: values.defaultPaymentMethod,
					defaultBankTransferCzKey: values.defaultBankTransferCzKey,
					defaultLnZapKey: values.defaultLnZapKey,
					defaultLnSparkKey: values.defaultLnSparkKey,
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
							params.onSuccess(id);
						}
					},
				},
			);

			const originalTaxRates = new Set(
				(params.defaultValues?.taxRates ?? []).map((taxRate) => taxRate?.id),
			);

			for (const taxRate of values.taxRates) {
				originalTaxRates.delete(taxRate.id);

				evolu.upsert("billingSettingsTaxRate", {
					id: taxRate.id,
					name: taxRate.name,
					rate: taxRate.rate,
				});
			}

			for (const taxRateId of originalTaxRates) {
				if (taxRateId) {
					evolu.update("billingSettingsTaxRate", {
						id: taxRateId,
						isDeleted: sqliteTrue,
					});
				}
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
