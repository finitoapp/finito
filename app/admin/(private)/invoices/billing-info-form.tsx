import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type React from "react";
import { useMemo, useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
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
import { type Address, AddressSchema } from "@/lib/shared/schemas";
import {
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToUndefinedStringSchema,
} from "@/lib/shared/types";

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
		descriptiveNumber: string;
	}
> =>
	z
		.object({
			street: StringToUndefinedStringSchema,
			city: StringToUndefinedStringSchema,
			postalCode: StringToUndefinedStringSchema,
			descriptiveNumber: StringToUndefinedStringSchema,
		})
		.transform((values) =>
			values.city ||
			values.street ||
			values.postalCode ||
			values.descriptiveNumber
				? values
				: undefined,
		)
		.pipe(
			props.optional ? AddressSchema.optional() : AddressSchema,
		) as z.Schema<
		TOptional extends true ? Address | undefined : Address,
		{
			street: string;
			city: string;
			postalCode: string;
			descriptiveNumber: string;
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
			descriptiveNumber: "",
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

const createComponents = (t: TFunction) => createAutoFormLayout(
	billingInfoFormSchema,
	({ builder }) => ({
		_search: Search,
		_separator: () => <Separator />,

		...builder.magicInput("name").text({
			label: t("invoices:form.billing-info-form.label.company-name"),
		}),
		...builder.magicInput("label").text({
			label: t("invoices:form.billing-info-form.label.label"),
			description: t(
				"invoices:form.billing-info-form.description.your-private-name-for-internal-purposes",
			),
		}),
		...builder.magicInput("email").text({
			label: t("invoices:form.billing-info-form.label.email"),
		}),
		...builder.nestedField("address", ({ builder }) => {
			return {
				...builder.magicInput("street").text({
					label: t("invoices:form.billing-info-form.label.street"),
				}),
				...builder.magicInput("city").text({
					label: t("invoices:form.billing-info-form.label.city"),
				}),
				...builder.magicInput("postalCode").text({
					label: t("invoices:form.billing-info-form.label.postal-code"),
				}),
				...builder.magicInput("descriptiveNumber").text({
					label: t("invoices:form.billing-info-form.label.descriptive-number"),
				}),
			};
		}),
		...builder.nestedField("countrySpecific", ({ builder }) => ({
			...builder.magicInput("countryCode").select({
				values: CountryCode,
				allowEmpty: true,
				label: t("invoices:form.billing-info-form.label.country-code"),
			}),
			...builder.when("countrySpecific.countryCode", CountryCode.CZ, {
				...builder.magicInput("identificationNumber").text({
					label: t("invoices:form.billing-info-form.label.identification-number"),
				}),
				...builder.magicInput("vatNumber").text({
					label: t("invoices:form.billing-info-form.label.vat-number"),
				}),
			}),
		})),
	}),
);

export const BillingInfoForm: React.FC<{
	defaultValues?: Partial<z.input<typeof billingInfoFormSchema> & { id: Id }>;
	onBeforeSave?: (values: z.output<typeof billingInfoFormSchema>) => boolean;
	onSuccess?: (newEventId: string) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(
			createBillingInfoFormDefaultValues(),
			params.defaultValues ?? {},
		);
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(billingInfoFormSchema, {
		defaultValues,
		saveAction: async (values) => {
			if (params.onBeforeSave) {
				if (!params.onBeforeSave(values)) {
					return;
				}
			}

			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};
			const id = params.defaultValues?.id ?? createId(createIdDeps);

			getOrThrow(
				evolu.upsert("client", {
					id,
					name: values.name,
					label: values.label ?? null,
					email: values.email ?? null,
					countryCode: values.countrySpecific.countryCode,
				}),
			);

			if (values.address) {
				getOrThrow(
					evolu.upsert("clientAddress", {
						id,
						street: values.address.street,
						descriptiveNumber: values.address.descriptiveNumber,
						city: values.address.city,
						postalCode: values.address.postalCode,
					}),
				);
			}

			getOrThrow(
				evolu.upsert("clientCz", {
					id,
					identificationNumber:
						values.countrySpecific.identificationNumber ?? null,
					vatNumber: values.countrySpecific.vatNumber ?? null,
					caseNumber: null,
				}),
			);

			if (params.onSuccess) {
				params.onSuccess(id);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
