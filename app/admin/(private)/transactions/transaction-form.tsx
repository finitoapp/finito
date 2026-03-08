import { createId, createRandomBytes, sqliteTrue } from "@evolu/common";
import { merge } from "es-toolkit";
import type { NotNull } from "kysely";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	ConstantSymbolSchema,
	Currency,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	NumberStringSchema,
	SpecificSymbolSchema,
	StringToNullableStringSchema,
	VariableSymbolSchema,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

type AccountTag =
	| "accountIban"
	| "accountLud16"
	| "accountSpark"
	| "accountNwc"
	| "accountCashRegister";

const transactionSchema = z.object({
	id: TableIdSchema,
	accountId: z.string().pipe(TableIdSchema),
	occurredAt: z.date(),
	amount: StringToNullableStringSchema.pipe(NumberStringSchema),
	currency: z.enum(Currency),
	note: StringToNullableStringSchema.pipe(NumberStringSchema.nullable()),
	internalTransferGroupId: StringToNullableStringSchema.pipe(
		NonEmptyString255Schema,
	),
	transactionIban: z.object({
		variableSymbol: StringToNullableStringSchema.pipe(VariableSymbolSchema),
		constantSymbol: StringToNullableStringSchema.pipe(ConstantSymbolSchema),
		specificSymbol: StringToNullableStringSchema.pipe(SpecificSymbolSchema),
		bankReference: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	}),
	transactionLud16: z.object({
		lnInvoice: StringToNullableStringSchema.pipe(
			NonEmptyStringSchema.nullable(),
		),
		paymentHash: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	}),
	transactionSpark: z.object({
		sparkTransferId: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		lnInvoice: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		preImage: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		paymentHash: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	}),
	transactionNwc: z.object({
		nwcEventId: StringToNullableStringSchema.pipe(
			NonEmptyStringSchema.nullable(),
		),
		nwcRequestId: StringToNullableStringSchema.pipe(
			NonEmptyStringSchema.nullable(),
		),
	}),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createItemDefaultValues = () =>
	({
		id: createId(createIdDeps),
		accountId: "",
		occurredAt: new Date(),
		amount: "0",
		currency: Currency.USD,
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
	}) satisfies z.input<typeof transactionSchema>;

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
		...builder.magicInput("id").text({
			type: "hidden",
		}),

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
				...builder.magicInput("occurredAt").date({
					label: t("transactions:form.transaction-form.label.occurred-at"),
					type: "datetime-local",
				}),
				...builder.magicInput("amount").text({
					label: t("transactions:form.transaction-form.label.amount"),
					type: "number",
				}),
				...builder.magicInput("currency").select({
					values: Currency,
					allowEmpty: false,
					label: t("transactions:form.transaction-form.label.currency"),
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
		return merge(createItemDefaultValues(), params.defaultValues ?? {});
	});

	const accountsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("account")
					.select([
						"account.id as id",
						"account.name as name",
						"account._tag as _tag",
					] as const)
					.where("account.isDeleted", "is not", sqliteTrue)
					.where("account.name", "is not", null)
					.where("account._tag", "is not", null)
					.orderBy("account.name", "asc")
					.$narrowType<{
						name: NotNull;
						_tag: NotNull;
					}>(),
			),
		[],
	);
	const { data: accountRows } = useEvoluQuery(accountsQuery);

	const accountTagById = useMemo(() => {
		return new Map(accountRows.map((row) => [row.id as string, row._tag]));
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

			evolu.upsert(
				"transaction",
				{
					id,
					accountId: values.accountId,
					_tag: accountTag,
					amount: moneyCodec.decode({
						value: values.amount,
						currency: values.currency,
					}).value,
					currency: values.currency,
					occurredAt,
					note: values.note,
					internalTransferGroupId: values.internalTransferGroupId,
				},
				{
					onComplete: () => {
						params.onSuccess?.(id);
					},
				},
			);

			if (accountTag === "accountIban") {
				evolu.upsert("transactionIban", {
					...values.transactionIban,
					id,
				});
				return;
			}

			if (accountTag === "accountLud16") {
				evolu.upsert("transactionLud16", {
					...values.transactionLud16,
					id,
				});
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

				evolu.upsert("transactionSpark", {
					id,
					sparkTransferId,
					lnInvoice,
					preImage,
					paymentHash,
				});
				return;
			}

			if (accountTag === "accountNwc") {
				evolu.upsert("transactionNwc", {
					id,
					nwcEventId: values.transactionNwc.nwcEventId,
					nwcRequestId: values.transactionNwc.nwcRequestId,
				});
				return;
			}

			evolu.upsert("transactionCashRegister", {
				id,
			});
		},
	});

	return <AutoForm form={form} components={components} />;
};
