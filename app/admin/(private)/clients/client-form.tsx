import {
	createId,
	createRandomBytes,
	getOrThrow,
	type Id,
} from "@evolu/common";
import { merge, omit } from "es-toolkit";
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
import { assertNever } from "@/lib/shared/utils/type";
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
			descriptiveNumber: string;
		}
	>;

export const baseClientFormSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	name: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
	label: StringToNullableStringSchema.pipe(NonEmptyStringSchema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
	address: createClientAddressFormSchema({ optional: true }),
	countryCode: z.enum(CountryCode),
	cz: z.object({
		vatNumber: z.string(),
		identificationNumber: z.string(),
	}),
});

export const clientFormSchema = z.discriminatedUnion("countryCode", [
	baseClientFormSchema.extend({
		countryCode: z.literal(CountryCode.CZ),
		cz: z.object({
			vatNumber: StringToNullableStringSchema.pipe(
				NonEmptyStringSchema.nullable(),
			),
			identificationNumber: StringToNullableStringSchema.pipe(
				IdentificationNumberCzSchema.nullable(),
			),
		}),
	}),
]);

export const createClientFormDefaultValues = () =>
	({
		id: "",
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
			vatNumber: "",
			identificationNumber: "",
		},
	}) satisfies z.input<typeof clientFormSchema>;

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
		setValue("countryCode", CountryCode.CZ);
		setValue("cz.identificationNumber", value.identificationNumber);
		setValue("cz.vatNumber", value.vatNumber);
		setValue("address.street", value.address.street);
		setValue("address.city", value.address.city);
		setValue("address.postalCode", value.address.postalCode);
		setValue("address.descriptiveNumber", value.address.descriptiveNumber);
	}, [value, setValue]);

	return <AutocompleteIdentificationNumberInput {...props} />;
};

const createComponents = (t: TFunction) => createAutoFormLayout(clientFormSchema, ({ builder }) => ({
	_search: Search,
	_separator: () => <Separator />,

	...builder.magicInput("id").text({
		type: "hidden",
	}),
	...builder.magicInput("name").text({
		label: t("clients:form.client-form.label.company-name"),
	}),
	...builder.magicInput("label").text({
		label: t("clients:form.client-form.label.label"),
		description: t(
			"clients:form.client-form.description.your-private-name-for-internal-purposes",
		),
	}),
	...builder.magicInput("email").text({
		label: t("clients:form.client-form.label.email"),
	}),
	...builder.nestedField("address", ({ builder }) => {
		return {
			...builder.magicInput("street").text({
				label: t("clients:form.client-form.label.street"),
			}),
			...builder.magicInput("descriptiveNumber").text({
				label: t("clients:form.client-form.label.descriptive-number"),
			}),
			...builder.magicInput("city").text({
				label: t("clients:form.client-form.label.city"),
			}),
			...builder.magicInput("postalCode").text({
				label: t("clients:form.client-form.label.postal-code"),
			}),
		};
	}),

	...builder.magicInput("countryCode").select({
		values: CountryCode,
		allowEmpty: false,
		label: t("clients:form.client-form.label.country-code"),
	}),

	...builder.nestedField("cz", ({ builder }) => ({
		...builder.when("countryCode", CountryCode.CZ, {
			...builder.magicInput("identificationNumber").text({
				label: t("clients:form.client-form.label.identification-number"),
			}),
			...builder.magicInput("vatNumber").text({
				label: t("clients:form.client-form.label.vat-number"),
			}),
		}),
	})),
}));

export const ClientForm: React.FC<{
	defaultValues?: Partial<z.input<typeof clientFormSchema>>;
	onBeforeSave?: (values: z.output<typeof clientFormSchema>) => boolean;
	onSuccess?: (newEventId: Id) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createClientFormDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(clientFormSchema, {
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
			const id = values.id ?? createId(createIdDeps);
			const { address, ...valuesCopy } = omit(values, ["cz"]);

			getOrThrow(
				evolu.upsert(
					"client",
					{
						...valuesCopy,
						id,
					},
					{
						onComplete: () => {
							if (params.onSuccess) {
								params.onSuccess(id as Id);
							}
						},
					},
				),
			);

			getOrThrow(
				evolu.upsert("clientAddress", {
					...address,
					id,
				}),
			);

			if (values.countryCode === CountryCode.CZ) {
				getOrThrow(
					evolu.upsert("clientCz", {
						id,
						...values.cz,
					}),
				);
			} else {
				assertNever(values.countryCode);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
