import { addDays } from "date-fns";
import { merge } from "es-toolkit";
import type React from "react";
import { useMemo, useState } from "react";
import type { PartialDeep } from "type-fest";
import { z } from "zod";
import { ClientForm } from "@/app/admin/(private)/clients/client-form";
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
import { useNostr } from "@/hooks/use-nostr";
import { AddressSchema } from "@/lib/schemas";
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
} from "@/lib/types";
import {
	BillingInfoSchema,
	billingInfoStorage,
} from "@/storages/billing-info-storage";
import { ClientSchema, clientStorage } from "@/storages/client-storage";
import {
	InvoiceStatus,
	invoiceStatusStorage,
} from "@/storages/invoice-status-storage";
import {
	InvoicePaymentMethod,
	invoiceStorage,
} from "@/storages/invoice-storage";

const BillingInfoFormSchema = BillingInfoSchema.omit({
	id: true,
	address: true,
}).extend({
	address: AddressSchema,
});

const ClientFormSchema = ClientSchema.omit({
	id: true,
	address: true,
}).extend({
	address: AddressSchema,
});

const itemSchema = z.object({
	invoiceNumber: StringToUndefinedStringSchema.pipe(NonEmptyStringSchema),
	currency: z.enum(Currency).nullable().pipe(z.enum(Currency)),
	issueDate: DateToDateStringSchema,
	dueDate: DateToDateStringSchema,

	payment: z.discriminatedUnion("method", [
		z.object({
			method: z.literal(InvoicePaymentMethod.BankTransfer),
			iban: StringToUndefinedStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.PaymentCard),
			iban: StringToUndefinedStringSchema.transform((value) =>
				value ? value.replace(/ /g, "") : value,
			).pipe(IbanSchema.optional()),
		}),
		z.object({
			method: z.literal(InvoicePaymentMethod.Cash),
			iban: StringToUndefinedStringSchema.transform(() => undefined).pipe(
				z.undefined(),
			),
		}),
	]),

	supplier: z.object({
		billingInfo: BillingInfoFormSchema.nullable().pipe(BillingInfoFormSchema),
	}),

	customer: z.object({
		billingInfo: ClientFormSchema.nullable().pipe(ClientFormSchema),
	}),

	items: z
		.object({
			label: StringToNullableStringSchema.pipe(NonEmptyStringSchema),
			unitOfMeasure: StringToUndefinedStringSchema.pipe(
				NonEmptyStringSchema.optional(),
			),
			price: StringToNumberSchema,
			quantity: StringToNumberSchema,
		})
		.array(),
});

const itemDefaultValues = {
	label: "",
	price: "0",
	quantity: "1",
	unitOfMeasure: "",
};

const createDefaultValues = () => {
	const now = new Date();

	return {
		invoiceNumber: "",
		currency: null,
		issueDate: now,
		dueDate: addDays(now, 14),

		payment: {
			method: InvoicePaymentMethod.BankTransfer,
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
	const { ndk } = useNostr();
	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: "Customer",
				enableAdd: true,
				formatCustomValue: (value) => {
					return value.name;
				},
				// @ts-expect-error
				fetchItems: async () => {
					const items = await clientStorage.select(ndk);

					return items.data.map((item) => ({
						label: item.value.label ?? item.value.name,
						value: item.value,
					}));
				},
				EditComponent: CustomerEditForm,
			}),
		[ndk],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const SupplierBillingInfo: AutoFormComponent<
	z.output<typeof BillingInfoFormSchema> | null
> = (props) => {
	const { ndk } = useNostr();
	const ComboboxInput = useMemo(
		() =>
			createComboboxOrTextInput({
				label: "Supplier",
				formatCustomValue: (value) => {
					return value.name;
				},
				fetchItems: async () => {
					const items = await billingInfoStorage.select(ndk);
					const item = items.data[0];

					return item !== undefined
						? [
								{
									label: item.value.label ?? item.value.name,
									value: item.value,
								},
							]
						: [];
				},
				// @ts-expect-error
				EditComponent: SupplierEditForm,
			}),
		[ndk],
	);

	// @ts-expect-error
	return <ComboboxInput {...props} />;
};

const components = createAutoFormLayout(itemSchema, ({ builder }) => {
	return {
		...builder.card(
			{
				title: "Invoice info",
			},
			{
				...builder.line({
					...builder.magicInput("invoiceNumber").text({
						label: "Invoice number",
					}),
					...builder.line({
						...builder.nestedField("customer", ({ builder }) => ({
							...builder.createComponent("billingInfo", CustomerBillingInfo),
						})),
					}),
				}),
				...builder.line({
					...builder.magicInput("issueDate").date({
						label: "Issue date",
					}),
					...builder.magicInput("dueDate").date({
						label: "Due date",
					}),
				}),
			},
		),

		...builder.collapsibleSeparator(
			{
				title: "Advanced options",
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
								label: "Currency",
							}),
						}),

						...builder.line({
							...builder.nestedField("payment", ({ builder }) => ({
								...builder.magicInput("method").select({
									values: {
										[InvoicePaymentMethod.BankTransfer]: "Bank transfer",
										[InvoicePaymentMethod.PaymentCard]: "Payment card",
										[InvoicePaymentMethod.Cash]: "Cash",
									} satisfies Record<InvoicePaymentMethod, string>,
									allowEmpty: false,
									label: "Payment method",
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
				title: "Items",
			},
			{
				...builder.arrayTableField(
					{
						name: "items",
						defaultValue: itemDefaultValues,
						columns: [
							{
								title: "Label",
							},
							{
								title: "Price",
								className: "w-[130px]",
							},
							{
								title: "Quantity",
								className: "w-[80px]",
							},
							{
								title: "UOM",
								className: "w-[70px]",
							},
						],
					},
					({ builder }) => ({
						...builder.magicInput("label").text({
							label: "Label",
						}),
						...builder.magicInput("price").text({
							label: "Price",
							placeholder: "0",
						}),
						...builder.magicInput("quantity").text({
							label: "Quantity",
							placeholder: "1",
							type: "number",
						}),
						...builder.magicInput("unitOfMeasure").text({
							label: "UOM",
						}),
					}),
				),
			},
		),
	};
});

export const InvoiceForm: React.FC<{
	defaultValues?: PartialDeep<z.input<typeof itemSchema> & { id: Uuid7 }>;
	onSuccess?: (
		newEventId: string,
		values: z.output<typeof itemSchema>,
	) => unknown;
}> = (params) => {
	const [defaultValues] = useState(() => {
		return merge(createDefaultValues(), params.defaultValues ?? {});
	});
	const { ndk } = useNostr();
	const form = useActionForm(itemSchema, {
		defaultValues,
		saveAction: async (values) => {
			const id =
				params.defaultValues && params.defaultValues.id
					? params.defaultValues.id
					: Uuid7.random();

			if (!params.defaultValues || !params.defaultValues.id) {
				await invoiceStatusStorage.insertOrUpdate(ndk, id, {
					invoiceId: id,
					status: InvoiceStatus.Unpaid,
				});
			}

			const { eventId } = await invoiceStorage.insertOrUpdate(ndk, id, {
				id,
				...values,
			});

			if (params.onSuccess) {
				params.onSuccess(eventId, values);
			}
		},
	});

	return <AutoForm form={form} components={components} />;
};
