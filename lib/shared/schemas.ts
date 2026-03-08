import type { z } from "zod";
import { PaymentSchema } from "@/lib/evolu/model/payment";

export const StaticOfflinePaymentSchema = PaymentSchema.omit({
	webPaymentEventId: true,
});

export type StaticOfflinePayment = z.output<typeof StaticOfflinePaymentSchema>;
