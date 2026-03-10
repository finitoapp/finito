import { createId, createRandomBytes, type Id } from "@evolu/common";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { addressFormSchema } from "@/app/admin/(private)/contacts/contact-form";
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
import { TableIdSchema } from "@/lib/evolu/types";
import {
	BoolToSqliteBoolSchema,
	CountryCode,
	EmailSchema,
	IdentificationNumberCzSchema,
	NonEmptyString255Schema,
	StringToNullableStringSchema,
} from "@/lib/shared/types";

export const baseBillingInfoFormSchema = z.object({
	id: TableIdSchema,
	name: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	label: StringToNullableStringSchema.pipe(NonEmptyString255Schema.nullable()),
	email: StringToNullableStringSchema.pipe(EmailSchema.nullable()),
	address: addressFormSchema,
	countryCode: z.enum(CountryCode),
	cz: z.object({
		vatPayer: BoolToSqliteBoolSchema,
		vatNumber: StringToNullableStringSchema.pipe(
			NonEmptyString255Schema.nullable(),
		),
		identificationNumber: StringToNullableStringSchema.pipe(
			NonEmptyString255Schema.nullable(),
		),
		caseNumber: StringToNullableStringSchema.pipe(
			NonEmptyString255Schema.nullable(),
		),
	}),
});

const billingInfoFormSchema = z.discriminatedUnion("countryCode", [
	baseBillingInfoFormSchema.extend({
		countryCode: z.literal(CountryCode.CZ),
		cz: z.discriminatedUnion("vatPayer", [
			z.object({
				vatPayer: z.literal(true),
				vatNumber: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
				identificationNumber: StringToNullableStringSchema.pipe(
					IdentificationNumberCzSchema,
				),
				caseNumber: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
			}),
			z.object({
				vatPayer: z.literal(false),
				vatNumber: StringToNullableStringSchema.pipe(
					NonEmptyString255Schema.nullable(),
				),
				identificationNumber: StringToNullableStringSchema.pipe(
					IdentificationNumberCzSchema.nullable(),
				),
				caseNumber: StringToNullableStringSchema.pipe(
					NonEmptyString255Schema.nullable(),
				),
			}),
		]),
	}),
]);

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

export const createBillingInfoFormDefaultValues = () =>
	({
		id: createId(createIdDeps),
		name: "",
		label: "",
		email: "",
		address: {
			street: "",
			city: "",
			postalCode: "",
			descriptiveNumber: "",
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

const createComponents = (t: TFunction) =>
	createAutoFormLayout(billingInfoFormSchema, ({ builder }) => ({
		_search: Search,
		_separator: () => <Separator />,

		...builder.magicInput("id").text({
			type: "hidden",
		}),
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
		...builder.magicInput("countryCode").select({
			values: CountryCode,
			allowEmpty: false,
			label: t("settings:form.billing-info-form.label.country-code"),
		}),
		...builder.nestedField("cz", ({ builder }) => ({
			...builder.when("countryCode", CountryCode.CZ, {
				...builder.magicInput("identificationNumber").text({
					label: t(
						"settings:form.billing-info-form.label.identification-number",
					),
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
	}));

export const BillingInfoForm: React.FC<{
	defaultValues?: Partial<z.input<typeof billingInfoFormSchema>>;
	onBeforeSave?: (values: z.output<typeof billingInfoFormSchema>) => boolean;
	onSuccess?: (newEventId: Id) => unknown;
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

			const { address, cz, ...client } = values;

			evolu.upsert("client", {
				id: client.id,
				name: client.name,
				label: client.label,
				email: client.email,
				countryCode: client.countryCode,
			});

			if (values.address) {
				evolu.upsert("clientAddress", {
					id: client.id,
					...address,
				});
			}

			evolu.upsert("clientCz", {
				id: client.id,
				...cz,
				vatPayer: BoolToSqliteBoolSchema.decode(cz.vatPayer),
			});

			if (params.onSuccess) {
				params.onSuccess(values.id);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
