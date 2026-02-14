import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
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
import {
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";

const tableSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	numberOfSeats: StringToNumberSchema.pipe(PositiveIntegerSchema),
	codes: z
		.object({
			id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
			code: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
		})
		.array(),
});

const tableDefaultValues = {
	id: "",
	numberOfSeats: "1",
	label: "",
	codes: [],
} satisfies z.input<typeof tableSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(tableSchema, ({ builder }) => ({
		...builder.magicInput("id").text({
			type: "hidden",
		}),
		...builder.magicInput("label").text({
			label: t("tables:form.fields.label.label"),
		}),
		...builder.magicInput("numberOfSeats").text({
			label: t("tables:form.fields.numberOfSeats.label"),
			type: "number",
			placeholder: t("tables:form.table-form.placeholder.0"),
		}),
		...builder.arrayTableField(
			{
				name: "codes",
				addRowLabel: t("tables:form.codes.addRowLabel"),
				defaultValue: {
					id: "",
					code: "",
				},
				columns: [
					{
						hidden: true,
					},
					{
						title: t("tables:form.codes.columns.id"),
					},
				],
			},
			({ builder }) => ({
				...builder.magicInput("id").text({
					type: "hidden",
				}),
				...builder.magicInput("code").text({
					label: t("tables:form.codes.fields.code.label"),
				}),
			}),
		),
	}));

export const TableForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof tableSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(tableDefaultValues, params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(tableSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = values.id ?? createId(createIdDeps);

			const { codes, ...table } = values;

			getOrThrow(
				evolu.upsert(
					"table",
					{
						...table,
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

			const originalCodes = new Set(
				(params.defaultValues?.codes ?? []).map((code) => code.id),
			);
			for (const code of codes) {
				if (code.id) {
					originalCodes.delete(code.id);
				}

				getOrThrow(
					evolu.upsert("tableCode", {
						...code,
						id: code.id ?? createId(createIdDeps),
						tableId: id,
					}),
				);
			}

			console.log("originalCodes", originalCodes);

			for (const id of originalCodes) {
				getOrThrow(
					evolu.update("tableCode", {
						id,
						isDeleted: sqliteTrue,
					}),
				);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
