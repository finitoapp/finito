import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { createEvoluComboboxInput } from "@/components/combobox-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { createActiveCategoriesQuery } from "@/lib/evolu/queries/category";
import {
	Currency,
	NonEmptyStringSchema,
	ProductCodeType,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const itemSchema = z
	.object({
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
	})
	.transform((values) => ({
		...values,
		priceValue: moneyCodec.parse({
			value: values.priceValue.toString(),
			currency: values.priceCurrency,
		}).value,
	}));

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

const createComponents = (t: TFunction) => {
	const CategoryComboboxInput = createEvoluComboboxInput({
		label: t("items:form.item-form.label.category-optional"),
		placeholder: t("items:form.item-form.placeholder.select-a-category"),
		createQuery: createActiveCategoriesQuery,
		mapRowsToItems: (rows) =>
			rows.flatMap((row) =>
				row.name === null ? [] : [{ label: row.name, value: row.id as string }],
			),
	});

	return createAutoFormLayout(itemSchema, ({ builder }) => ({
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
			return <CategoryComboboxInput {...props} />;
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
};

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
