import { sqliteTrue } from "@evolu/common";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { merge } from "es-toolkit";
import { BitcoinIcon } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	Currency,
	EmailSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	type Uuid7,
} from "@/lib/shared/types";

const baseStaticPaymentSchema = z.object({
	totalAmount: StringToNumberSchema,
	lud16: z.string(),
	accountId: z.string(),
	note: z.string(),
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
]);

const staticPaymentDefaultValues = {
	type: "lnSpark",
	lud16: "",
	accountId: "",
	totalAmount: "",
	note: "",
} satisfies z.input<typeof staticPaymentSchema>;

const createComponents = (t: TFunction) => createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
	...builder.magicInput("type").select({
		variant: "toggle",
		allowEmpty: false,
		values: {
			lnSpark: "LN (Spark)",
			lnZap: "LN (Zap)",
		},
	}),

	...builder.when("type", (value) => value === "lnZap", {
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
										.leftJoin("accountLud16", "accountLud16.id", "account.id")
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

	...builder.magicInput("totalAmount").amount({
		label: t("payments:form.payment-form.label.price-in-btc"),
		type: "number",
		placeholder: t("payments:form.payment-form.placeholder.0"),
		currency: Currency.BTC,
		computeAmount: {
			sourceAmountFieldName: "totalAmount",
			sourceCurrencyFieldName: "currency",
		},
	}),
	...builder.magicInput("note").textarea({
		label: t("payments:form.payment-form.label.note-for-recipient-optional"),
	}),
}));

export const PaymentForm: React.FC<{
	defaultValues?: Partial<z.input<typeof staticPaymentSchema> & { id: Uuid7 }>;
	onSave: (values: z.output<typeof staticPaymentSchema>) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(staticPaymentDefaultValues, params.defaultValues ?? {});
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			params.onSave(values);
		},
		onSuccess: () => {},
	});

	return (
		<AutoForm
			form={form}
			components={components}
			saveClassName={"w-full h-10"}
			saveLabel={
				<>
					<BitcoinIcon /> {t("payments:form.payment-form.save-label.create-invoice")}
				</>
			}
		/>
	);
};
