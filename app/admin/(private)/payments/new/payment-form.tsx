"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import NDK, {
	NDKPrivateKeySigner,
	type NDKSigner,
	type NDKUser,
} from "@nostr-dev-kit/ndk";
import { merge } from "es-toolkit";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { AutoformIbanInput } from "@/components/auto-form/autoform-iban";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import {
	createPayment,
	createSparkPayment,
	createZapPayment,
} from "@/lib/payment-utils";
import type { StaticOfflinePayment } from "@/lib/schemas";
import { assertNever } from "@/lib/type-utils";
import {
	Currency,
	EmailSchema,
	FiatCurrency,
	HttpsUrlSchema,
	IbanSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
	Uuid7,
} from "@/lib/types";

const baseStaticPaymentSchema = z.object({
	currency: z.enum(FiatCurrency),
	totalAmount: StringToNumberSchema,
	amountInBtc: StringToNumberSchema,
	lud16: z.string(),
	iban: z.string(),
	accountId: z.string(),
	redirectUrl: StringToNullableStringSchema.pipe(HttpsUrlSchema.nullable()),
	merchantName: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
	items: z
		.object({
			label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			price: StringToNumberSchema,
			quantity: StringToNumberSchema,
		})
		.array(),
});

const staticPaymentSchema = z.discriminatedUnion("type", [
	baseStaticPaymentSchema.extend({
		type: z.literal("lnZap"),
		lud16: StringToNullableStringSchema.pipe(EmailSchema),
	}),
	baseStaticPaymentSchema.extend({
		type: z.literal("lnSpark"),
		accountId: z.string(),
	}),
	baseStaticPaymentSchema.extend({
		type: z.literal("cash"),
	}),
	baseStaticPaymentSchema.extend({
		type: z.literal("bankTransferCZ"),
		iban: StringToUndefinedStringSchema.transform((value) =>
			value ? value.replace(/ /g, "") : value,
		).pipe(IbanSchema),
	}),
]);

const itemDefaultValues = {
	label: "",
	price: "0",
	quantity: "1",
};

const staticPaymentDefaultValues = {
	merchantName: "",
	type: "cash",
	lud16: "",
	iban: "",
	accountId: "",
	currency: Currency.USD,
	totalAmount: "0",
	amountInBtc: "0",
	redirectUrl: "",
	items: [itemDefaultValues],
} satisfies z.input<typeof staticPaymentSchema>;

const createComponents = (t: TFunction) => createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
	...builder.card(
		{
			title: t("payments:form.payment-form.title.payment-info"),
		},
		{
			...builder.magicInput("merchantName").text({
				label: t("payments:form.payment-form.label.merchant-name"),
			}),

			...builder.magicInput("currency").select({
				values: FiatCurrency,
				allowEmpty: false,
				label: t("payments:form.payment-form.label.currency"),
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
					name: "items",
					defaultValue: itemDefaultValues,
					columns: [
						{
							title: t("payments:form.payment-form.title.label"),
						},
						{
							title: t("payments:form.payment-form.title.price"),
							className: "w-[130px]",
						},
						{
							title: t("payments:form.payment-form.title.quantity"),
							className: "w-[80px]",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("label").text({
						label: t("payments:form.payment-form.label.label"),
					}),
					...builder.magicInput("price").text({
						label: t("payments:form.payment-form.label.price"),
						placeholder: t("payments:form.payment-form.placeholder.0"),
					}),
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
			const result = useWatch({
				control: props.control,
				name: "items",
			}) as [{ price: string; quantity: string }];

			const totalPrice = result.reduce((acc, row) => {
				const price = Number(row.price);
				const quantity = Number(row.quantity);
				if (Number.isNaN(price) || Number.isNaN(quantity)) {
					return acc;
				}
				return acc + price * quantity;
			}, 0);

			useEffect(() => {
				setValue("totalAmount", totalPrice.toString());
			}, [totalPrice, setValue]);

			return null;
		},
	),

	...builder.magicInput("totalAmount").text({
		disabled: true,
		label: t("payments:form.payment-form.label.total-amount"),
	}),

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
						sourceAmountFieldName: "totalAmount",
						sourceCurrencyFieldName: "currency",
					},
				}),
				...builder.createComponent("lud16", (props) => {
					const evolu = useEvolu();
					const ComboboxInput = useMemo(
						() =>
							createComboboxOrTextInput<string>({
								label: t(
									"payments:form.payment-form.label.lud16-wallet-address-with-lightning-zaps-support",
								),
								fetchItems: async () => {
									const items = await evolu.loadQuery(
										evolu.createQuery((db) =>
											db
												.selectFrom("account")
												.leftJoin(
													"accountLud16",
													"accountLud16.id",
													"account.id",
												)
												.select([
													"account.name as name",
													"accountLud16.lud16 as lud16",
												] as const)
												.where("account.isDeleted", "is not", sqliteTrue)
												.where("account._tag", "=", "accountLud16"),
										),
									);

									return items
										.filter((item) => item.lud16 !== null)
										.map((item) => ({
											label: `${item.lud16} (${item.name})`,
											value: item.lud16,
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
								label: t("payments:form.payment-form.label.spark-wallet-account"),
								fetchItems: async () => {
									const items = await evolu.loadQuery(
										evolu.createQuery((db) =>
											db
												.selectFrom("account")
												.select([
													"account.id as id",
													"account.name as name",
												] as const)
												.where("account.isDeleted", "is not", sqliteTrue)
												.where("account._tag", "=", "accountSpark"),
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
	const { ndk } = useNostr();
	const storageDeps = useStorageDeps();
	const router = useRouter();
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(staticPaymentDefaultValues, params.defaultValues ?? {});
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			const paymentSigner = NDKPrivateKeySigner.generate();
			const paymentNdk = new NDK({
				explicitRelayUrls: ndk.explicitRelayUrls,
				signer: paymentSigner,
			}) as NDK & {
				signer: NDKSigner;
				activeUser: NDKUser;
			};

			await paymentNdk.connect();

			if (paymentNdk.activeUser === undefined) {
				return;
			}

			let paymentOption:
				| StaticOfflinePayment["paymentOptions"][number]
				| undefined;
			if (values.type === "lnZap") {
				paymentOption = await (async () => {
					const zapPaymentResult = await createZapPayment({
						amountInBtc: values.amountInBtc,
						lud16: values.lud16,
						ndk,
						paymentNdk,
					});

					return {
						type: "lnZap",
						amount: values.amountInBtc,
						lnInvoice: zapPaymentResult.lnInvoice,
						walletPubkey: zapPaymentResult.walletPubkey,
						expirationIn: zapPaymentResult.expirationIn,
					} as const;
				})();
			} else if (values.type === "lnSpark") {
				paymentOption = await (async () => {
					const zapPaymentResult = await createSparkPayment({
						accountId: values.accountId as Id,
						amountInBtc: values.amountInBtc,
						...storageDeps,
					});

					if (zapPaymentResult === undefined) {
						return;
					}

					return {
						type: "lnSpark",
						amount: values.amountInBtc,
						accountId: values.accountId,
						lnInvoice: zapPaymentResult.lnInvoice,
						sparkInvoiceId: zapPaymentResult.sparkInvoiceId,
						expirationIn: zapPaymentResult.expirationAt.getTime() / 1000,
					} as const;
				})();
			} else if (values.type === "bankTransferCZ") {
				paymentOption = {
					type: "bankTransferCZ",
					iban: values.iban,
					variableSymbol: "1",
				} as const;
			} else if (values.type === "cash") {
				paymentOption = {
					type: "cash",
				} as const;
			} else {
				assertNever(values);
			}

			if (paymentOption === undefined) {
				return;
			}

			const paymentData: StaticOfflinePayment = {
				bill: {
					currency: values.currency,
					allowTip: false,
					items: values.items.map((item) => ({
						id: Uuid7.random(),
						price: item.price,
						label: item.label,
						quantity: item.quantity,
					})),
				},
				...(values.merchantName !== null
					? {
							merchant: {
								name: values.merchantName,
							},
						}
					: {}),
				...(values.redirectUrl !== null
					? {
							onSuccessfulPayment: {
								_tag: "httpRedirect",
								redirectUrl: values.redirectUrl,
							},
						}
					: {}),
				paymentOptions: [paymentOption],
				privateKey: paymentSigner.privateKey,
			};

			const id = await createPayment({
				paymentNdk,
				...storageDeps,
				paymentData,
			});

			router.push(
				`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
			);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
