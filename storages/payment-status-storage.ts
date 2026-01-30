import type { InferEnumType } from "@/lib/types";

export const PaymentStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
} as const;
export type PaymentStatus = InferEnumType<typeof PaymentStatus>;
