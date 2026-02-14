import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import {
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

const categorySchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
});

const categoryDefaultValues = {
	id: "",
	name: "",
} satisfies z.input<typeof categorySchema>;

const createComponents = (t: TFunction) => createAutoFormLayout(categorySchema, ({ builder }) => ({
	...builder.magicInput("id").text({
		type: "hidden",
	}),
	...builder.magicInput("name").text({
		label: t("categories:form.category-form.label.name"),
	}),
}));

export const CategoryForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof categorySchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(categoryDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(categorySchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = values.id ?? createId(createIdDeps);
			getOrThrow(
				evolu.upsert(
					"category",
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
