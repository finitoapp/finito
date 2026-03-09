import {
	createId,
	createRandomBytes,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { BitcoinIcon } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { useNostr } from "@/hooks/use-nostr";
import { createQuery } from "@/lib/evolu";
import { TableIdSchema } from "@/lib/evolu/types";
import { createPayment } from "@/lib/payment/service";
import {
	Currency,
	EmailSchema,
	type NonNegativeInteger,
	NumberStringSchema,
	StringToNullableStringSchema,
	type Uuid7,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const baseStaticPaymentSchema = z.object({
	id: TableIdSchema,
	totalAmount: StringToNullableStringSchema.pipe(NumberStringSchema),
	lud16: z.string(),
	accountId: TableIdSchema.nullable(),
	note: z.string(),
});

const staticPaymentSchema = z
	.discriminatedUnion("type", [
		baseStaticPaymentSchema.extend({
			type: z.literal("lnZap"),
			accountId: TableIdSchema.nullable().pipe(TableIdSchema),
			lud16: StringToNullableStringSchema.pipe(EmailSchema),
		}),
		baseStaticPaymentSchema.extend({
			type: z.literal("lnSpark"),
			accountId: TableIdSchema.nullable().pipe(TableIdSchema),
		}),
	])
	.transform((values) => ({
		...values,
		totalAmount: moneyCodec.parse({
			value: values.totalAmount,
			currency: Currency.BTC,
		}).value,
	}));

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createStaticPaymentDefaultValues = () =>
	({
		id: createId(createIdDeps),
		type: "lnSpark",
		lud16: "",
		accountId: null,
		totalAmount: "",
		note: "",
	}) satisfies z.input<typeof staticPaymentSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
		...builder.magicInput("id").text({
			type: "hidden",
		}),
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
									createQuery((db) =>
										db
											.selectFrom("account")
											.leftJoin("accountLud16", "accountLud16.id", "account.id")
											.select([
												"account.name as name",
												"accountLud16.lud16 as lud16",
											] as const)
											.where("account.isDeleted", "is not", sqliteTrue)
											.where("account.name", "is not", null)
											.where("accountLud16.lud16", "is not", null)
											.where("account._tag", "=", "accountLud16")
											.$narrowType<{
												name: KyselyNotNull;
												lud16: KyselyNotNull;
											}>(),
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
						createComboboxOrTextInput<string | null>({
							label: t("payments:form.payment-form.label.spark-wallet-account"),
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

		...builder.magicInput("totalAmount").text({
			label: t("payments:form.payment-form.label.price-in-btc"),
			placeholder: t("payments:form.payment-form.placeholder.0"),
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
	const { ndk } = useNostr();
	const evolu = useEvolu();
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(
			createStaticPaymentDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(staticPaymentSchema, {
		defaultValues,
		saveAction: async (values) => {
			await createPayment({
				ndk,
				evolu,
				payment: {
					id: values.id,
					currency: Currency.BTC,
				},
				totalAmount: values.totalAmount as NonNegativeInteger,
				tipAmount: null,
				paymentLnZap:
					values.type === "lnZap"
						? {
								accountId: values.accountId,
								amount: values.totalAmount as NonNegativeInteger,
							}
						: undefined,
				paymentLnSpark:
					values.type === "lnSpark"
						? {
								accountId: values.accountId,
								amount: values.totalAmount as NonNegativeInteger,
							}
						: undefined,
			});

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
					<BitcoinIcon />{" "}
					{t("payments:form.payment-form.save-label.create-invoice")}
				</>
			}
		/>
	);
};
