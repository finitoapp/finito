import type React from "react";
import { v7 } from "uuid";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useStorageDeps } from "@/hooks/use-storage-deps";
import {
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { tableStorage } from "@/storages/table-storage";

const tableSchema = z.object({
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	numberOfSeats: StringToNumberSchema.pipe(PositiveIntegerSchema),
	qrCodes: z
		.object({
			id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
		})
		.array(),
});

const tableDefaultValues = {
	numberOfSeats: "1",
	label: "",
	qrCodes: [],
} satisfies z.input<typeof tableSchema>;

const components = createAutoFormLayout(tableSchema, ({ builder }) => ({
	...builder.magicInput("label").text({
		label: "Label",
	}),
	...builder.magicInput("numberOfSeats").text({
		label: "Number of Seats",
		type: "number",
		placeholder: "0",
	}),
	...builder.arrayTableField(
		{
			name: "qrCodes",
			addRowLabel: "Add QR code",
			defaultValue: {
				id: "",
			},
			columns: [
				{
					title: "ID",
				},
			],
		},
		({ builder }) => ({
			...builder.magicInput("id").text({}),
		}),
	),
}));

export const TableForm: React.FC<{
	defaultValues?: Partial<z.input<typeof tableSchema> & { id: string }>;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const storageDeps = useStorageDeps();
	const form = useActionForm(tableSchema, {
		defaultValues: {
			...tableDefaultValues,
			...(params.defaultValues ?? {}),
		},
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: v7();

			const { eventId } = await tableStorage.insertOrUpdate(storageDeps, id, {
				id,
				...values,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
