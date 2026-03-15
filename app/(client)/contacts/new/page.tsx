"use client";

import { createId, createRandomBytes } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { accountAtom } from "@/atoms/account";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useEvolu } from "@/hooks/use-evolu";
import {
	EmailSchema,
	NonEmptyString255Schema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

const newContactSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	internalName: StringToNullableStringSchema.pipe(
		NonEmptyString255Schema.nullable(),
	),
	npub: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	lud16: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
});

type NewContactFormValues = z.input<typeof newContactSchema>;
type NewContactFormErrors = Partial<
	Record<keyof NewContactFormValues, string[] | undefined>
>;

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const evolu = useEvolu();
	const account = useAtomValue(accountAtom);
	const [values, setValues] = useState<NewContactFormValues>({
		name: "",
		internalName: "",
		npub: "",
		lud16: "",
	});
	const [errors, setErrors] = useState<NewContactFormErrors>({});

	const { mutate: createContact, isPending } = useMutation({
		mutationFn: async () => {
			const result = newContactSchema.safeParse(values);
			if (!result.success) {
				setErrors(result.error.flatten().fieldErrors);
				return;
			}

			setErrors({});

			const contactId = createId({
				randomBytes: createRandomBytes(),
			});

			const contactAccountId = createId({
				randomBytes: createRandomBytes(),
			});

			evolu.upsert("contact", {
				id: contactId,
				deviceId: account.device.id,
				name: result.data.name,
				label: result.data.internalName,
				email: null,
				phone: null,
			});
			if (result.data.lud16) {
				evolu.upsert("contactAccount", {
					id: contactAccountId,
					contactId: contactId,
					deviceId: account.device.id,
					_tag: "accountLud16",
				});
				evolu.upsert("contactAccountLud16", {
					id: contactAccountId,
					lud16: result.data.lud16,
				});
			}
			if (result.data.npub) {
				evolu.insert("contactNostr", {
					contactId,
					npub: result.data.npub,
					name: result.data.name,
				});
			}

			router.push("/contacts");
		},
	});

	const updateValue = (field: keyof NewContactFormValues, value: string) => {
		setValues((currentValue) => ({
			...currentValue,
			[field]: value,
		}));
		setErrors((currentErrors) => ({
			...currentErrors,
			[field]: undefined,
		}));
	};

	const isSubmitDisabled = isPending || values.name.trim() === "";

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("contacts:page.newContact")} />

			<div className={"w-full px-8 flex flex-col gap-6"}>
				<Field>
					<FieldLabel>
						{t("contacts:form.contact-form.label.contact-name")}
					</FieldLabel>
					<Input
						autoFocus
						value={values.name}
						onChange={(event) => updateValue("name", event.target.value)}
					/>
					<FieldError errors={errors.name?.map((message) => ({ message }))} />
				</Field>

				<Field>
					<FieldLabel>{t("contacts:form.contact-form.label.label")}</FieldLabel>
					<FieldDescription>
						{t(
							"contacts:form.contact-form.description.your-private-name-for-internal-purposes",
						)}
					</FieldDescription>
					<Input
						value={values.internalName}
						onChange={(event) =>
							updateValue("internalName", event.target.value)
						}
					/>
					<FieldError
						errors={errors.internalName?.map((message) => ({ message }))}
					/>
				</Field>

				<Field>
					<FieldLabel>
						{t("settings:form.credentials-form.label.npub")}
					</FieldLabel>
					<Input
						value={values.npub}
						onChange={(event) => updateValue("npub", event.target.value)}
					/>
					<FieldError errors={errors.npub?.map((message) => ({ message }))} />
				</Field>

				<Field>
					<FieldLabel>
						{t("settings:form.account-form.label.lud16-address")}
					</FieldLabel>
					<Input
						inputMode="email"
						value={values.lud16}
						onChange={(event) => updateValue("lud16", event.target.value)}
					/>
					<FieldError errors={errors.lud16?.map((message) => ({ message }))} />
				</Field>

				<Button
					size={"lg"}
					disabled={isSubmitDisabled}
					onClick={() => createContact()}
				>
					{isPending && <Spinner data-icon="inline-start" />}
					{t("components:autoForm.actions.save")}
				</Button>
			</div>
		</div>
	);
}
