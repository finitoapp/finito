import { createIdFromString, type Id } from "@evolu/common";
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
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const aiAssistantSettingsFormSchema = z.object({
	googleApiKey: StringToNullableStringSchema.pipe(
		NonEmptyStringSchema.nullable(),
	),
});

const createAiAssistantSettingsDefaultValues = () =>
	({
		googleApiKey: "",
	}) satisfies z.input<typeof aiAssistantSettingsFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(aiAssistantSettingsFormSchema, ({ builder }) => ({
		...builder.magicInput("googleApiKey").text({
			label: t("settings:form.ai-assistant-form.label.google-api-key"),
			description: t(
				"settings:form.ai-assistant-form.description.google-api-key",
			),
			type: "password",
			copyToClipboard: true,
		}),
	}));

export const AiAssistantSettingsForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof aiAssistantSettingsFormSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() =>
		merge(createAiAssistantSettingsDefaultValues(), params.defaultValues ?? {}),
	);
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(aiAssistantSettingsFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"aiAssistantSettings",
				{
					id,
					googleApiKey: values.googleApiKey,
				},
				{
					onComplete: () => {
						if (params.onSuccess) {
							params.onSuccess(id);
						}
					},
				},
			);
		},
	});

	return <AutoForm form={form} components={components} />;
};
