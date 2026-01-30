import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type React from "react";
import { useEffect, useState } from "react";
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

export const billingInfoFormComponents = createAutoFormLayout(
	billingInfoFormSchema,
	({ builder }) => ({
		_search: Search,
		_separator: () => <Separator />,

		...builder.magicInput("name").text({
			label: "Company name",
		}),
		...builder.magicInput("label").text({
			label: "Label",
			description: "Your private name for internal purposes",
		}),
		...builder.magicInput("email").text({
			label: "Email",
		}),
		...builder.nestedField("address", ({ builder }) => {
			return {
				...builder.magicInput("street").text({
					label: "Street",
				}),
				...builder.magicInput("descriptiveNumber").text({
					label: "Descriptive Number",
				}),
				...builder.magicInput("city").text({
					label: "City",
				}),
				...builder.magicInput("postalCode").text({
					label: "Postal Code",
				}),
			};
		}),
		...builder.magicInput("countryCode").select({
			values: CountryCode,
			allowEmpty: false,
			label: "Country code",
		}),
		...builder.nestedField("cz", ({ builder }) => ({
			...builder.when("countryCode", CountryCode.CZ, {
				...builder.magicInput("identificationNumber").text({
					label: "Identification Number",
				}),
				...builder.magicInput("vatPayer").checkbox({
					label: "VAT Payer",
				}),
				...builder.magicInput("vatNumber").text({
					label: "VAT Number",
				}),
				...builder.magicInput("caseNumber").textarea({
					label: "Case Number",
				}),
			}),
		})),
	}),
);

export const BillingInfoForm: React.FC<{
	defaultValues?: Partial<z.input<typeof billingInfoFormSchema> & { id: Id }>;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(createBillingInfoDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
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

	return <AutoForm form={form} components={billingInfoFormComponents} />;
};
