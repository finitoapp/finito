import { createId, createRandomBytes } from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useAtomValue } from "jotai";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { accountAtom } from "@/atoms/account";
import { AutoForm, createAutoFormLayout } from "@/components/auto-form";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { createContact } from "@/lib/contact/service";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	EmailSchema,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const contactFormSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	internalName: StringToNullableStringSchema.pipe(
		NonEmptyString255Schema.nullable(),
	),
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	lud16: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createContactFormDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		name: "",
		internalName: "",
		npub: "",
		lud16: "",
	}) satisfies z.input<typeof contactFormSchema>;

const createComponents = (t: TFunction) =>
	createAutoFormLayout(contactFormSchema, ({ builder }) => ({
		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),
		...builder.magicInput("name").text({
			label: t("contacts:form.contact-form.label.contact-name"),
		}),
		...builder.magicInput("internalName").text({
			label: t("contacts:form.contact-form.label.label"),
			description: t(
				"contacts:form.contact-form.description.your-private-name-for-internal-purposes",
			),
		}),
		...builder.magicInput("npub").text({
			label: t("settings:form.credentials-form.label.npub"),
		}),
		...builder.magicInput("lud16").text({
			label: t("settings:form.account-form.label.lud16-address"),
			type: "email",
		}),
	}));

export const ContactForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof contactFormSchema>>;
	onSuccess?: (contactId: string) => unknown;
}> = (props) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createContactFormDefaultValues(), props.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const account = useAtomValue(accountAtom);
	const components = useMemo(() => createComponents(t), [t]);

	const form = useActionForm(contactFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			createContact({ evolu })({
				contact: {
					id: values.id,
					deviceId: values.deviceId ?? account.device.id,
					name: values.name,
					label: values.internalName,
					email: null,
					phone: null,
					...(values.lud16
						? {
								account: {
									id: values.id,
									name: null,
									lud16: {
										lud16: values.lud16,
									},
								},
							}
						: {}),
					...(values.npub
						? {
								nostr: {
									id: values.id,
									name: null,
									npub: values.npub,
								},
							}
						: {}),
				},
			});

			props.onSuccess?.(values.id);
		},
	});

	useEffect(() => {
		form.form.setFocus("name");
	}, [form.form]);

	return (
		<AutoForm
			form={form}
			components={components}
			saveClassName={"w-full h-10"}
		/>
	);
};
