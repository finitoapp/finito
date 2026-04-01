import { createId, createRandomBytes } from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { type Id, TableIdSchema } from "@/lib/evolu/types";
import {
	NonEmptyString255Schema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

const deviceSchema = z.object({
	id: TableIdSchema,
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createDeviceDefaultValues = () =>
	({
		id: createId(createIdDeps),
		name: "",
	}) satisfies z.input<typeof deviceSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(deviceSchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("name").text({
			label: t("devices:form.fields.name.label"),
		}),
	}));

export const DeviceForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof deviceSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() =>
		merge(createDeviceDefaultValues(), params.defaultValues ?? {}),
	);
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(deviceSchema, {
		defaultValues,
		saveAction: async (values) => {
			evolu.upsert("device", values);

			if (params.onSuccess) {
				params.onSuccess(values.id);
			}
		},
	});

	useEffect(() => {
		form.form.setFocus("name");
	}, [form.form]);

	return <AutoForm form={form} components={components} />;
};
