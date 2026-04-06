"use client";

import { createId, createRandomBytes } from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import { PaymentDefaultMethodType } from "@/lib/evolu/model/payment-default-method";
import { createPaymentDefaultMethodsQuery } from "@/lib/evolu/queries/payment-default-method";
import { TableIdSchema } from "@/lib/evolu/types";
import { createPaymentWithDefaultMethods } from "@/lib/payment/service";
import {
	Currency,
	FiatCurrency,
	HttpsUrlSchema,
	IntegerSchema,
	NonEmptyStringSchema,
	type NonNegativeInteger,
	NumberStringSchema,
	StringToNullableNumberSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	type Uuid7,
} from "@/lib/shared/types";
import { formatIban } from "@/lib/shared/utils/format";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const baseStaticPaymentSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	totalAmount: StringToNullableStringSchema.pipe(NumberStringSchema),
	currency: z.enum(Currency),
	tipAmount: StringToNullableStringSchema.pipe(NumberStringSchema.nullable()),
	amountInBtc: StringToNullableNumberSchema.pipe(IntegerSchema),
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

const staticPaymentSchema = baseStaticPaymentSchema.transform((values) => ({
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
		totalAmount: "0",
		currency: Currency.USD,
		tipAmount: "",
		amountInBtc: "0",
		redirectUrl: "",
		itemLines: [createItemLineDefaultValues()],
	}) satisfies z.input<typeof staticPaymentSchema>;

type PaymentDefaultMethodPreviewItem = {
	id: string;
	type: string;
	accountName: string | null;
	accountTag: string | null;
	accountIban: string | null;
	accountLud16: string | null;
};

const getPaymentMethodLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	params: {
		type: string;
		accountName: string | null;
		accountTag: string | null;
		accountIban: string | null;
		accountLud16: string | null;
	},
) => {
	if (params.type === PaymentDefaultMethodType.Cash) {
		return t("payments:form.payment-form.generated-payment-method.cash", {
			account: params.accountName ?? "-",
		});
	}

	if (params.type === PaymentDefaultMethodType.BankTransferCZ) {
		return t(
			"payments:form.payment-form.generated-payment-method.bank-transfer-cz",
			{
				account:
					params.accountIban && params.accountName
						? `${formatIban(params.accountIban as never)} (${params.accountName})`
						: (params.accountName ?? "-"),
			},
		);
	}

	const accountLabel =
		params.accountTag === "accountLud16" && params.accountLud16
			? `${params.accountLud16} (${params.accountName ?? "-"})`
			: (params.accountName ?? "-");
	const provider =
		params.accountTag === "accountSpark"
			? "Spark"
			: params.accountTag === "accountNwc"
				? "NWC"
				: "LUD16";

	return t("payments:form.payment-form.generated-payment-method.btc-ln", {
		account: accountLabel,
		provider,
	});
};

const DefaultPaymentMethodsPreview: React.FC<{
	methods: PaymentDefaultMethodPreviewItem[];
	ignoredActiveMethodCount: number;
}> = ({ methods, ignoredActiveMethodCount }) => {
	const { t } = useTranslation();

	if (methods.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				{t("payments:form.payment-form.message.no-active-payment-methods")}
			</p>
		);
	}

	return (
		<div className="space-y-3">
			<ul className="space-y-2 text-sm">
				{methods.map((method) => (
					<li key={method.id}>{getPaymentMethodLabel(t, method)}</li>
				))}
			</ul>
			{ignoredActiveMethodCount > 0 && (
				<p className="text-sm text-muted-foreground">
					{t(
						"payments:form.payment-form.message.ignored-invalid-payment-methods",
					)}
				</p>
			)}
		</div>
	);
};

const createComponents = (
	t: TFunction,
	props: {
		activeDefaultMethods: PaymentDefaultMethodPreviewItem[];
		ignoredActiveMethodCount: number;
		hasLnPaymentMethod: boolean;
	},
) =>
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
				title: t("payments:form.payment-form.title.generated-payment-methods"),
				description: t(
					"payments:form.payment-form.description.generated-payment-methods",
				),
			},
			{
				...(props.hasLnPaymentMethod
					? builder.magicInput("amountInBtc").amount({
							label: t("payments:form.payment-form.label.price-in-btc"),
							type: "number",
							placeholder: t("payments:form.payment-form.placeholder.0"),
							currency: Currency.BTC,
							disabled: true,
							computeAmount: {
								sourceAmountFieldName: "totalAmount",
								sourceCurrencyFieldName: "currency",
							},
						})
					: {}),
				// @ts-expect-error
				...builder.createComponent("_defaultMethodsPreview", () => (
					<DefaultPaymentMethodsPreview
						methods={props.activeDefaultMethods}
						ignoredActiveMethodCount={props.ignoredActiveMethodCount}
					/>
				)),
			},
		),
	}));

export const PaymentForm: React.FC<{
	defaultValues?: Partial<z.input<typeof staticPaymentSchema> & { id: Uuid7 }>;
}> = (params) => {
	const { t } = useTranslation();
	const storageDeps = useStorageDeps();
	const router = useRouter();
	const activePaymentDefaultMethodsQuery = useMemo(
		() =>
			createPaymentDefaultMethodsQuery({
				onlyActive: true,
			}),
		[],
	);
	const { data: activePaymentDefaultMethods } = useEvoluQuery(
		activePaymentDefaultMethodsQuery,
	);
	const validActivePaymentDefaultMethods = activePaymentDefaultMethods.filter(
		(method) => method.accountTag !== null,
	);
	const ignoredActiveMethodCount =
		activePaymentDefaultMethods.length -
		validActivePaymentDefaultMethods.length;
	const hasLnPaymentMethod = validActivePaymentDefaultMethods.some(
		(method) => method.type === PaymentDefaultMethodType.BtcLn,
	);
	const [defaultValues] = useState(() =>
		merge(createPaymentDefaultValues(), params.defaultValues ?? {}),
	);
	const components = useMemo(
		() =>
			createComponents(t, {
				activeDefaultMethods: validActivePaymentDefaultMethods,
				ignoredActiveMethodCount,
				hasLnPaymentMethod,
			}),
		[
			t,
			validActivePaymentDefaultMethods,
			ignoredActiveMethodCount,
			hasLnPaymentMethod,
		],
	);
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = await createPaymentWithDefaultMethods(storageDeps)({
				payment: {
					id: values.id,
					deviceId: values.deviceId,
					currency: values.currency,
				},
				totalAmount: values.totalAmount as NonNegativeInteger,
				tipAmount: values.tipAmount as NonNegativeInteger | null,
				amountInBtc: values.amountInBtc as NonNegativeInteger,
			});

			router.push(
				`/admin/payments/detail?id=${encodeURIComponent(id)}&focus=true`,
			);
		},
		onSuccess: () => {},
	});

	return <AutoForm form={form} components={components} />;
};
