import type { EvoluSchemaType } from "@/lib/evolu";
import type { InferEnumType } from "@/lib/shared/types";

export const InvoicePaymentMethod = {
	BankTransfer: "bankTransfer",
	Cash: "cash",
	PaymentCard: "paymentCard",
} as const;
export type InvoicePaymentMethod = InferEnumType<typeof InvoicePaymentMethod>;

export type Invoice = Omit<EvoluSchemaType["invoice"], "deviceId"> & {
	invoiceCustomer: Omit<
		EvoluSchemaType["invoiceCustomer"],
		"id" | "sourceContactId"
	>;
	invoiceCustomerBillingInfo: Omit<
		EvoluSchemaType["invoiceCustomerBillingInfo"],
		"id"
	>;
	invoiceCustomerAddress: Omit<EvoluSchemaType["invoiceCustomerAddress"], "id">;
	invoiceCustomerBillingInfoCz: Omit<
		EvoluSchemaType["invoiceCustomerBillingInfoCz"],
		"id"
	>;
	invoiceSupplier: Omit<
		EvoluSchemaType["invoiceSupplier"],
		"id" | "sourceContactId"
	>;
	invoiceSupplierBillingInfo: Omit<
		EvoluSchemaType["invoiceSupplierBillingInfo"],
		"id"
	>;
	invoiceSupplierAddress: Omit<EvoluSchemaType["invoiceSupplierAddress"], "id">;
	invoiceSupplierBillingInfoCz: Omit<
		EvoluSchemaType["invoiceSupplierBillingInfoCz"],
		"id"
	>;
	items: (Omit<
		EvoluSchemaType["invoiceItemLine"],
		"invoiceId" | "catalogItemId" | "itemId"
	> & {
		item: EvoluSchemaType["item"];
	})[];
};
