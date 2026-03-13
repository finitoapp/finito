import { createId, createRandomBytes, type Id } from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	NonEmptyString255Schema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

const categorySchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createCategoryDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		name: "",
	}) satisfies z.input<typeof categorySchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(categorySchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),
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
		return merge(createCategoryDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(categorySchema, {
		defaultValues,
		saveAction: async (values) => {
			evolu.upsert("category", values, {
				onComplete: () => {
					if (params.onSuccess) {
						params.onSuccess(values.id);
					}
				},
			});
		},
	});

	return <AutoForm form={form} components={components} />;
};
