import {
	createId,
	createRandomBytes,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import {
	AutoForm,
	type AutoFormComponent,
	createAutoFormLayout,
} from "@/components/auto-form";
import {
	AutocompleteIdentificationNumberInput,
	type AutocompleteIdentificationNumberItem,
} from "@/components/autocomplete-identification-number-input";
import { Separator } from "@/components/ui/separator";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { AddressSchema } from "@/lib/evolu/model/payment";
import { TableIdSchema } from "@/lib/evolu/types";
import {
	BoolToSqliteBoolSchema,
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyString255Schema,
	PhoneSchema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";
import { assertNever } from "@/lib/shared/utils/type";

export const addressFormSchema = z
	.object({
		street: StringToNullableStringSchema,
		city: StringToNullableStringSchema,
		postalCode: StringToNullableStringSchema,
		descriptiveNumber: StringToNullableStringSchema,
	})
	.pipe(AddressSchema);

const billingInfoFormSchema = z.discriminatedUnion("countryCode", [
	z.object({
		countryCode: z.literal(CountryCode.CZ),
		cz: z.object({
			vatPayer: BoolToSqliteBoolSchema.nullable(),
			vatNumber: StringToNullableStringSchema.pipe(
				NonEmptyString255Schema.nullable(),
			),
			caseNumber: StringToNullableStringSchema.pipe(
				NonEmptyString255Schema.nullable(),
			),
			identificationNumber: StringToNullableStringSchema.pipe(
				IdentificationNumberCzSchema.nullable(),
			),
		}),
	}),
]);

export const contactFormSchema = z.object({
	id: TableIdSchema,
	sourceContactId: TableIdSchema.nullable(),
	deviceId: TableIdSchema.nullable(),
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	label: StringToNullableStringSchema.pipe(NonEmptyString255Schema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
	phone: StringToNullableStringSchema.pipe(PhoneSchema.nullable()),
	address: addressFormSchema,
	billingInfo: billingInfoFormSchema,
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

export const createContactFormDefaultValues = () =>
	({
		id: createId(createIdDeps),
		deviceId: null,
		sourceContactId: null,
		name: "",
		label: "",
		email: "",
		phone: "",
		address: {
			street: "",
			descriptiveNumber: "",
			city: "",
			postalCode: "",
		},
		billingInfo: {
			countryCode: CountryCode.CZ,
			cz: {
				vatPayer: null,
				vatNumber: "",
				identificationNumber: "",
				caseNumber: "",
			},
		},
	}) satisfies z.input<typeof contactFormSchema>;

export const mapContactToFormContact = (
	contact: Omit<
		z.output<typeof contactFormSchema>,
		"address" | "billingInfo" | "deviceId" | "sourceContactId"
	> & {
		address: z.output<typeof addressFormSchema> | null;
		billingInfo:
			| (Omit<z.output<typeof billingInfoFormSchema>, "cz"> & {
					cz: z.output<typeof billingInfoFormSchema>["cz"] | null;
			  })
			| null;
	},
): z.input<typeof contactFormSchema> =>
	merge(createContactFormDefaultValues(), {
		...contact,
		label: contact.label ?? "",
		email: contact.email ?? "",
		phone: contact.phone ?? "",
		address: contact.address
			? {
					street: contact.address.street ?? "",
					descriptiveNumber: contact.address.descriptiveNumber ?? "",
					city: contact.address.city ?? "",
					postalCode: contact.address.postalCode ?? "",
				}
			: undefined,
		billingInfo: contact.billingInfo
			? {
					countryCode: contact.billingInfo.countryCode ?? CountryCode.CZ,
					cz: contact.billingInfo.cz
						? {
								...contact.billingInfo.cz,
								vatPayer:
									contact.billingInfo.cz.vatPayer === null
										? null
										: contact.billingInfo.cz.vatPayer === sqliteTrue,
								vatNumber: contact.billingInfo.cz.vatNumber ?? "",
								identificationNumber:
									contact.billingInfo.cz.identificationNumber ?? "",
								caseNumber: contact.billingInfo.cz.caseNumber ?? "",
							}
						: undefined,
				}
			: undefined,
	});

const Search: AutoFormComponent<AutocompleteIdentificationNumberItem> = (
	props,
) => {
	const value = useWatch({
		control: props.control,
		name: "_search",
	}) as AutocompleteIdentificationNumberItem | undefined;
	const { setValue } = useFormContext();

	useEffect(() => {
		if (value === undefined) {
			return;
		}

		setValue("name", value.name);
		setValue("billingInfo.countryCode", CountryCode.CZ);
		setValue("billingInfo.cz.identificationNumber", value.identificationNumber);
		setValue("billingInfo.cz.vatNumber", value.vatNumber);
		setValue("address.street", value.address.street);
		setValue("address.city", value.address.city);
		setValue("address.postalCode", value.address.postalCode);
		setValue("address.descriptiveNumber", value.address.descriptiveNumber);
	}, [value, setValue]);

	return <AutocompleteIdentificationNumberInput {...props} />;
};

const createComponents = (t: TFunction) =>
	createAutoFormLayout(contactFormSchema, ({ builder }) => ({
		_search: Search,
		_separator: () => <Separator />,

		...builder.magicInput("id").hidden(undefined),
		...builder.magicInput("deviceId").hidden(undefined),
		...builder.magicInput("sourceContactId").hidden(undefined),
		...builder.magicInput("name").text({
			label: t("contacts:form.contact-form.label.contact-name"),
		}),
		...builder.magicInput("label").text({
			label: t("contacts:form.contact-form.label.label"),
			description: t(
				"contacts:form.contact-form.description.your-private-name-for-internal-purposes",
			),
		}),
		...builder.magicInput("email").text({
			label: t("contacts:form.contact-form.label.email"),
		}),
		...builder.magicInput("phone").text({
			label: t("contacts:form.contact-form.label.phone"),
		}),
		...builder.nestedField("address", ({ builder }) => {
			return {
				...builder.magicInput("street").text({
					label: t("contacts:form.contact-form.label.street"),
				}),
				...builder.magicInput("descriptiveNumber").text({
					label: t("contacts:form.contact-form.label.descriptive-number"),
				}),
				...builder.magicInput("city").text({
					label: t("contacts:form.contact-form.label.city"),
				}),
				...builder.magicInput("postalCode").text({
					label: t("contacts:form.contact-form.label.postal-code"),
				}),
			};
		}),

		...builder.nestedField("billingInfo", ({ builder }) => ({
			...builder.magicInput("countryCode").select({
				values: CountryCode,
				allowEmpty: false,
				label: t("contacts:form.contact-form.label.country-code"),
			}),

			...builder.nestedField("cz", ({ builder }) => ({
				...builder.when("billingInfo.countryCode", CountryCode.CZ, {
					...builder.magicInput("vatPayer").nullableSwitch({
						label: t("contacts:form.contact-form.label.vat-payer"),
					}),
					...builder.magicInput("identificationNumber").text({
						label: t("contacts:form.contact-form.label.identification-number"),
					}),
					...builder.magicInput("vatNumber").text({
						label: t("contacts:form.contact-form.label.vat-number"),
					}),
					...builder.magicInput("caseNumber").text({
						label: t("contacts:form.contact-form.label.case-number"),
					}),
				}),
			})),
		})),
	}));

export const ContactForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof contactFormSchema>>;
	onBeforeSave?: (values: z.input<typeof contactFormSchema>) => boolean;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createContactFormDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(contactFormSchema, {
		defaultValues,
		saveAction: async (values, originalValues) => {
			if (params.onBeforeSave) {
				if (!params.onBeforeSave(originalValues)) {
					return;
				}
			}

			const {
				address,
				billingInfo: { cz, ...billingInfo },
				...valuesCopy
			} = values;

			evolu.upsert("contact", valuesCopy);

			evolu.upsert("contactAddress", {
				...address,
				id: values.id,
			});

			if (billingInfo.countryCode === CountryCode.CZ) {
				evolu.upsert("contactBillingInfo", {
					...billingInfo,
					id: values.id,
				});
				evolu.upsert("contactBillingInfoCz", {
					...cz,
					id: values.id,
				});
			} else {
				assertNever(billingInfo.countryCode);
			}

			if (params.onSuccess) {
				params.onSuccess(values.id);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
