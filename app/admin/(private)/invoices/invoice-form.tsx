import {
	createId,
	createIdFromString,
	createRandomBytes,
	getOrThrow,
	type Id,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { addDays } from "date-fns";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import {
	ClientForm,
	clientFormSchema,
} from "@/app/admin/(private)/clients/client-form";
import {
	BillingInfoForm,
	type billingInfoFormSchema,
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
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { nestObjectSkipNullBranches } from "@/lib/shared/utils/object";
import { AddressSchema } from "@/lib/shared/schemas";
import {
	Currency,
	DateToDateStringSchema,
	FiatCurrency,
	IbanSchema,
	NonEmptyStringSchema,
	StringToNullableStringSchema,
	StringToNumberSchema,
	StringToUndefinedStringSchema,
	Uuid7,
	Uuid7Schema,
} from "@/lib/shared/types";
import { InvoiceStatus } from "@/lib/evolu/model/invoice-status";
import { InvoicePaymentMethod } from "@/lib/evolu/model/invoice";

const BillingInfoFormSchema = clientFormSchema;

const ClientFormSchema = clientFormSchema;

const itemSchema = z.object({
	id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
	invoiceId: StringToNullableStringSchema.pipe(Uuid7Schema),
	invoiceNumber: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
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
		billingInfo: BillingInfoFormSchema,
	}),

	customer: z.object({
		billingInfo: ClientFormSchema,
	}),

	items: z
		.object({
			id: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema.optional()),
			label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			unitOfMeasure: StringToNullableStringSchema.pipe(
				NonEmptyStringSchema.nullable(),
			),
			price: StringToNumberSchema,
			quantity: StringToNumberSchema,
		})
		.array(),
});

const itemDefaultValues = {
	id: "",
	label: "",
	price: "0",
	quantity: "1",
	unitOfMeasure: "",
};

const createDefaultValues = () => {
	const now = new Date();

	return {
		id: "",
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

		items: [itemDefaultValues],
	} satisfies z.input<typeof itemSchema>;
};

const CustomerEditForm = (
	props: EditComponentProps<z.output<typeof ClientFormSchema>>,
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
						// @ts-expect-error
						defaultValues={props.defaultValue}
						onBeforeSave={(values) => {
							// @ts-expect-error
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
	// @ts-expect-error
	props: EditComponentProps<z.output<typeof billingInfoFormSchema>>,
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
						// @ts-expect-error
						defaultValues={props.defaultValue}
						// @ts-expect-error
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
	z.output<typeof ClientFormSchema> | null
> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();

	const query = useCreateQuery((db) => {
		return db
			.selectFrom("client")
			.leftJoin("clientAddress", "clientAddress.id", "client.id")
			.leftJoin("clientCz", "clientCz.id", "client.id")
			.select([
				"client.id as id",
				"client.name as name",
				"client.label as label",
				"client.email as email",
				"client.countryCode as countryCode",
				"clientAddress.street as address.street",
				"clientAddress.descriptiveNumber as address.descriptiveNumber",
				"clientAddress.city as address.city",
				"clientAddress.postalCode as address.postalCode",
				"clientCz.identificationNumber as cz.identificationNumber",
				"clientCz.vatNumber as cz.vatNumber",
				"clientCz.caseNumber as cz.caseNumber",
			])
			.where("client.isDeleted", "is not", sqliteTrue);
	}, []);

	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: t("invoices:form.invoice-form.label.customer"),
				enableAdd: true,
				formatCustomValue: (value) => {
					return value.name;
				},
				// @ts-expect-error
				fetchItems: async () => {
					const items = await evolu
						.loadQuery(query)
						.then((rows) => rows.map(nestObjectSkipNullBranches));

					console.log("ite2ms", items);

					return items.map((item) => ({
						label: item.label ?? item.name,
						value: {
							...item,
							email: item.email ?? "",
							label: item.label ?? "",
							cz: {
								vatNumber: item.cz.vatNumber ?? "",
								identificationNumber: item.cz.identificationNumber ?? "",
								caseNumber: item.cz.caseNumber ?? "",
							},
						},
					}));
				},
				EditComponent: CustomerEditForm,
			}),
		[evolu],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const SupplierBillingInfo: AutoFormComponent<
	z.output<typeof BillingInfoFormSchema> | null
> = (props) => {
	const { t } = useTranslation();
	const evolu = useEvolu();

	const query = useCreateQuery((db) => {
		return db
			.selectFrom("billingInfo")
			.leftJoin("billingInfoAddress", "billingInfoAddress.id", "billingInfo.id")
			.leftJoin("billingInfoCz", "billingInfoCz.id", "billingInfo.id")
			.select([
				"billingInfo.id as id",
				"billingInfo.name as name",
				"billingInfo.label as label",
				"billingInfo.email as email",
				"billingInfo.countryCode as countryCode",
				"billingInfoAddress.street as address.street",
				"billingInfoAddress.descriptiveNumber as address.descriptiveNumber",
				"billingInfoAddress.city as address.city",
				"billingInfoAddress.postalCode as address.postalCode",
				"billingInfoCz.vatPayer as cz.vatPayer",
				"billingInfoCz.identificationNumber as cz.identificationNumber",
				"billingInfoCz.vatNumber as cz.vatNumber",
				"billingInfoCz.caseNumber as cz.caseNumber",
			])
			.where("billingInfo.isDeleted", "is not", sqliteTrue)
			.where("billingInfo.id", "=", createIdFromString(""));
	}, []);

	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: t("invoices:form.invoice-form.label.supplier"),
				formatCustomValue: (value) => {
					return value.name;
				},
				fetchItems: async () => {
					const items = await evolu
						.loadQuery(query)
						.then((rows) => rows.map(nestObjectSkipNullBranches));

					const item = items[0];

					console.log("ite3", item);

					return item !== undefined
						? [
								{
									label: item.label ?? item.name,
									value: {
										...item,
										email: item.email ?? "",
										label: item.label ?? "",
										cz: {
											vatPayer: item.cz.vatPayer === sqliteTrue,
											vatNumber: item.cz.vatNumber ?? "",
											identificationNumber: item.cz.identificationNumber ?? "",
											caseNumber: item.cz.caseNumber ?? "",
										},
									},
								},
							]
						: [];
				},
				// @ts-expect-error
				EditComponent: SupplierEditForm,
			}),
		[evolu],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const createComponents = (t: TFunction) => createAutoFormLayout(itemSchema, ({ builder }) => {
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
								...builder.createComponent("billingInfo", SupplierBillingInfo),
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
						defaultValue: itemDefaultValues,
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
	defaultValues?: PartialDeep<z.input<typeof itemSchema>>;
	onSuccess?: (newEventId: Id, values: z.output<typeof itemSchema>) => unknown;
}> = (params) => {
	const { t } = useTranslation();
	const [defaultValues] = useState(() => {
		return merge(createDefaultValues(), params.defaultValues ?? {});
	});
	const evolu = useEvolu();
	const components = useMemo(() => createComponents(t), [t]);
	const form = useActionForm(itemSchema, {
		defaultValues,
		saveAction: async (values) => {
			const createIdDeps = {
				randomBytes: createRandomBytes(),
			};

			const id = values.id ?? createId(createIdDeps);

			const { items, customer, supplier, payment, ...invoice } = values;
			console.log("InvoiceForm:saveAction", { values, invoice });

			getOrThrow(
				evolu.upsert("invoice", {
					id,
					invoiceId: invoice.invoiceId,
					invoiceNumber: invoice.invoiceNumber,
					issueDate: invoice.issueDate,
					dueDate: invoice.dueDate,
					currency: invoice.currency,
					paymentMethod: payment.method,
					paymentIban: payment.iban,
				}),
			);

			{
				const { address, cz, ...billingInfo } = customer.billingInfo;
				getOrThrow(
					evolu.upsert("invoiceCustomerBillingInfo", {
						...billingInfo,
						id,
					}),
				);
				getOrThrow(
					evolu.upsert("invoiceCustomerBillingInfoAddress", {
						...address,
						id,
					}),
				);
				getOrThrow(
					evolu.upsert("invoiceCustomerBillingInfoCz", {
						...cz,
						id,
					}),
				);
			}

			{
				const { address, cz, ...billingInfo } = supplier.billingInfo;
				getOrThrow(
					evolu.upsert("invoiceSupplierBillingInfo", {
						...billingInfo,
						id,
					}),
				);
				getOrThrow(
					evolu.upsert("invoiceSupplierBillingInfoAddress", {
						...address,
						id,
					}),
				);
				getOrThrow(
					evolu.upsert("invoiceSupplierBillingInfoCz", {
						...cz,
						vatPayer: cz.vatPayer ? sqliteTrue : sqliteFalse,
						id,
					}),
				);
			}

			if (!values.id) {
				getOrThrow(
					evolu.upsert("invoiceStatus", {
						id,
						status: InvoiceStatus.Unpaid,
					}),
				);
			}

			const originalItems = new Set(
				(params.defaultValues?.items ?? []).map(
					(item) => (item as any).id as Id,
				),
			);

			for (const item of items) {
				const itemId = (item as any).id ?? createId(createIdDeps);
				originalItems.delete(itemId);

				getOrThrow(
					evolu.upsert("invoiceItem", {
						id: itemId,
						invoiceId: id,
						label: item.label,
						price: item.price,
						quantity: item.quantity,
						unitOfMeasure: item.unitOfMeasure,
					}),
				);
			}

			for (const itemId of originalItems) {
				if (itemId) {
					getOrThrow(
						evolu.update("invoiceItem", {
							id: itemId,
							isDeleted: sqliteTrue,
						}),
					);
				}
			}

			if (params.onSuccess) {
				params.onSuccess(id as Id, values);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
