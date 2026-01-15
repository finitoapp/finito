"use client";

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
import { useNostr } from "@/hooks/use-nostr";
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
import { accountStorage } from "@/storages/account-storage";

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

const components = createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
	...builder.card(
		{
			title: "Payment info",
		},
		{
			...builder.magicInput("merchantName").text({
				label: "Merchant name",
			}),

			...builder.magicInput("currency").select({
				values: FiatCurrency,
				allowEmpty: false,
				label: "Currency",
			}),
		},
	),

	...builder.collapsibleSeparator(
		{
			title: "Advanced options",
			watchErrors: ["redirectUrl"],
		},
		{
			...builder.card(
				{},
				{
					...builder.magicInput("redirectUrl").text({
						label: "Redirect URL",
						placeholder: "https://",
						description:
							"The customer will be redirected to this URL when they complete the payment via the web interface.",
					}),
				},
			),
		},
	),

	...builder.card(
		{
			title: "Items",
		},
		{
			...builder.arrayTableField(
				{
					name: "items",
					defaultValue: itemDefaultValues,
					columns: [
						{
							title: "Label",
						},
						{
							title: "Price",
							className: "w-[130px]",
						},
						{
							title: "Quantity",
							className: "w-[80px]",
						},
					],
				},
				({ builder }) => ({
					...builder.magicInput("label").text({
						label: "Label",
					}),
					...builder.magicInput("price").text({
						label: "Price",
						placeholder: "0",
					}),
					...builder.magicInput("quantity").text({
						label: "Quantity",
						placeholder: "1",
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
		label: "Total amount",
	}),

	...builder.card(
		{
			title: "Payment method",
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
					label: "Price in BTC",
					type: "number",
					placeholder: "0",
					currency: Currency.BTC,
					disabled: true,
					computeAmount: {
						sourceAmountFieldName: "totalAmount",
						sourceCurrencyFieldName: "currency",
					},
				}),
				...builder.createComponent("lud16", (props) => {
					const { ndk } = useNostr();
					const ComboboxInput = useMemo(
						() =>
							createComboboxOrTextInput<string>({
								label: "lud16 wallet address with `Lightning Zaps` support",
								fetchItems: async () => {
									const items = await accountStorage.select({ ndk });

									return items.data
										.filter((item) => item.value._tag === "lud16")
										.map((item) => ({
											label:
												item.value._tag === "lud16"
													? `${item.value.lud16} (${item.value.name})`
													: "-",
											value:
												item.value._tag === "lud16" ? item.value.lud16 : "-",
										}));
								},
							}),
						[ndk],
					);

					return <ComboboxInput {...props} />;
				}),
			}),

			...builder.when("type", (value) => value === "lnSpark", {
				...builder.magicInput("amountInBtc").amount({
					label: "Price in BTC",
					type: "number",
					placeholder: "0",
					currency: Currency.BTC,
					disabled: true,
					computeAmount: {
						sourceAmountFieldName: "totalAmount",
						sourceCurrencyFieldName: "currency",
					},
				}),
				...builder.createComponent("accountId", (props) => {
					const { ndk } = useNostr();
					const ComboboxInput = useMemo(
						() =>
							createComboboxOrTextInput<string>({
								label: "Spark wallet account",
								fetchItems: async () => {
									const items = await accountStorage.select({ ndk });

									return items.data
										.filter((item) => item.value._tag === "spark")
										.map((item) => ({
											label:
												item.value._tag === "spark" ? item.value.name : "-",
											value: item.value._tag === "spark" ? item.value.id : "-",
										}));
								},
							}),
						[ndk],
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
	const { ndk } = useNostr();
	const router = useRouter();
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(staticPaymentDefaultValues, params.defaultValues ?? {});
	});
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: Uuid7.random();

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
						accountId: values.accountId,
						amountInBtc: values.amountInBtc,
						ndk,
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

			await createPayment({
				paymentNdk,
				ndk,
				paymentData,
				paymentId: id,
			});

			router.push(
				`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
			);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
