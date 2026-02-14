import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type React from "react";
import { useMemo, useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { createClientAddressFormSchema } from "@/app/admin/(private)/clients/client-form";
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
import {
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
} from "@/lib/types";

const billingInfoAddressFormSchema = createClientAddressFormSchema({
	optional: true,
});

export const baseBillingInfoFormSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
	address: billingInfoAddressFormSchema,
	countryCode: z.enum(CountryCode),
	cz: z.object({
		vatPayer: z.boolean(),
		vatNumber: z.string(),
		identificationNumber: z.string(),
		caseNumber: z.string(),
	}),
});

const billingInfoFormSchema = z.discriminatedUnion("countryCode", [
	baseBillingInfoFormSchema.extend({
		countryCode: z.literal(CountryCode.CZ),
		cz: z.discriminatedUnion("vatPayer", [
			z.object({
				vatPayer: z.literal(true),
				vatNumber: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
				identificationNumber: StringToNullableStringSchema.pipe(
					IdentificationNumberCzSchema,
				),
				caseNumber: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			}),
			z.object({
				vatPayer: z.literal(false),
				vatNumber: StringToNullableStringSchema.pipe(
					NonEmptyStringSchema.nullable(),
				),
				identificationNumber: StringToNullableStringSchema.pipe(
					IdentificationNumberCzSchema,
				),
				caseNumber: StringToNullableStringSchema.pipe(
					NonEmptyStringSchema.nullable(),
				),
			}),
		]),
	}),
]);

export const createBillingInfoDefaultValues = () =>
	({
		name: "",
		label: "",
		email: "",
		address: {
			street: "",
			descriptiveNumber: "",
			city: "",
			postalCode: "",
		},
		countryCode: CountryCode.CZ,
		cz: {
			vatPayer: false,
			vatNumber: "",
			identificationNumber: "",
			caseNumber: "",
		},
	}) satisfies z.input<typeof billingInfoFormSchema>;

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
		setValue("cz.countryCode", CountryCode.CZ);
		setValue("cz.identificationNumber", value.identificationNumber);
		setValue("cz.vatNumber", value.vatNumber);
		setValue("address.street", value.address.street);
		setValue("address.descriptiveNumber", value.address.descriptiveNumber);
		setValue("address.city", value.address.city);
		setValue("address.postalCode", value.address.postalCode);
	}, [value, setValue]);

	return <AutocompleteIdentificationNumberInput {...props} />;
};

const createComponents = (t: TFunction) => createAutoFormLayout(
	billingInfoFormSchema,
	({ builder }) => ({
		_search: Search,
		_separator: () => <Separator />,

		...builder.magicInput("name").text({
			label: t("settings:form.billing-info-form.label.company-name"),
		}),
		...builder.magicInput("label").text({
			label: t("settings:form.billing-info-form.label.label"),
			description: t(
				"settings:form.billing-info-form.description.your-private-name-for-internal-purposes",
			),
		}),
		...builder.magicInput("email").text({
			label: t("settings:form.billing-info-form.label.email"),
		}),
		...builder.nestedField("address", ({ builder }) => {
			return {
				...builder.magicInput("street").text({
					label: t("settings:form.billing-info-form.label.street"),
				}),
				...builder.magicInput("descriptiveNumber").text({
					label: t("settings:form.billing-info-form.label.descriptive-number"),
				}),
				...builder.magicInput("city").text({
					label: t("settings:form.billing-info-form.label.city"),
				}),
				...builder.magicInput("postalCode").text({
					label: t("settings:form.billing-info-form.label.postal-code"),
				}),
			};
		}),
		...builder.magicInput("countryCode").select({
			values: CountryCode,
			allowEmpty: false,
			label: t("settings:form.billing-info-form.label.country-code"),
		}),
		...builder.nestedField("cz", ({ builder }) => ({
			...builder.when("countryCode", CountryCode.CZ, {
				...builder.magicInput("identificationNumber").text({
					label: t("settings:form.billing-info-form.label.identification-number"),
				}),
				...builder.magicInput("vatPayer").checkbox({
					label: t("settings:form.billing-info-form.label.vat-payer"),
				}),
				...builder.magicInput("vatNumber").text({
					label: t("settings:form.billing-info-form.label.vat-number"),
				}),
				...builder.magicInput("caseNumber").textarea({
					label: t("settings:form.billing-info-form.label.case-number"),
				}),
			}),
		})),
	}),
);

export const BillingInfoForm: React.FC<{
	defaultValues?: Partial<z.input<typeof billingInfoFormSchema> & { id: Id }>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createBillingInfoDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(billingInfoFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id = createIdFromString("");

			getOrThrow(
				evolu.upsert("billingInfo", {
					id,
					name: values.name,
					label: values.label,
					email: values.email,
					countryCode: values.countryCode,
				}),
			);

			getOrThrow(
				evolu.upsert("billingInfoAddress", {
					id,
					...values.address,
				}),
			);

			getOrThrow(
				evolu.upsert("billingInfoCz", {
					id,
					identificationNumber: values.cz.identificationNumber,
					vatNumber: values.cz.vatNumber,
					caseNumber: values.cz.caseNumber,
					vatPayer: values.cz.vatPayer ? sqliteTrue : sqliteFalse,
				}),
			);

			if (params.onSuccess) {
				params.onSuccess(id);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
