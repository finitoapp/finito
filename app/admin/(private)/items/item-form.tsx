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
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createComboboxInput } from "@/components/combobox-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	Currency,
	NonEmptyStringSchema,
	ProductCodeType,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

const itemSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	priceValue: StringToNumberSchema,
	priceCurrency: z.enum(Currency).nullable().pipe(z.enum(Currency)),
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	unitOfMeasure: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
	categoryId: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
	productCodeType: z.enum(ProductCodeType),
	productCodeValue: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
	internalCode: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
});

const itemDefaultValues = {
	id: "",
	priceValue: "",
	priceCurrency: null,
	label: "",
	unitOfMeasure: "",
	categoryId: "",
	productCodeType: ProductCodeType.EAN,
	productCodeValue: "",
	internalCode: "",
} satisfies z.input<typeof itemSchema>;

const components = createAutoFormLayout(itemSchema, ({ builder }) => ({
	...builder.magicInput("id").text({
		type: "hidden",
	}),
	...builder.magicInput("label").text({
		label: "Label",
	}),
	...builder.line({
		...builder.magicInput("priceValue").amount({
			label: "Price",
			placeholder: "0",
			type: "number",
			currencyFieldName: "currency",
		}),
		...builder.magicInput("priceCurrency").select({
			values: Currency,
			allowEmpty: true,
			label: "Currency",
		}),
	}),
	...builder.magicInput("unitOfMeasure").text({
		label: "Unit of Measure (UOM) (optional)",
	}),
	...builder.createComponent("categoryId", (props) => {
		const evolu = useEvolu();
		const ComboboxInput = useMemo(
			() =>
				createComboboxInput({
					label: "Category (optional)",
					placeholder: "Select a category",
					fetchItems: async () => {
						const items = await evolu.loadQuery(
							evolu.createQuery((db) =>
								db
									.selectFrom("category")
									.select(["category.id as id", "category.name as name"])
									.where("category.isDeleted", "is not", sqliteTrue)
									.orderBy("category.name", "asc"),
							),
						);

						return items.flatMap((item) =>
							item.name === null
								? []
								: [{ label: item.name, value: item.id as string }],
						);
					},
				}),
			[evolu],
		);

		return <ComboboxInput {...props} />;
	}),
	...builder.line({
		...builder.magicInput("productCodeValue").text({
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
	defaultValues?: PartialDeep<z.input<typeof itemSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(itemDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const form = useActionForm(itemSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = values.id ?? createId(createIdDeps);
			getOrThrow(
				evolu.upsert(
					"item",
					{
						...values,
						id,
					},
					{
						onComplete: () => {
							if (params.onSuccess) {
								params.onSuccess(id as Id);
							}
						},
					},
				),
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
