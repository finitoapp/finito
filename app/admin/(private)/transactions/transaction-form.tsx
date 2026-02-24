"use client";

import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";

type AccountTag =
	| "accountIban"
	| "accountLud16"
	| "accountSpark"
	| "accountNwc"
	| "accountCashRegister";

const nullableNonEmptyStringSchema = StringToNullableStringSchema.pipe(
	NonEmptyStringSchema.nullable(),
);

const transactionSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	accountId: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	occurredAt: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	amount: StringToNumberSchema.refine((value) => Number.isInteger(value), {
		message: "Expected integer amount",
	}).refine((value) => value !== 0, {
		message: "Amount must not be zero",
	}),
	note: nullableNonEmptyStringSchema,
	internalTransferGroupId: nullableNonEmptyStringSchema,
	transactionIban: z.object({
		variableSymbol: nullableNonEmptyStringSchema,
		constantSymbol: nullableNonEmptyStringSchema,
		specificSymbol: nullableNonEmptyStringSchema,
		bankReference: nullableNonEmptyStringSchema,
	}),
	transactionLud16: z.object({
		lnInvoice: nullableNonEmptyStringSchema,
		paymentHash: nullableNonEmptyStringSchema,
	}),
	transactionSpark: z.object({
		sparkTransferId: nullableNonEmptyStringSchema,
		lnInvoice: nullableNonEmptyStringSchema,
		preImage: nullableNonEmptyStringSchema,
		paymentHash: nullableNonEmptyStringSchema,
	}),
	transactionNwc: z.object({
		nwcEventId: nullableNonEmptyStringSchema,
		nwcRequestId: nullableNonEmptyStringSchema,
	}),
});

const accountTags = [
	"accountIban",
	"accountLud16",
	"accountSpark",
	"accountNwc",
	"accountCashRegister",
] as const;

const isAccountTag = (value: string): value is AccountTag =>
	accountTags.includes(value as AccountTag);

export const formatDateTimeLocalValue = (date: Date) => {
	const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const itemDefaultValues = {
	id: "",
	accountId: "",
	occurredAt: formatDateTimeLocalValue(new Date()),
	amount: "0",
	note: "",
	internalTransferGroupId: "",
	transactionIban: {
		variableSymbol: "",
		constantSymbol: "",
		specificSymbol: "",
		bankReference: "",
	},
	transactionLud16: {
		lnInvoice: "",
		paymentHash: "",
	},
	transactionSpark: {
		sparkTransferId: "",
		lnInvoice: "",
		preImage: "",
		paymentHash: "",
	},
	transactionNwc: {
		nwcEventId: "",
		nwcRequestId: "",
	},
} satisfies z.input<typeof transactionSchema>;

const createAccountTagLabel = (props: {
	t: ReturnType<typeof useTranslation>["t"];
	tag: string;
}) => {
	if (props.tag === "accountIban") {
		return props.t("transactions:form.transaction-form.tag.account-iban");
	}
	if (props.tag === "accountLud16") {
		return props.t("transactions:form.transaction-form.tag.account-lud16");
	}
	if (props.tag === "accountSpark") {
		return props.t("transactions:form.transaction-form.tag.account-spark");
	}
	if (props.tag === "accountNwc") {
		return props.t("transactions:form.transaction-form.tag.account-nwc");
	}
	if (props.tag === "accountCashRegister") {
		return props.t(
			"transactions:form.transaction-form.tag.account-cash-register",
		);
	}
	return props.tag;
};

const createComponents = (
	t: ReturnType<typeof useTranslation>["t"],
	props: {
		accountOptions: Record<string, string>;
		resolveAccountTag: (accountId: string | null) => AccountTag | null;
	},
) =>
	createAutoFormLayout(transactionSchema, ({ builder }) => ({
		...builder.card(
			{},
			{
				...builder.magicInput("accountId").select({
					label: t("transactions:form.transaction-form.label.account"),
					values: props.accountOptions,
					allowEmpty: true,
					emptyTitle: t(
						"transactions:form.transaction-form.placeholder.select-account",
					),
				}),
				...builder.magicInput("occurredAt").text({
					label: t("transactions:form.transaction-form.label.occurred-at"),
					type: "datetime-local",
				}),
				...builder.magicInput("amount").text({
					label: t("transactions:form.transaction-form.label.amount"),
					type: "number",
				}),
				...builder.magicInput("note").textarea({
					label: t("transactions:form.transaction-form.label.note"),
					rows: 4,
				}),
				...builder.magicInput("internalTransferGroupId").text({
					label: t(
						"transactions:form.transaction-form.label.internal-transfer-group-id",
					),
				}),
			},
		),
		...builder.nestedField("transactionIban", ({ builder }) => ({
			...builder.when(
				"accountId",
				(accountId) => props.resolveAccountTag(accountId) === "accountIban",
				{
					...builder.card(
						{
							title: t("transactions:form.transaction-form.title.iban-details"),
						},
						{
							...builder.magicInput("variableSymbol").text({
								label: t(
									"transactions:form.transaction-form.label.variable-symbol",
								),
							}),
							...builder.magicInput("constantSymbol").text({
								label: t(
									"transactions:form.transaction-form.label.constant-symbol",
								),
							}),
							...builder.magicInput("specificSymbol").text({
								label: t(
									"transactions:form.transaction-form.label.specific-symbol",
								),
							}),
							...builder.magicInput("bankReference").textarea({
								label: t(
									"transactions:form.transaction-form.label.bank-reference",
								),
								rows: 2,
							}),
						},
					),
				},
			),
		})),
		...builder.nestedField("transactionLud16", ({ builder }) => ({
			...builder.when(
				"accountId",
				(accountId) => props.resolveAccountTag(accountId) === "accountLud16",
				{
					...builder.card(
						{
							title: t(
								"transactions:form.transaction-form.title.lud16-details",
							),
						},
						{
							...builder.magicInput("lnInvoice").textarea({
								label: t("transactions:form.transaction-form.label.ln-invoice"),
								rows: 2,
							}),
							...builder.magicInput("paymentHash").text({
								label: t(
									"transactions:form.transaction-form.label.payment-hash",
								),
							}),
						},
					),
				},
			),
		})),
		...builder.nestedField("transactionSpark", ({ builder }) => ({
			...builder.when(
				"accountId",
				(accountId) => props.resolveAccountTag(accountId) === "accountSpark",
				{
					...builder.card(
						{
							title: t(
								"transactions:form.transaction-form.title.spark-details",
							),
						},
						{
							...builder.magicInput("sparkTransferId").text({
								label: t(
									"transactions:form.transaction-form.label.spark-transfer-id",
								),
							}),
							...builder.magicInput("lnInvoice").textarea({
								label: t("transactions:form.transaction-form.label.ln-invoice"),
								rows: 2,
							}),
							...builder.magicInput("preImage").text({
								label: t("transactions:form.transaction-form.label.pre-image"),
							}),
							...builder.magicInput("paymentHash").text({
								label: t(
									"transactions:form.transaction-form.label.payment-hash",
								),
							}),
						},
					),
				},
			),
		})),
		...builder.nestedField("transactionNwc", ({ builder }) => ({
			...builder.when(
				"accountId",
				(accountId) => props.resolveAccountTag(accountId) === "accountNwc",
				{
					...builder.card(
						{
							title: t("transactions:form.transaction-form.title.nwc-details"),
						},
						{
							...builder.magicInput("nwcEventId").text({
								label: t(
									"transactions:form.transaction-form.label.nwc-event-id",
								),
							}),
							...builder.magicInput("nwcRequestId").text({
								label: t(
									"transactions:form.transaction-form.label.nwc-request-id",
								),
							}),
						},
					),
				},
			),
		})),
	}));

export const TransactionForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof transactionSchema>>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(itemDefaultValues, params.defaultValues ?? {});
	});

	const accountsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("account")
				.select([
					"account.id as id",
					"account.name as name",
					"account._tag as _tag",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.orderBy("account.name", "asc"),
		[],
	);
	const { data: accountRows } = useEvoluQuery(accountsQuery);

	const accountTagById = useMemo(() => {
		const result = new Map<string, AccountTag>();
		for (const row of accountRows ?? []) {
			if (row._tag !== null && isAccountTag(row._tag)) {
				result.set(row.id, row._tag);
			}
		}
		return result;
	}, [accountRows]);

	const accountOptions = useMemo<Record<string, string>>(() => {
		const result: Record<string, string> = {};
		for (const row of accountRows ?? []) {
			const tagLabel = row._tag
				? createAccountTagLabel({ t, tag: row._tag })
				: "-";
			result[row.id] = `${row.name} (${tagLabel})`;
		}
		return result;
	}, [accountRows, t]);

	const components = useMemo(
		() =>
			createComponents(t, {
				accountOptions,
				resolveAccountTag: (accountId) =>
					accountId === null ? null : (accountTagById.get(accountId) ?? null),
			}),
		[t, accountOptions, accountTagById],
	);

	const form = useActionForm(transactionSchema, {
		defaultValues,
		saveAction: async (values) => {
			const accountTag = accountTagById.get(values.accountId);
			if (!accountTag) {
				throw new Error("Selected account has unsupported type");
			}

			const occurredAt = new Date(values.occurredAt).getTime();
			if (!Number.isFinite(occurredAt)) {
				throw new Error("Invalid occurredAt date");
			}

			const id = values.id ?? createId({ randomBytes: createRandomBytes() });

			getOrThrow(
				evolu.upsert(
					"transaction",
					{
						id,
						accountId: values.accountId as unknown as Id,
						_tag: accountTag,
						amount: values.amount,
						occurredAt,
						note: values.note,
						internalTransferGroupId: values.internalTransferGroupId,
					},
					{
						onComplete: () => {
							params.onSuccess?.(id);
						},
					},
				),
			);

			if (accountTag === "accountIban") {
				getOrThrow(
					evolu.upsert("transactionIban", {
						id,
						variableSymbol: values.transactionIban.variableSymbol,
						constantSymbol: values.transactionIban.constantSymbol,
						specificSymbol: values.transactionIban.specificSymbol,
						bankReference: values.transactionIban.bankReference,
					}),
				);
				return;
			}

			if (accountTag === "accountLud16") {
				getOrThrow(
					evolu.upsert("transactionLud16", {
						id,
						lnInvoice: values.transactionLud16.lnInvoice,
						paymentHash: values.transactionLud16.paymentHash,
					}),
				);
				return;
			}

			if (accountTag === "accountSpark") {
				const { sparkTransferId, lnInvoice, preImage, paymentHash } =
					values.transactionSpark;
				if (
					sparkTransferId === null ||
					lnInvoice === null ||
					preImage === null ||
					paymentHash === null
				) {
					throw new Error("Spark transaction fields are required");
				}

				getOrThrow(
					evolu.upsert("transactionSpark", {
						id,
						sparkTransferId,
						lnInvoice,
						preImage,
						paymentHash,
					}),
				);
				return;
			}

			if (accountTag === "accountNwc") {
				getOrThrow(
					evolu.upsert("transactionNwc", {
						id,
						nwcEventId: values.transactionNwc.nwcEventId,
						nwcRequestId: values.transactionNwc.nwcRequestId,
					}),
				);
				return;
			}

			getOrThrow(
				evolu.upsert("transactionCashRegister", {
					id,
				}),
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
