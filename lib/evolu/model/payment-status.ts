import type { InferEnumType } from "@/lib/shared/types";

export const PaymentStatus = {
	Unpaid: "unpaid",
	Paid: "paid",
} as const;
export type PaymentStatus = InferEnumType<typeof PaymentStatus>;
