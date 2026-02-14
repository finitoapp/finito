import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
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

const createComponents = (t: TFunction) => createAutoFormLayout(itemSchema, ({ builder }) => ({
	...builder.magicInput("id").text({
		type: "hidden",
	}),
	...builder.magicInput("label").text({
		label: t("items:form.item-form.label.label"),
	}),
	...builder.line({
		...builder.magicInput("priceValue").amount({
			label: t("items:form.item-form.label.price"),
			placeholder: t("items:form.item-form.placeholder.0"),
			type: "number",
			currencyFieldName: "currency",
		}),
		...builder.magicInput("priceCurrency").select({
			values: Currency,
			allowEmpty: true,
			label: t("items:form.item-form.label.currency"),
		}),
	}),
	...builder.magicInput("unitOfMeasure").text({
		label: t("items:form.item-form.label.unit-of-measure-uom-optional"),
	}),
	...builder.createComponent("categoryId", (props) => {
		const evolu = useEvolu();
		const ComboboxInput = useMemo(
			() =>
				createComboboxInput({
					label: t("items:form.item-form.label.category-optional"),
					placeholder: t("items:form.item-form.placeholder.select-a-category"),
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
			label: t("items:form.item-form.label.product-code-optional"),
		}),
		...builder.magicInput("productCodeType").select({
			values: ProductCodeType,
			allowEmpty: false,
			label: t("items:form.item-form.label.type"),
		}),
	}),
	...builder.magicInput("internalCode").text({
		label: t("items:form.item-form.label.internal-code-sku-optional"),
	}),
}));

export const ItemForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof itemSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(itemDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
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
