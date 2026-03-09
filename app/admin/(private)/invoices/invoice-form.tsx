import {
	createId,
	createIdFromString,
	createRandomBytes,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteFalse,
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
	ClientForm,
	clientFormSchema,
} from "@/app/admin/(private)/clients/client-form";
import {
	BillingInfoForm,
	billingInfoFormSchema,
} from "@/app/admin/(private)/settings/billing-info/billing-info-form";
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
import {
	BoolToSqliteBoolSchema,
	Currency,
	DateToDateStringSchema,
	FiatCurrency,
	IbanSchema,
	Integer,
	NonEmptyString32Schema,
	NonEmptyString255Schema,
	NumberStringSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	Uuid7,
	Uuid7Schema,
} from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

const BillingInfoFormSchema = billingInfoFormSchema;

const ClientFormSchema = clientFormSchema;

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

	supplier: z.object({
		billingInfo: BillingInfoFormSchema.nullable().transform(
			(value, ctx): z.output<typeof BillingInfoFormSchema> => {
				if (value === null) {
					ctx.addIssue({
						code: "custom",
						message: "It should be selected",
					});

					return z.NEVER;
				}

				return value;
			},
		),
	}),

	customer: z.object({
		billingInfo: ClientFormSchema.nullable().transform(
			(value, ctx): z.output<typeof ClientFormSchema> => {
				if (value === null) {
					ctx.addIssue({
						code: "custom",
						message: "It should be selected",
					});

					return z.NEVER;
				}

				return value;
			},
		),
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
		invoiceId: Uuid7.random(),
		invoiceNumber: "",
		currency: Currency.CZK,
		issueDate: now,
		dueDate: addDays(now, 14),

		payment: {
			method: InvoicePaymentMethod.Cash,
			iban: "",
		},

		supplier: {
			billingInfo: null,
		},

		customer: {
			billingInfo: null,
		},

		items: [createItemDefaultValues()],
	} satisfies z.input<typeof invoiceSchema>;
};

const CustomerEditForm = (
	props: EditComponentProps<z.input<typeof ClientFormSchema>>,
) => {
	return (
		<Dialog
			open={true}
			onOpenChange={() => props.close()}
			// preventing portal in backdrop issue
			modal={false}
		>
			<DialogContent
				variant={"fullscreen"}
				style={{
					top: "env(safe-area-inset-top)",
					bottom: "env(safe-area-inset-bottom)",
				}}
			>
				<DialogHeader>
					<DialogTitle>Edit billing information</DialogTitle>
				</DialogHeader>

				<ScrollArea>
					<ClientForm
						defaultValues={props.defaultValue}
						onBeforeSave={(values) => {
							props.save(values);
							return false;
						}}
					/>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

const SupplierEditForm = (
	props: EditComponentProps<z.input<typeof BillingInfoFormSchema>>,
) => {
	return (
		<Dialog
			open={true}
			onOpenChange={() => props.close()}
			// preventing portal in backdrop issue
			modal={false}
		>
			<DialogContent
				variant={"fullscreen"}
				style={{
					top: "env(safe-area-inset-top)",
					bottom: "env(safe-area-inset-bottom)",
				}}
			>
				<DialogHeader>
					<DialogTitle>Edit billing information</DialogTitle>
				</DialogHeader>
				<ScrollArea>
					<BillingInfoForm
						defaultValues={props.defaultValue}
						onBeforeSave={(values) => {
							props.save(values);
							return false;
						}}
					/>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

const CustomerBillingInfo: AutoFormComponent<
	z.input<typeof ClientFormSchema> | null
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

					return items.map((item) => ({
						label: item.name,
						value: {
							...item,
							label: item.label ?? "",
							email: item.email ?? "",
							address: {
								...item.address,
								street: item.address.street ?? "",
								city: item.address.city ?? "",
								postalCode: item.address.postalCode ?? "",
								descriptiveNumber: item.address.descriptiveNumber ?? "",
							},
							cz: item.cz
								? {
										...item.cz,
										vatNumber: item.cz.vatNumber ?? "",
										identificationNumber: item.cz.identificationNumber ?? "",
										caseNumber: item.cz.caseNumber ?? "",
									}
								: {
										vatNumber: "",
										identificationNumber: "",
										caseNumber: "",
									},
						},
					}));
				},
				EditComponent: CustomerEditForm,
			}),
		[evolu, query, t],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const SupplierBillingInfo: AutoFormComponent<
	z.input<typeof BillingInfoFormSchema> | null
> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("billingInfo")
					.select((eb) => [
						"billingInfo.id as id",
						"billingInfo.name as name",
						"billingInfo.label as label",
						"billingInfo.email as email",
						"billingInfo.countryCode as countryCode",

						evoluJsonObjectFrom(
							eb
								.selectFrom("billingInfoAddress")
								.select([
									"billingInfoAddress.street as street",
									"billingInfoAddress.descriptiveNumber as descriptiveNumber",
									"billingInfoAddress.city as city",
									"billingInfoAddress.postalCode as postalCode",
								])
								.whereRef("billingInfoAddress.id", "=", "billingInfo.id")
								.where("billingInfoAddress.isDeleted", "is not", sqliteTrue),
						).as("address"),

						evoluJsonObjectFrom(
							eb
								.selectFrom("billingInfoCz")
								.select([
									"billingInfoCz.vatPayer as vatPayer",
									"billingInfoCz.identificationNumber as identificationNumber",
									"billingInfoCz.vatNumber as vatNumber",
									"billingInfoCz.caseNumber as caseNumber",
								])
								.whereRef("billingInfoCz.id", "=", "billingInfo.id")
								.where("billingInfoCz.isDeleted", "is not", sqliteTrue),
						).as("cz"),
					])
					.where("billingInfo.isDeleted", "is not", sqliteTrue)
					.where("billingInfo.id", "=", createIdFromString(""))
					.where("billingInfo.name", "is not", null)
					.where("billingInfo.countryCode", "is not", null)
					.$narrowType<{
						name: KyselyNotNull;
						countryCode: KyselyNotNull;
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

					return item !== undefined
						? [
								{
									label: item.label ?? item.name,
									value: {
										...item,
										label: item.label ?? "",
										email: item.email ?? "",
										address: {
											...item.address,
											street: item.address.street ?? "",
											city: item.address.city ?? "",
											postalCode: item.address.postalCode ?? "",
											descriptiveNumber: item.address.descriptiveNumber ?? "",
										},
										cz: item.cz
											? {
													vatPayer: item.cz.vatPayer === sqliteTrue,
													vatNumber: item.cz.vatNumber ?? "",
													identificationNumber:
														item.cz.identificationNumber ?? "",
													caseNumber: item.cz.caseNumber ?? "",
												}
											: {
													vatPayer: false,
													vatNumber: "",
													identificationNumber: "",
													caseNumber: "",
												},
									},
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
			...builder.magicInput("id").text({
				type: "hidden",
			}),
			...builder.magicInput("invoiceId").text({
				type: "hidden",
			}),

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
							...builder.nestedField("customer", ({ builder }) => ({
								...builder.createComponent("billingInfo", CustomerBillingInfo),
							})),
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
								...builder.nestedField("supplier", ({ builder }) => ({
									...builder.createComponent(
										"billingInfo",
										SupplierBillingInfo,
									),
								})),
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
							...builder.magicInput("id").text({
								type: "hidden",
							}),
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

			evolu.upsert("invoice", {
				id: invoice.id,
				invoiceId: invoice.invoiceId,
				invoiceNumber: invoice.invoiceNumber,
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				currency: invoice.currency,
				paymentMethod: payment.method,
				paymentIban: payment.iban,
			});

			{
				const { address, cz, ...billingInfo } = customer.billingInfo;
				evolu.upsert("invoiceCustomerBillingInfo", {
					...billingInfo,
					id: invoice.id,
				});
				evolu.upsert("invoiceCustomerBillingInfoAddress", {
					...address,
					id: invoice.id,
				});
				evolu.upsert("invoiceCustomerBillingInfoCz", {
					...cz,
					id: invoice.id,
					vatPayer: sqliteFalse,
				});
			}

			{
				const { address, cz, ...billingInfo } = supplier.billingInfo;
				evolu.upsert("invoiceSupplierBillingInfo", {
					...billingInfo,
					id: invoice.id,
				});
				evolu.upsert("invoiceSupplierBillingInfoAddress", {
					...address,
					id: invoice.id,
				});
				evolu.upsert("invoiceSupplierBillingInfoCz", {
					...cz,
					id: invoice.id,
					vatPayer: BoolToSqliteBoolSchema.decode(cz.vatPayer),
				});
			}

			const originalItems = new Set(
				(params.defaultValues?.items ?? []).map((item) => item.id),
			);

			for (const item of items) {
				originalItems.delete(item.id);

				const price = moneyCodec.decode({
					value: item.price,
					currency: invoice.currency,
				}).value;

				evolu.upsert("invoiceItem", {
					id: item.id,
					sourceItemId: null,
					label: item.label,
					price,
					currency: invoice.currency,
					unitOfMeasure: item.unitOfMeasure,
				});
				evolu.upsert("invoiceItemLine", {
					id: item.id,
					invoiceId: invoice.id,
					quantity: item.quantity,
					totalAmount: Integer(Math.round(price * item.quantity)),
				});
			}

			for (const itemId of originalItems) {
				if (itemId) {
					evolu.update("invoiceItem", {
						id: itemId,
						isDeleted: sqliteTrue,
					});
				}
			}

			if (params.onSuccess) {
				params.onSuccess(invoice.id, values);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
