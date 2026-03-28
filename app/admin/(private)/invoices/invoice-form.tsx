import {
	createId,
	createIdFromString,
	createRandomBytes,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { addDays } from "date-fns";
import { merge } from "es-toolkit";
import type { TFunction } from "i18next";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import {
	ContactForm,
	contactFormSchema,
	mapContactToFormContact,
} from "@/app/admin/(private)/contacts/contact-form";
import {
	AutoForm,
	type AutoFormComponent,
	createAutoFormLayout,
} from "@/components/auto-form";
import { AutoformIbanInput } from "@/components/auto-form/autoform-iban";
import type { EditComponentProps } from "@/components/combobox/default";
import { createComboboxOrTextInput } from "@/components/combobox-or-text-input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActionForm } from "@/hooks/use-action-form";
import { useEvolu } from "@/hooks/use-evolu";
import { createQuery } from "@/lib/evolu";
import { InvoicePaymentMethod } from "@/lib/evolu/model/invoice";
import { createGetClientsQuery } from "@/lib/evolu/queries/client";
import { TableIdSchema } from "@/lib/evolu/types";
import { createInvoice } from "@/lib/invoice/service";
import {
	Currency,
	DateToDateStringSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyString32Schema,
	NonEmptyString255Schema,
	NumberStringSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	Uuid7,
	Uuid7Schema,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const ContactFormSchema = contactFormSchema;

const itemSchema = z.object({
	id: TableIdSchema,
	label: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	unitOfMeasure: StringToNullableStringSchema.pipe(
		NonEmptyString32Schema.nullable(),
	),
	price: StringToNullableStringSchema.pipe(NumberStringSchema),
	quantity: StringToNumberSchema,
});

const invoiceSchema = z.object({
	id: TableIdSchema,
	deviceId: TableIdSchema.nullable(),
	invoiceId: StringToNullableStringSchema.pipe(Uuid7Schema),
	invoiceNumber: StringToNullableStringSchema.pipe(NonEmptyString255Schema),
	currency: z.enum(Currency),
	issueDate: DateToDateStringSchema,
	dueDate: DateToDateStringSchema,

	payment: z.discriminatedUnion("method", [
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			iban: StringToNullableStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			iban: StringToNullableStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema.nullable()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
			iban: StringToNullableStringSchema.transform(() => null).pipe(z.null()),
		}),
	]),

	supplier: contactFormSchema
		.nullable()
		.transform((value, ctx): z.output<typeof contactFormSchema> => {
			if (value === null) {
				ctx.addIssue({
					code: "custom",
					message: "It should be selected",
				});

				return z.NEVER;
			}

			return value;
		}),

	customer: contactFormSchema
		.nullable()
		.transform((value, ctx): z.output<typeof contactFormSchema> => {
			if (value === null) {
				ctx.addIssue({
					code: "custom",
					message: "It should be selected",
				});

				return z.NEVER;
			}

			return value;
		}),

	items: itemSchema.array().readonly(),
});

const createIdDeps = {
	randomBytes: createRandomBytes(),
};

const createItemDefaultValues = () =>
	({
		id: createId(createIdDeps),
		label: "",
		price: "0",
		quantity: "1",
		unitOfMeasure: "",
	}) satisfies z.input<typeof itemSchema>;

const createDefaultValues = () => {
	const now = new Date();

	return {
		id: createId(createIdDeps),
		deviceId: null,
		invoiceId: Uuid7.random(),
		invoiceNumber: "",
		currency: Currency.CZK,
		issueDate: now,
		dueDate: addDays(now, 14),

		payment: {
			method: InvoicePaymentMethod.Cash,
			iban: "",
		},

		supplier: null,
		customer: null,

		items: [createItemDefaultValues()],
	} satisfies z.input<typeof invoiceSchema>;
};

const CustomerEditForm = (
	props: EditComponentProps<z.input<typeof ContactFormSchema>>,
) => {
	return (
		<Dialog
			open={true}
			onOpenChange={() => props.close()}
			// preventing portal in backdrop issue
			modal={false}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit billing information</DialogTitle>
				</DialogHeader>

				<ScrollArea>
					<ContactForm
						defaultValues={props.defaultValue}
						onBeforeSave={(values) => {
							props.save({
								...values,
								id: createId(createIdDeps),
								sourceContactId: values.id,
							});
							return false;
						}}
					/>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

const SupplierEditForm = (
	props: EditComponentProps<z.input<typeof ContactFormSchema>>,
) => {
	return (
		<Dialog
			open={true}
			onOpenChange={() => props.close()}
			// preventing portal in backdrop issue
			modal={false}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit billing information</DialogTitle>
				</DialogHeader>
				<ScrollArea>
					<ContactForm
						defaultValues={props.defaultValue}
						onBeforeSave={(values) => {
							props.save({
								...values,
								id: createId(createIdDeps),
								sourceContactId: values.id,
							});
							return false;
						}}
					/>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

const CustomerBillingInfo: AutoFormComponent<
	z.input<typeof ContactFormSchema> | null
> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const query = useMemo(() => createGetClientsQuery(), []);

	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: t("invoices:form.invoice-form.label.customer"),
				enableAdd: true,
				formatCustomValue: (value) => {
					return value.name;
				},
				fetchItems: async () => {
					const items = await evolu.loadQuery(query);

					return items.map((item) => {
						const contact = mapContactToFormContact(item);
						const value = {
							...contact,
							id: createId(createIdDeps),
							sourceContactId: contact.id,
						};

						return {
							label: item.name,
							value,
						};
					});
				},
				EditComponent: CustomerEditForm,
			}),
		[evolu, query, t],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const SupplierBillingInfo: AutoFormComponent<
	z.input<typeof ContactFormSchema> | null
> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("contact")
					.select((eb) => [
						"contact.id as id",
						"contact.name as name",
						"contact.label as label",
						"contact.email as email",
						"contact.phone as phone",

						evoluJsonObjectFrom(
							eb
								.selectFrom("contactAddress")
								.select([
									"contactAddress.street as street",
									"contactAddress.descriptiveNumber as descriptiveNumber",
									"contactAddress.city as city",
									"contactAddress.postalCode as postalCode",
								])
								.whereRef("contactAddress.id", "=", "contactAddress.id")
								.where("contactAddress.isDeleted", "is not", sqliteTrue),
						).as("address"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("contactBillingInfo")
								.select((eb) => [
									"contactBillingInfo.countryCode as countryCode",

									evoluJsonObjectFrom(
										eb
											.selectFrom("billingInfoCz")
											.select([
												"billingInfoCz.vatPayer as vatPayer",
												"billingInfoCz.identificationNumber as identificationNumber",
												"billingInfoCz.vatNumber as vatNumber",
												"billingInfoCz.caseNumber as caseNumber",
											])
											.whereRef("billingInfoCz.id", "=", "contact.id")
											.where("billingInfoCz.isDeleted", "is not", sqliteTrue),
									).as("cz"),
								])
								.whereRef("contactBillingInfo.id", "=", "contact.id")
								.where("contactBillingInfo.isDeleted", "is not", sqliteTrue)
								.where("contactBillingInfo.countryCode", "is not", null)
								.$narrowType<{
									countryCode: KyselyNotNull;
								}>(),
						).as("billingInfo"),
					])
					.where("contact.isDeleted", "is not", sqliteTrue)
					.where("contact.id", "=", createIdFromString(""))
					.where("contact.name", "is not", null)
					.$narrowType<{
						name: KyselyNotNull;
						address: KyselyNotNull;
					}>();
			}),
		[],
	);

	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: t("invoices:form.invoice-form.label.supplier"),
				formatCustomValue: (value) => {
					return value.name;
				},
				fetchItems: async () => {
					const items = await evolu.loadQuery(query);
					const item = items[0];

					const contact = mapContactToFormContact(item);
					const value = {
						...contact,
						id: createId(createIdDeps),
						sourceContactId: contact.id,
					};

					return item !== undefined
						? [
								{
									label: item.label ?? item.name,
									value,
								},
							]
						: [];
				},
				EditComponent: SupplierEditForm,
			}),
		[evolu, query, t],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const createComponents = (t: TFunction) =>
	createAutoFormLayout(invoiceSchema, ({ builder }) => {
		return {
			...builder.magicInput("id").hidden(undefined),
			...builder.magicInput("deviceId").hidden(undefined),
			...builder.magicInput("invoiceId").hidden(undefined),

			...builder.card(
				{
					title: t("invoices:form.invoice-form.title.invoice-info"),
				},
				{
					...builder.line({
						...builder.magicInput("invoiceNumber").text({
							label: t("invoices:form.invoice-form.label.invoice-number"),
						}),
						...builder.line({
							...builder.createComponent("customer", CustomerBillingInfo),
						}),
					}),
					...builder.line({
						...builder.magicInput("issueDate").date({
							label: t("invoices:form.invoice-form.label.issue-date"),
						}),
						...builder.magicInput("dueDate").date({
							label: t("invoices:form.invoice-form.label.due-date"),
						}),
					}),
				},
			),

			...builder.collapsibleSeparator(
				{
					title: t("invoices:form.invoice-form.title.advanced-options"),
					watchErrors: ["supplier", "payment", "currency"],
				},
				{
					...builder.card(
						{},
						{
							...builder.line({
								...builder.createComponent("supplier", SupplierBillingInfo),
								...builder.magicInput("currency").select({
									values: FiatCurrency,
									allowEmpty: false,
									label: t("invoices:form.invoice-form.label.currency"),
								}),
							}),

							...builder.line({
								...builder.nestedField("payment", ({ builder }) => ({
									...builder.magicInput("method").select({
										values: {
											[InvoicePaymentMethod.BankTransfer]: t(
												"invoices:form.invoice-form.payment-method.bank-transfer",
											),
											[InvoicePaymentMethod.PaymentCard]: t(
												"invoices:form.invoice-form.payment-method.payment-card",
											),
											[InvoicePaymentMethod.Cash]: t(
												"invoices:form.invoice-form.payment-method.cash",
											),
										} satisfies Record<InvoicePaymentMethod, string>,
										allowEmpty: false,
										label: t("invoices:form.invoice-form.label.payment-method"),
									}),

									...builder.when(
										"payment.method",
										InvoicePaymentMethod.BankTransfer,
										{
											...builder.createComponent("iban", AutoformIbanInput),
										},
									),
								})),
							}),
						},
					),
				},
			),

			...builder.card(
				{
					title: t("invoices:form.invoice-form.title.items"),
				},
				{
					...builder.arrayTableField(
						{
							name: "items",
							defaultValue: createItemDefaultValues,
							columns: [
								{
									title: t("invoices:form.invoice-form.title.id"),
									hidden: true,
								},
								{
									title: t("invoices:form.invoice-form.title.label"),
								},
								{
									title: t("invoices:form.invoice-form.title.price"),
									className: "w-[130px]",
								},
								{
									title: t("invoices:form.invoice-form.title.quantity"),
									className: "w-[80px]",
								},
								{
									title: t("invoices:form.invoice-form.title.uom"),
									className: "w-[70px]",
								},
							],
						},
						({ builder }) => ({
							...builder.magicInput("id").hidden(undefined),
							...builder.magicInput("label").text({
								label: t("invoices:form.invoice-form.label.label"),
							}),
							...builder.magicInput("price").text({
								label: t("invoices:form.invoice-form.label.price"),
								placeholder: t("invoices:form.invoice-form.placeholder.0"),
							}),
							...builder.magicInput("quantity").text({
								label: t("invoices:form.invoice-form.label.quantity"),
								placeholder: t("invoices:form.invoice-form.placeholder.1"),
								type: "number",
							}),
							...builder.magicInput("unitOfMeasure").text({
								label: t("invoices:form.invoice-form.label.uom"),
							}),
						}),
					),
				},
			),
		};
	});

export const InvoiceForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof invoiceSchema>>;
	onSuccess?: (
		newEventId: Id,
		values: z.output<typeof invoiceSchema>,
	) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(invoiceSchema, {
		defaultValues,
		saveAction: async (values) => {
			const { items, customer, supplier, payment, ...invoice } = values;

			await createInvoice({
				evolu,
			})({
				originalItemLineIds: (params.defaultValues?.items ?? []).map(
					(item) => item.id,
				),
				invoice: {
					id: invoice.id,
					deviceId: invoice.deviceId,
					invoiceId: invoice.invoiceId,
					invoiceNumber: invoice.invoiceNumber,
					issueDate: invoice.issueDate,
					dueDate: invoice.dueDate,
					currency: invoice.currency,
					paymentMethod: payment.method,
					paymentIban: payment.iban,
					items: items.map((item) => {
						const price = moneyCodec.decode({
							value: item.price,
							currency: invoice.currency,
						}).value;

						return {
							id: item.id,
							quantity: item.quantity,
							item: {
								label: item.label,
								price: price,
								currency: invoice.currency,
								unitOfMeasure: item.unitOfMeasure,
								internalCode: null,
								productCodeType: null,
								productCodeValue: null,
								categoryId: null,
								itemId: null,
							},
						};
					}),
					customer,
					supplier,
				},
			});

			if (params.onSuccess) {
				params.onSuccess(invoice.id, values);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
