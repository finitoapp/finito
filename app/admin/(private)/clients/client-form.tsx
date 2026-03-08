import { createId, createRandomBytes, type Id } from "@evolu/common";
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
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyString255Schema,
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

export const baseClientFormSchema = z.object({
	id: TableIdSchema,
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	label: StringToNullableStringSchema.pipe(NonEmptyString255Schema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
	address: addressFormSchema,
	countryCode: z.enum(CountryCode),
	cz: z.object({
		vatNumber: z.string(),
		identificationNumber: z.string(),
		caseNumber: z.string(),
	}),
});

export const clientFormSchema = z.discriminatedUnion("countryCode", [
	baseClientFormSchema.extend({
		countryCode: z.literal(CountryCode.CZ),
		cz: z.object({
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

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

export const createClientFormDefaultValues = () =>
	({
		id: createId(createIdDeps),
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
			caseNumber: "",
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

const createComponents = (t: TFunction) =>
	createAutoFormLayout(clientFormSchema, ({ builder }) => ({
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
				...builder.magicInput("caseNumber").text({
					label: t("clients:form.client-form.label.case-number"),
				}),
			}),
		})),
	}));

export const ClientForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof clientFormSchema>>;
	onBeforeSave?: (values: z.input<typeof clientFormSchema>) => boolean;
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
		saveAction: async (values, originalValues) => {
			if (params.onBeforeSave) {
				if (!params.onBeforeSave(originalValues)) {
					return;
				}
			}

			const { address, cz, ...valuesCopy } = values;

			evolu.upsert("client", valuesCopy, {
				onComplete: () => {
					if (params.onSuccess) {
						params.onSuccess(values.id);
					}
				},
			});

			evolu.upsert("clientAddress", {
				...address,
				id: values.id,
			});

			if (values.countryCode === CountryCode.CZ) {
				evolu.upsert("clientCz", {
					...cz,
					id: values.id,
				});
			} else {
				assertNever(values.countryCode);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
