"use client";

import {
	createId,
	createRandomBytes,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import {
	AutoForm,
	type AutoFormComponent,
	createAutoFormLayout,
} from "@/components/auto-form";
import { ComboboxDefault } from "@/components/combobox/default";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import {
	PaymentDefaultMethodType,
	type PaymentDefaultMethodType as PaymentDefaultMethodTypeValue,
	paymentDefaultMethodAllowedAccountTags,
} from "@/lib/evolu/model/payment-default-method";
import { TableIdSchema } from "@/lib/evolu/types";
import { TimestampMs } from "@/lib/shared/types";
import { formatIban } from "@/lib/shared/utils/format";

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const PaymentDefaultMethodStatus = {
	Active: "active",
	Paused: "paused",
} as const;

const paymentDefaultMethodAccountsQuery = createQuery((db) =>
	db
		.selectFrom("account")
		.leftJoin("accountIban", "accountIban.id", "account.id")
		.leftJoin("accountLud16", "accountLud16.id", "account.id")
		.select([
			"account.id as id",
			"account.name as name",
			"account._tag as _tag",
			"accountIban.iban as iban",
			"accountLud16.lud16 as lud16",
		] as const)
		.where("account.isDeleted", "is not", sqliteTrue)
		.where("account.name", "is not", null)
		.where("account._tag", "is not", null)
		.where("account._tag", "in", [
			"accountCashRegister",
			"accountIban",
			"accountLud16",
			"accountSpark",
			"accountNwc",
		])
		.$narrowType<{
			name: KyselyNotNull;
			_tag: KyselyNotNull;
		}>(),
);

const paymentDefaultMethodRowSchema = z
	.object({
		id: TableIdSchema,
		type: z.enum(PaymentDefaultMethodType).nullable(),
		accountId: TableIdSchema.nullable(),
		pausedAt: z.number().nullable(),
		status: z.enum(PaymentDefaultMethodStatus),
	})
	.superRefine((value, context) => {
		if (value.type === null) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Select a payment method type.",
				path: ["type"],
			});
		}

		if (value.accountId === null) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Select an account.",
				path: ["accountId"],
			});
		}
	})
	.transform((value) => ({
		...value,
		type: value.type as PaymentDefaultMethodTypeValue,
		accountId: value.accountId as string,
	}));

export const paymentDefaultMethodsFormSchema = z.object({
	methods: paymentDefaultMethodRowSchema
		.array()
		.superRefine((values, context) => {
			const seenTypes = new Set<PaymentDefaultMethodTypeValue>();

			values.forEach((value, index) => {
				if (seenTypes.has(value.type)) {
					context.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Each payment method type can be configured only once.",
						path: [index, "type"],
					});
					return;
				}

				seenTypes.add(value.type);
			});
		}),
});

const createPaymentDefaultMethodDefaultValues = () =>
	({
		id: createId(createIdDeps),
		type: null,
		accountId: null,
		pausedAt: null,
		status: PaymentDefaultMethodStatus.Active,
	}) satisfies z.input<typeof paymentDefaultMethodRowSchema>;

const createPaymentDefaultMethodsFormDefaultValues = () =>
	({
		methods: [],
	}) satisfies z.input<typeof paymentDefaultMethodsFormSchema>;

const getPaymentDefaultMethodTypeLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	type: PaymentDefaultMethodTypeValue,
) => {
	if (type === PaymentDefaultMethodType.Cash) {
		return t("payments:form.payment-default-methods-form.type.cash");
	}
	if (type === PaymentDefaultMethodType.BtcLn) {
		return t("payments:form.payment-default-methods-form.type.btc-ln");
	}

	return t("payments:form.payment-default-methods-form.type.bank-transfer-cz");
};

const getAccountTagLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	tag: string,
) => {
	if (tag === "accountIban") {
		return t("accounts:form.account-form.tag.account-iban");
	}
	if (tag === "accountLud16") {
		return t("accounts:form.account-form.tag.account-lud16");
	}
	if (tag === "accountSpark") {
		return t("accounts:form.account-form.tag.account-spark");
	}
	if (tag === "accountNwc") {
		return t("accounts:form.account-form.tag.account-nwc");
	}
	if (tag === "accountCashRegister") {
		return t("accounts:form.account-form.tag.account-cash-register");
	}

	return tag;
};

const getAccountLabel = (
	t: ReturnType<typeof useTranslation>["t"],
	account: {
		name: string;
		_tag: string;
		iban: string | null;
		lud16: string | null;
	},
) => {
	if (account._tag === "accountIban" && account.iban) {
		return `${formatIban(account.iban as never)} (${account.name})`;
	}

	if (account._tag === "accountLud16" && account.lud16) {
		return `${account.lud16} (${account.name})`;
	}

	return `${account.name} (${getAccountTagLabel(t, account._tag)})`;
};

const getArrayFieldMeta = (fieldName: string) => {
	const [arrayName, indexString] = fieldName.split(".");

	return {
		arrayName,
		index: Number(indexString),
	};
};

const PaymentDefaultMethodTypeInput: AutoFormComponent<
	z.input<typeof paymentDefaultMethodRowSchema>["type"]
> = (props) => {
	const { t } = useTranslation();
	const { arrayName, index } = getArrayFieldMeta(props.name);
	const methods = useWatch({
		control: props.control,
		name: arrayName,
	}) as Array<z.input<typeof paymentDefaultMethodRowSchema>> | undefined;

	const currentType = methods?.[index]?.type ?? null;
	const usedTypes = new Set(
		(methods ?? [])
			.flatMap((method, methodIndex) =>
				methodIndex === index || method.type === null ? [] : [method.type],
			)
			.filter((type): type is PaymentDefaultMethodTypeValue => type !== null),
	);
	const items = Object.values(PaymentDefaultMethodType)
		.filter((type) => currentType === type || !usedTypes.has(type))
		.map((type) => ({
			value: type,
			label: getPaymentDefaultMethodTypeLabel(t, type),
		}));

	return (
		<Controller
			control={props.control}
			name={props.name}
			render={({ field, fieldState }) => (
				<Field data-invalid={fieldState.invalid}>
					<FieldLabel htmlFor={field.name}>
						{t("payments:form.payment-default-methods-form.label.type")}
					</FieldLabel>
					<div className="flex gap-2">
						<ComboboxDefault
							items={items}
							value={field.value}
							onChange={field.onChange}
							placeholder={t(
								"payments:form.payment-default-methods-form.placeholder.select-type",
							)}
							formatCustomValue={(value) =>
								getPaymentDefaultMethodTypeLabel(
									t,
									value as PaymentDefaultMethodTypeValue,
								)
							}
						/>
					</div>
					{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
				</Field>
			)}
		/>
	);
};

const PaymentDefaultMethodAccountInput: AutoFormComponent<string | null> = (
	props,
) => {
	const { t } = useTranslation();
	const { data: accounts } = useEvoluQuery(paymentDefaultMethodAccountsQuery);
	const { setValue } = useFormContext();
	const currentType = useWatch({
		control: props.control,
		name: props.name.replace(/accountId$/, "type"),
	}) as PaymentDefaultMethodTypeValue | null;
	const currentValue = useWatch({
		control: props.control,
		name: props.name,
	}) as string | null;

	const items = useMemo(() => {
		if (currentType === null) {
			return [];
		}

		const allowedTags = paymentDefaultMethodAllowedAccountTags[currentType];

		return accounts
			.filter((account) =>
				allowedTags.some((allowedTag) => allowedTag === account._tag),
			)
			.map((account) => ({
				value: account.id,
				label: getAccountLabel(t, account),
			}));
	}, [accounts, currentType, t]);

	useEffect(() => {
		if (currentType === null) {
			if (currentValue !== null) {
				setValue(props.name, null);
			}
			return;
		}

		if (
			currentValue !== null &&
			!items.some((item) => item.value === currentValue)
		) {
			setValue(props.name, null);
		}
	}, [currentType, currentValue, items, props.name, setValue]);

	return (
		<Controller
			control={props.control}
			name={props.name}
			render={({ field, fieldState }) => (
				<Field data-invalid={fieldState.invalid}>
					<FieldLabel htmlFor={field.name}>
						{t("payments:form.payment-default-methods-form.label.account")}
					</FieldLabel>
					<div className="flex gap-2">
						<ComboboxDefault
							items={items}
							value={field.value}
							onChange={field.onChange}
							placeholder={
								currentType === null
									? t(
											"payments:form.payment-default-methods-form.placeholder.select-type-first",
										)
									: t(
											"payments:form.payment-default-methods-form.placeholder.select-account",
										)
							}
							formatCustomValue={(value) =>
								t(
									"payments:form.payment-default-methods-form.value.missing-account",
									{
										id: value,
									},
								)
							}
						/>
					</div>
					{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
				</Field>
			)}
		/>
	);
};

const createComponents = (t: TFunction) =>
	createAutoFormLayout(paymentDefaultMethodsFormSchema, ({ builder }) => ({
		...builder.card(
			{
				title: t(
					"payments:form.payment-default-methods-form.title.default-payment-methods",
				),
				description: t(
					"payments:form.payment-default-methods-form.description.default-payment-methods",
				),
			},
			{
				...builder.arrayTableField(
					{
						name: "methods",
						defaultValue: createPaymentDefaultMethodDefaultValues,
						columns: [
							{
								hidden: true,
							},
							{
								hidden: true,
							},
							{
								title: t(
									"payments:form.payment-default-methods-form.title.type",
								),
							},
							{
								title: t(
									"payments:form.payment-default-methods-form.title.account",
								),
							},
							{
								title: t(
									"payments:form.payment-default-methods-form.title.status",
								),
								className: "w-[160px]",
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("id").hidden(undefined),
						...builder.createComponent("pausedAt", () => null),
						...builder.createComponent("type", PaymentDefaultMethodTypeInput),
						...builder.createComponent(
							"accountId",
							PaymentDefaultMethodAccountInput,
						),
						...builder.magicInput("status").select({
							values: {
								[PaymentDefaultMethodStatus.Active]: t(
									"payments:form.payment-default-methods-form.status.active",
								),
								[PaymentDefaultMethodStatus.Paused]: t(
									"payments:form.payment-default-methods-form.status.paused",
								),
							},
							allowEmpty: false,
							label: t(
								"payments:form.payment-default-methods-form.label.status",
							),
						}),
					}),
				),
			},
		),
	}));

export const PaymentDefaultMethodsForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof paymentDefaultMethodsFormSchema>>;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(
			createPaymentDefaultMethodsFormDefaultValues(),
			params.defaultValues ?? {},
		),
	);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(paymentDefaultMethodsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const originalMethodIds = new Set(
				(params.defaultValues?.methods ?? []).flatMap((method) =>
					method?.id ? [method.id] : [],
				),
			);
			const originalPausedAtById = new Map(
				(params.defaultValues?.methods ?? []).flatMap((method) =>
					method?.id ? [[method.id, method.pausedAt ?? null] as const] : [],
				),
			);

			for (const method of values.methods) {
				originalMethodIds.delete(method.id);

				evolu.upsert("paymentDefaultMethod", {
					id: method.id,
					type: method.type,
					accountId: method.accountId as never,
					pausedAt:
						method.status === PaymentDefaultMethodStatus.Paused
							? ((originalPausedAtById.get(method.id) ??
									TimestampMs(Date.now())) as never)
							: null,
				});
			}

			for (const methodId of originalMethodIds) {
				evolu.update("paymentDefaultMethod", {
					id: methodId,
					isDeleted: sqliteTrue,
				});
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
