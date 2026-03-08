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
	EmailSchema,
	NonEmptyStringSchema,
	PositiveIntegerSchema,
	StringToNullableNumberSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const smtpSchema = z.object({
	server: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	port: StringToNullableNumberSchema.pipe(PositiveIntegerSchema),
	credentials: z.object({
		username: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
		password: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	}),
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema),
});

const smtpDefaultValues = {
	server: "",
	port: "587",
	credentials: {
		username: "",
		password: "",
	},
	name: "",
	email: "",
} satisfies z.input<typeof smtpSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(smtpSchema, ({ builder }) => ({
		...builder.magicInput("server").text({
			label: t("settings:form.smtp-form.label.server"),
		}),
		...builder.magicInput("port").text({
			label: t("settings:form.smtp-form.label.port"),
			type: "number",
		}),
		...builder.nestedField("credentials", ({ builder }) => ({
			...builder.magicInput("username").text({
				label: t("settings:form.smtp-form.label.username"),
			}),
			...builder.magicInput("password").text({
				label: t("settings:form.smtp-form.label.password"),
				type: "password",
				copyToClipboard: true,
			}),
		})),
		...builder.magicInput("email").text({
			label: t("settings:form.smtp-form.label.your-e-mail"),
		}),
		...builder.magicInput("name").text({
			label: t("settings:form.smtp-form.label.your-email-name"),
		}),
	}));

export const SmtpForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof smtpSchema>>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const [defaultValues] = useState(() => {
		return merge(smtpDefaultValues, params.defaultValues ?? {});
	});
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(smtpSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			evolu.upsert(
				"smtp",
				{
					id,
					server: values.server,
					port: values.port,
					username: values.credentials.username,
					password: values.credentials.password,
					name: values.name,
					email: values.email,
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
