import { z } from "zod";

export const NotificationSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("verifyPayment"),
		paymentId: z.string(),
	}),
	z.object({
		type: z.literal("backgroundTableProcessing"),
	}),
]);

export type Notification = z.output<typeof NotificationSchema>;
