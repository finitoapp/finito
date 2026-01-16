import { z } from "zod";
import { createNostrStorage } from "@/lib/nostr-storage";
import { Uuid7Schema } from "@/lib/types";

export const BaseNotificationSchema = z.object({
	id: Uuid7Schema,
});

export const Base2NotificationSchema = z.object({
	id: Uuid7Schema.optional(),
});

export const NotificationSchema = z.discriminatedUnion("type", [
	BaseNotificationSchema.extend({
		type: z.literal("verifyPayment"),
		paymentId: Uuid7Schema,
	}),
	Base2NotificationSchema.extend({
		type: z.literal("backgroundTableProcessing"),
	}),
]);

export type Notification = z.output<typeof NotificationSchema>;

export const notificationStorage = createNostrStorage({
	namespace: "notification",
	schema: NotificationSchema,
	useEncryption: true,
});
