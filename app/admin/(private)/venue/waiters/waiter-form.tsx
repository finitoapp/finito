import { createId, createRandomBytes, type Id } from "@evolu/common";
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
import { TableIdSchema } from "@/lib/evolu/types";
import {
	NonEmptyString255Schema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

const waiterSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createWaiterDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		name: "",
	}) satisfies z.input<typeof waiterSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(waiterSchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),
		...builder.magicInput("name").text({
			label: t("waiters:form.waiter-form.label.name"),
		}),
	}));

export const WaiterForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof waiterSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createWaiterDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(waiterSchema, {
		defaultValues,
		saveAction: async (values) => {
			evolu.upsert("waiter", values, {
				onComplete: () => {
					if (params.onSuccess) {
						params.onSuccess(values.id);
					}
				},
			});
		},
	});

	useEffect(() => {
		form.form.setFocus("name");
	}, [form.form]);

	return <AutoForm form={form} components={components} />;
};
