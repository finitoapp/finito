import type { EvoluSchemaType } from "@/lib/evolu";
import type { InferEnumType } from "@/lib/shared/types";

export const InvoicePaymentMethod = {
	BankTransfer: "bankTransfer",
	Cash: "cash",
	PaymentCard: "paymentCard",
} as const;
export type InvoicePaymentMethod = InferEnumType<typeof InvoicePaymentMethod>;

export type Invoice = EvoluSchemaType["invoice"] & {
	invoiceCustomerBillingInfo: Omit<
		EvoluSchemaType["invoiceCustomerBillingInfo"],
		"id"
	>;
	invoiceCustomerBillingInfoAddress: Omit<
		EvoluSchemaType["invoiceCustomerBillingInfoAddress"],
		"id"
	>;
	invoiceCustomerBillingInfoCz: Omit<
		EvoluSchemaType["invoiceCustomerBillingInfoCz"],
		"id"
	>;
	invoiceSupplierBillingInfo: Omit<
		EvoluSchemaType["invoiceSupplierBillingInfo"],
		"id"
	>;
	invoiceSupplierBillingInfoAddress: Omit<
		EvoluSchemaType["invoiceSupplierBillingInfoAddress"],
		"id"
	>;
	invoiceSupplierBillingInfoCz: Omit<
		EvoluSchemaType["invoiceSupplierBillingInfoCz"],
		"id"
	>;
	items: (Omit<EvoluSchemaType["invoiceItemLine"], "invoiceId"> & {
		item: EvoluSchemaType["invoiceItem"];
	})[];
};
