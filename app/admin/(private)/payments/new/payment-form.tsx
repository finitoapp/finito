"use client";

import {
	createId,
	createRandomBytes,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { AutoformIbanInput } from "@/components/auto-form/autoform-iban";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { createQuery } from "@/lib/evolu";
import { type Id, TableIdSchema } from "@/lib/evolu/types";
import { createPayment } from "@/lib/payment/service";
import {
	Currency,
	FiatCurrency,
	HttpsUrlSchema,
	IbanSchema,
	IntegerSchema,
	NonEmptyStringSchema,
	type NonNegativeInteger,
	NumberStringSchema,
	StringToNullableNumberSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
	type Uuid7,
	VariableSymbol,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const baseStaticPaymentSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	totalAmount: StringToNullableStringSchema.pipe(NumberStringSchema),
	currency: z.enum(Currency),
	tipAmount: StringToNullableStringSchema.pipe(NumberStringSchema.nullable()),
	amountInBtc: StringToNullableNumberSchema.pipe(IntegerSchema),
	iban: z.string(),
	lnZapAccountId: z.string(),
	accountId: z.string(),
	redirectUrl: StringToNullableStringSchema.pipe(HttpsUrlSchema.nullable()),
	merchantName: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
	itemLines: z
		.object({
			item: z
				.object({
					label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
					price: StringToNullableStringSchema.pipe(NumberStringSchema),
					currency: z.enum(Currency),
				})
				.transform((values) => ({
					...values,
					price: moneyCodec.parse({
						value: values.price,
						currency: values.currency,
					}).value,
				})),
			quantity: StringToNumberSchema,
		})
		.array(),
});

const staticPaymentSchema = z
	.discriminatedUnion("type", [
		baseStaticPaymentSchema.extend({
			type: z.literal("lnZap"),
			lnZapAccountId: z.string().pipe(TableIdSchema),
		}),
		baseStaticPaymentSchema.extend({
			type: z.literal("lnSpark"),
			accountId: z.string().pipe(TableIdSchema),
		}),
		baseStaticPaymentSchema.extend({
			type: z.literal("cash"),
			accountId: z.string().pipe(TableIdSchema),
		}),
		baseStaticPaymentSchema.extend({
			type: z.literal("bankTransferCZ"),
			iban: StringToUndefinedStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema),
		}),
	])
	.transform((values) => ({
		...values,
		totalAmount: moneyCodec.parse({
			value: values.totalAmount,
			currency: values.currency,
		}).value,
		tipAmount: values.tipAmount
			? moneyCodec.parse({
					value: values.tipAmount,
					currency: values.currency,
				}).value
			: null,
	}));

const itemDefaultValues = {
	label: "",
	price: "0",
	currency: Currency.USD,
};

const createItemLineDefaultValues = () => ({
	quantity: "1",
	item: itemDefaultValues,
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createPaymentDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		merchantName: "",
		type: "cash",
		iban: "",
		lnZapAccountId: "",
		accountId: "",
		totalAmount: "0",
		currency: Currency.USD,
		tipAmount: "",
		amountInBtc: "0",
		redirectUrl: "",
		itemLines: [createItemLineDefaultValues()],
	}) satisfies z.input<typeof staticPaymentSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
		...builder.card(
			{
				title: t("payments:form.payment-form.title.payment-info"),
			},
			{
				...builder.magicInput("merchantName").text({
					label: t("payments:form.payment-form.label.merchant-name"),
				}),
				...builder.magicInput("tipAmount").text({
					label: t("payments:form.payment-form.label.expected-tip-amount"),
					placeholder: t("payments:form.payment-form.placeholder.0"),
				}),
				...builder.magicInput("currency").select({
					values: FiatCurrency,
					allowEmpty: false,
					label: t("payments:form.payment-form.label.currency"),
				}),
				...builder.magicInput("totalAmount").text({
					disabled: true,
					label: t("payments:form.payment-form.label.total-amount"),
				}),
			},
		),

		...builder.collapsibleSeparator(
			{
				title: t("payments:form.payment-form.title.advanced-options"),
				watchErrors: ["redirectUrl"],
			},
			{
				...builder.card(
					{},
					{
						...builder.magicInput("redirectUrl").text({
							label: t("payments:form.payment-form.label.redirect-url"),
							placeholder: t("payments:form.payment-form.placeholder.https"),
							description: t(
								"payments:form.payment-form.description.the-customer-will-be-redirected-to-this-url-when-they-complete-the-payment-via-t",
							),
						}),
					},
				),
			},
		),

		...builder.card(
			{
				title: t("payments:form.payment-form.title.items"),
			},
			{
				...builder.arrayTableField(
					{
						name: "itemLines",
						defaultValue: createItemLineDefaultValues,
						columns: [
							{
								title: t("payments:form.payment-form.title.label"),
							},
							{
								title: t("payments:form.payment-form.title.price"),
								className: "w-[130px]",
							},
							{
								hidden: true,
							},
							{
								title: t("payments:form.payment-form.title.quantity"),
								className: "w-[80px]",
							},
						],
					},
					({ builder }) => ({
						...builder.nestedField("item", ({ builder }) => ({
							...builder.magicInput("label").text({
								label: t("payments:form.payment-form.label.label"),
							}),
							...builder.magicInput("price").text({
								label: t("payments:form.payment-form.label.price"),
								placeholder: t("payments:form.payment-form.placeholder.0"),
							}),
							...builder.magicInput("currency").text({
								type: "hidden",
							}),
						})),
						...builder.magicInput("quantity").text({
							label: t("payments:form.payment-form.label.quantity"),
							placeholder: t("payments:form.payment-form.placeholder.1"),
							type: "number",
						}),
					}),
				),
			},
		),

		...builder.createComponent(
			// @ts-expect-error
			"_totalAmount",
			(props) => {
				const { setValue } = useFormContext();
				const [result, tipAmount] = useWatch({
					control: props.control,
					name: ["itemLines", "tipAmount"],
				}) as [
					[{ item: { price: string }; quantity: string }],
					tipAmount: string,
				];

				let tip = Number(tipAmount);
				if (Number.isNaN(tip)) {
					tip = 0;
				}

				const totalPrice = result.reduce((acc, row) => {
					const price = Number(row.item.price);
					const quantity = Number(row.quantity);
					if (Number.isNaN(price) || Number.isNaN(quantity)) {
						return acc;
					}
					return acc + price * quantity;
				}, tip);

				useEffect(() => {
					setValue("totalAmount", totalPrice.toString());
				}, [totalPrice, setValue]);

				return null;
			},
		),

		...builder.card(
			{
				title: t("payments:form.payment-form.title.payment-method"),
			},
			{
				...builder.magicInput("type").select({
					variant: "toggle",
					allowEmpty: false,
					values: {
						cash: "Cash",
						lnZap: "LN (Zap)",
						lnSpark: "LN (Spark)",
						bankTransferCZ: "Bank transfer (CZ QR payment)",
					},
				}),

				...builder.when("type", (value) => value === "bankTransferCZ", {
					...builder.createComponent("iban", AutoformIbanInput),
				}),

				...builder.when("type", (value) => value === "lnZap", {
					...builder.magicInput("amountInBtc").amount({
						label: t("payments:form.payment-form.label.price-in-btc"),
						type: "number",
						placeholder: t("payments:form.payment-form.placeholder.0"),
						currency: Currency.BTC,
						disabled: true,
						computeAmount: {
							sourceAmountFieldName: "totalAmount.value",
							sourceCurrencyFieldName: "totalAmount.currency",
						},
					}),
					...builder.createComponent("lnZapAccountId", (props) => {
						const evolu = useEvolu();
						const ComboboxInput = useMemo(
							() =>
								createComboboxOrTextInput<string>({
									label: t(
										"payments:form.payment-form.label.lud16-wallet-address-with-lightning-zaps-support",
									),
									fetchItems: async () => {
										const items = await evolu.loadQuery(
											createQuery((db) =>
												db
													.selectFrom("account")
													.innerJoin(
														"accountLud16",
														"accountLud16.id",
														"account.id",
													)
													.select([
														"account.id as id",
														"account.name as name",
														"accountLud16.lud16 as lud16",
													] as const)
													.where("account.isDeleted", "is not", sqliteTrue)
													.where("account.name", "is not", null)
													.where("account._tag", "=", "accountLud16")
													.$narrowType<{
														name: KyselyNotNull;
													}>(),
											),
										);

										return items.map((item) => ({
											label: `${item.lud16} (${item.name})`,
											value: item.id,
										}));
									},
								}),
							[evolu],
						);

						return <ComboboxInput {...props} />;
					}),
				}),

				...builder.when("type", (value) => value === "lnSpark", {
					...builder.magicInput("amountInBtc").amount({
						label: t("payments:form.payment-form.label.price-in-btc"),
						type: "number",
						placeholder: t("payments:form.payment-form.placeholder.0"),
						currency: Currency.BTC,
						disabled: true,
						computeAmount: {
							sourceAmountFieldName: "totalAmount",
							sourceCurrencyFieldName: "currency",
						},
					}),
					...builder.createComponent("accountId", (props) => {
						const evolu = useEvolu();
						const ComboboxInput = useMemo(
							() =>
								createComboboxOrTextInput<string>({
									label: t(
										"payments:form.payment-form.label.spark-wallet-account",
									),
									fetchItems: async () => {
										const items = await evolu.loadQuery(
											createQuery((db) =>
												db
													.selectFrom("account")
													.select([
														"account.id as id",
														"account.name as name",
													] as const)
													.where("account.isDeleted", "is not", sqliteTrue)
													.where("account.name", "is not", null)
													.where("account._tag", "=", "accountSpark")
													.$narrowType<{
														name: KyselyNotNull;
													}>(),
											),
										);

										return items.map((item) => ({
											label: item.name,
											value: item.id,
										}));
									},
								}),
							[evolu],
						);

						return <ComboboxInput {...props} />;
					}),
				}),
				...builder.when("type", (value) => value === "cash", {
					...builder.createComponent("accountId", (props) => {
						const evolu = useEvolu();
						const ComboboxInput = useMemo(
							() =>
								createComboboxOrTextInput<string>({
									label: t(
										"payments:form.payment-form.label.cash-register-account",
									),
									fetchItems: async () => {
										const items = await evolu.loadQuery(
											createQuery((db) =>
												db
													.selectFrom("account")
													.select([
														"account.id as id",
														"account.name as name",
													] as const)
													.where("account.isDeleted", "is not", sqliteTrue)
													.where("account.name", "is not", null)
													.where("account._tag", "=", "accountCashRegister")
													.$narrowType<{
														name: KyselyNotNull;
													}>(),
											),
										);

										return items.map((item) => ({
											label: item.name,
											value: item.id,
										}));
									},
								}),
							[evolu],
						);

						return <ComboboxInput {...props} />;
					}),
				}),
			},
		),
	}));

export const PaymentForm: React.FC<{
	defaultValues?: Partial<z.input<typeof staticPaymentSchema> & { id: Uuid7 }>;
}> = (params) => {
	const { t } = useTranslation();
	const storageDeps = useStorageDeps();
	const router = useRouter();
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(createPaymentDefaultValues(), params.defaultValues ?? {});
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = await createPayment(storageDeps)({
				payment: {
					id: values.id,
					deviceId: values.deviceId,
					currency: values.currency,
				},
				totalAmount: values.totalAmount as NonNegativeInteger,
				tipAmount: values.tipAmount as NonNegativeInteger | null,
				paymentBankTransferCZ:
					values.type === "bankTransferCZ"
						? {
								iban: values.iban,
								variableSymbol: VariableSymbol("1"),
							}
						: undefined,
				paymentCash:
					values.type === "cash"
						? {
								accountId: values.accountId,
							}
						: undefined,
				paymentLnZap:
					values.type === "lnZap"
						? {
								accountId: values.accountId as Id,
								amount: values.amountInBtc as NonNegativeInteger,
							}
						: undefined,
				paymentLnSpark:
					values.type === "lnSpark"
						? {
								accountId: values.accountId as Id,
								amount: values.amountInBtc as NonNegativeInteger,
							}
						: undefined,
			});

			router.push(
				`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
			);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
