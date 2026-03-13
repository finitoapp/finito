import { createId, createRandomBytes, sqliteTrue } from "@evolu/common";
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
import { type Id, TableIdSchema } from "@/lib/evolu/types";
import {
	NonEmptyString255Schema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";

const tableSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	label: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	numberOfSeats: StringToNumberSchema.pipe(PositiveIntegerSchema),
	codes: z
		.object({
			id: TableIdSchema,
			code: StringToUndefinedStringSchema.pipe(NonEmptyString255Schema),
		})
		.array()
		.readonly(),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createTableDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		numberOfSeats: "1",
		label: "",
		codes: [],
	}) satisfies z.input<typeof tableSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(tableSchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),
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
				defaultValue: () => ({
					id: createId(createIdDeps),
					code: "",
				}),
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
				...builder.magicInput("id").hidden(undefined),
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
		return merge(createTableDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(tableSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const { codes, ...table } = values;

			evolu.upsert("table", table);

			const originalCodes = new Set(
				(params.defaultValues?.codes ?? []).map((code) => code.id),
			);
			for (const code of codes) {
				if (code.id) {
					originalCodes.delete(code.id);
				}

				evolu.upsert("tableCode", {
					...code,
					id: code.id ?? createId(createIdDeps),
					tableId: table.id,
				});
			}

			for (const id of originalCodes) {
				if (id) {
					evolu.update("tableCode", {
						id,
						isDeleted: sqliteTrue,
					});
				}
			}

			if (params.onSuccess) {
				params.onSuccess(table.id);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
