import type { EvoluSchemaType } from "@/lib/evolu";
import type { InferEnumType } from "@/lib/shared/types";

export const PaymentReceiptLineKind = {
	Item: "item",
	Tip: "tip",
	Payment: "payment",
	SettlementAdjustment: "settlementAdjustment",
} as const;
export type PaymentReceiptLineKind = InferEnumType<
	typeof PaymentReceiptLineKind
>;

export type PaymentReceipt = Omit<
	EvoluSchemaType["paymentReceipt"],
	"deviceId"
> & {
	paymentReceiptSupplier: EvoluSchemaType["paymentReceiptSupplier"];
	paymentReceiptSupplierAddress: Omit<
		EvoluSchemaType["paymentReceiptSupplierAddress"],
		"id"
	>;
	paymentReceiptSupplierBillingInfo: Omit<
		EvoluSchemaType["paymentReceiptSupplierBillingInfo"],
		"id"
	>;
	paymentReceiptSupplierBillingInfoCz: Omit<
		EvoluSchemaType["paymentReceiptSupplierBillingInfoCz"],
		"id"
	>;
	items: Omit<EvoluSchemaType["paymentReceiptItemLine"], "paymentReceiptId">[];
};
