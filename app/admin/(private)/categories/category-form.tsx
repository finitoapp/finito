import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useState } from "react";
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

const components = createAutoFormLayout(categorySchema, ({ builder }) => ({
	...builder.magicInput("id").text({
		type: "hidden",
	}),
	...builder.magicInput("name").text({
		label: "Name",
	}),
}));

export const CategoryForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof categorySchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(categoryDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
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
