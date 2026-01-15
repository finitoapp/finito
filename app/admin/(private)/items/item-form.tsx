import type React from "react";
import { v7 } from "uuid";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useNostr } from "@/hooks/use-nostr";
import {
	Currency,
	NonEmptyStringSchema,
	ProductCodeType,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { itemStorage } from "@/storages/item-storage";

const itemSchema = z.object({
	price: StringToNumberSchema,
	currency: z.enum(Currency).nullable().pipe(z.enum(Currency)),
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	unitOfMeasure: StringToUndefinedStringSchema.pipe(
		NonEmptyStringSchema.optional(),
	),
	productCodeType: z.enum(ProductCodeType),
	productCode: StringToUndefinedStringSchema.pipe(
		NonEmptyStringSchema.optional(),
	),
	internalCode: StringToUndefinedStringSchema.pipe(
		NonEmptyStringSchema.optional(),
	),
});

const itemDefaultValues = {
	price: "",
	currency: null,
	label: "",
	unitOfMeasure: "",
	productCodeType: ProductCodeType.EAN,
	productCode: "",
	internalCode: "",
} satisfies z.input<typeof itemSchema>;

const components = createAutoFormLayout(itemSchema, ({ builder }) => ({
	...builder.magicInput("label").text({
		label: "Label",
	}),
	...builder.line({
		...builder.magicInput("price").amount({
			label: "Price",
			placeholder: "0",
			type: "number",
			currencyFieldName: "currency",
		}),
		...builder.magicInput("currency").select({
			values: Currency,
			allowEmpty: true,
			label: "Currency",
		}),
	}),
	...builder.magicInput("unitOfMeasure").text({
		label: "Unit of Measure (UOM) (optional)",
	}),
	...builder.line({
		...builder.magicInput("productCode").text({
			label: "Product code (optional)",
		}),
		...builder.magicInput("productCodeType").select({
			values: ProductCodeType,
			allowEmpty: false,
			label: "Type",
		}),
	}),
	...builder.magicInput("internalCode").text({
		label: "Internal code (SKU) (optional)",
	}),
}));

export const ItemForm: React.FC<{
	defaultValues?: Partial<z.input<typeof itemSchema> & { id: string }>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const { ndk } = useNostr();
	const form = useActionForm(itemSchema, {
		defaultValues: {
			...itemDefaultValues,
			...(params.defaultValues ?? {}),
		},
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: v7();

			const { eventId } = await itemStorage.insertOrUpdate({ ndk }, id, {
				id,
				...values,
				price: {
					value: values.price,
					currency: values.currency,
				},
				productCode: values.productCode
					? {
							type: values.productCodeType,
							code: values.productCode,
						}
					: undefined,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
