import { merge } from "es-toolkit";
import type React from "react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { v7 } from "uuid";
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
import { useNostr } from "@/hooks/use-nostr";
import { type Address, AddressSchema } from "@/lib/schemas";
import {
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/types";
import { clientStorage } from "@/storages/client-storage";

export const createClientAddressFormSchema = <
	TOptional extends boolean,
>(props: {
	optional: TOptional;
}): z.Schema<
	TOptional extends true ? Address | undefined : Address,
	{
		street: string;
		city: string;
		postalCode: string;
	}
> =>
	z
		.object({
			street: StringToUndefinedStringSchema,
			city: StringToUndefinedStringSchema,
			postalCode: StringToUndefinedStringSchema,
		})
		.transform((values) =>
			values.city || values.street || values.postalCode ? values : undefined,
		)
		.pipe(
			props.optional ? AddressSchema.optional() : AddressSchema,
		) as z.Schema<
		TOptional extends true ? Address | undefined : Address,
		{
			street: string;
			city: string;
			postalCode: string;
		}
	>;

export const billingInfoFormSchema = z.object({
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	label: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	email: StringToUndefinedStringSchema.pipe(EmailSchema.optional()),
	address: createClientAddressFormSchema({ optional: true }),
	countrySpecific: z.discriminatedUnion("countryCode", [
		z.object({
			countryCode: z
				.enum(CountryCode)
				.nullable()
				.pipe(z.literal(CountryCode.CZ)),
			vatNumber: StringToUndefinedStringSchema.pipe(
				NonEmptyStringSchema.optional(),
			),
			identificationNumber: StringToUndefinedStringSchema.pipe(
				IdentificationNumberCzSchema.optional(),
			),
		}),
	]),
});

export const createBillingInfoFormDefaultValues = () =>
	({
		name: "",
		label: "",
		email: "",
		address: {
			street: "",
			city: "",
			postalCode: "",
		},
		countrySpecific: {
			countryCode: null,
			vatNumber: "",
			identificationNumber: "",
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
		setValue("address.city", value.address.city);
		setValue("address.postalCode", value.address.postalCode);
	}, [value, setValue]);

	return <AutocompleteIdentificationNumberInput {...props} />;
};

const components = createAutoFormLayout(
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
				...builder.magicInput("vatNumber").text({
					label: "VAT Number",
				}),
			}),
		})),
	}),
);

export const BillingInfoForm: React.FC<{
	defaultValues?: Partial<
		z.input<typeof billingInfoFormSchema> & { id: string }
	>;
	onBeforeSave?: (
		values: z.output<typeof billingInfoFormSchema> & { id: string },
	) => boolean;
	onSuccess?: (newEventId: string) => unknown;
	customStorage?: typeof clientStorage;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(
			createBillingInfoFormDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const { ndk } = useNostr();
	const form = useActionForm(billingInfoFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: v7();

			const finalValues = {
				id,
				...values,
			};

			if (params.onBeforeSave) {
				if (!params.onBeforeSave(finalValues)) {
					return;
				}
			}

			const { eventId } = await (
				params.customStorage ?? clientStorage
			).insertOrUpdate(ndk, id, finalValues);

			if (params.onSuccess) {
				params.onSuccess(eventId);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
