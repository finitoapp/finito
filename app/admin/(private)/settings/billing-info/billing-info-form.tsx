import { merge } from "es-toolkit";
import type React from "react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { v7 } from "uuid";
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
import { useNostr } from "@/hooks/use-nostr";
import {
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import type { billingInfoStorage } from "@/storages/billing-info-storage";
import { clientStorage } from "@/storages/client-storage";

const billingInfoAddressFormSchema = createClientAddressFormSchema({
	optional: true,
});

export const billingInfoFormSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	label: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	email: StringToUndefinedStringSchema.pipe(EmailSchema.optional()),
	address: billingInfoAddressFormSchema,
	countrySpecific: z.discriminatedUnion("vatPayer", [
		z.object({
			vatPayer: z.literal(true),
			countryCode: z
				.enum(CountryCode)
				.nullable()
				.pipe(z.literal(CountryCode.CZ)),
			vatNumber: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
			identificationNumber: StringToUndefinedStringSchema.pipe(
				IdentificationNumberCzSchema,
			),
			caseNumber: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
		}),
		z.object({
			vatPayer: z.literal(false),
			countryCode: z
				.enum(CountryCode)
				.nullable()
				.pipe(z.literal(CountryCode.CZ)),
			vatNumber: StringToUndefinedStringSchema.pipe(
				NonEmptyStringSchema.optional(),
			),
			identificationNumber: StringToUndefinedStringSchema.pipe(
				IdentificationNumberCzSchema,
			),
			caseNumber: StringToUndefinedStringSchema.pipe(
				NonEmptyStringSchema.optional(),
			),
		}),
	]),
});

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
		countrySpecific: {
			countryCode: null,
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
		setValue("countrySpecific.countryCode", CountryCode.CZ);
		setValue(
			"countrySpecific.identificationNumber",
			value.identificationNumber,
		);
		setValue("countrySpecific.vatNumber", value.vatNumber);
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
		...builder.nestedField("countrySpecific", ({ builder }) => ({
			...builder.magicInput("countryCode").select({
				values: CountryCode,
				allowEmpty: true,
				label: "Country code",
			}),
			...builder.when("countrySpecific.countryCode", CountryCode.CZ, {
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
	defaultValues?: Partial<
		z.input<typeof billingInfoFormSchema> & { id: string }
	>;
	onSuccess?: (newEventId: string) => unknown;
	customStorage?: typeof billingInfoStorage;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(createBillingInfoDefaultValues(), params.defaultValues ?? {});
	});
	const { ndk } = useNostr();
	const form = useActionForm(billingInfoFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: v7();

			const { eventId } = await (
				params.customStorage ?? clientStorage
			).insertOrUpdate({ ndk }, null, {
				id,
				...values,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	console.log("err", form.form.formState.errors);
	console.log("values", form.form.getValues());

	return <AutoForm form={form} components={billingInfoFormComponents} />;
};
