import { merge } from "es-toolkit";
import { BitcoinIcon } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import {
	Currency,
	EmailSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	type Uuid7,
} from "@/lib/types";
import { accountStorage } from "@/storages/account-storage";

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

const components = createAutoFormLayout(staticPaymentSchema, ({ builder }) => ({
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
			const storageDeps = useStorageDeps();
			const ComboboxInput = useMemo(
				() =>
					createComboboxOrTextInput<string>({
						label: "lud16 wallet address with `Lightning Zaps` support",
						fetchItems: async () => {
							const items = await accountStorage.select(storageDeps);

							return items.data
								.filter((item) => item.value._tag === "lud16")
								.map((item) => ({
									label:
										item.value._tag === "lud16"
											? `${item.value.lud16} (${item.value.name})`
											: "-",
									value: item.value._tag === "lud16" ? item.value.lud16 : "-",
								}));
						},
					}),
				[storageDeps],
			);

			return <ComboboxInput {...props} />;
		}),
	}),

	...builder.when("type", (value) => value === "lnSpark", {
		...builder.createComponent("accountId", (props) => {
			const storageDeps = useStorageDeps();
			const ComboboxInput = useMemo(
				() =>
					createComboboxOrTextInput<string>({
						label: "Spark wallet account",
						fetchItems: async () => {
							const items = await accountStorage.select(storageDeps);

							return items.data
								.filter((item) => item.value._tag === "spark")
								.map((item) => ({
									label: item.value._tag === "spark" ? item.value.name : "-",
									value: item.value._tag === "spark" ? item.value.id : "-",
								}));
						},
					}),
				[storageDeps],
			);

			return <ComboboxInput {...props} />;
		}),
	}),

	...builder.magicInput("totalAmount").amount({
		label: "Price in BTC",
		type: "number",
		placeholder: "0",
		currency: Currency.BTC,
		computeAmount: {
			sourceAmountFieldName: "totalAmount",
			sourceCurrencyFieldName: "currency",
		},
	}),
	...builder.magicInput("note").textarea({
		label: "Note for recipient (optional)",
	}),
}));

export const PaymentForm: React.FC<{
	defaultValues?: Partial<z.input<typeof staticPaymentSchema> & { id: Uuid7 }>;
	onSave: (values: z.output<typeof staticPaymentSchema>) => unknown;
}> = (params) => {
	console.log("params.defaultValues", params.defaultValues);
	const [defaultValues] = useState(() => {
		return merge(staticPaymentDefaultValues, params.defaultValues ?? {});
	});
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
					<BitcoinIcon /> Create invoice
				</>
			}
		/>
	);
};
