import type { InferEnumType } from "@/lib/shared/types";

export const PaymentStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
	Underpaid: "underpaid",
	Overpaid: "overpaid",
} as const;
export type PaymentStatus = InferEnumType<typeof PaymentStatus>;
