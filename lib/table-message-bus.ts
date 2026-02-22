import type { ScreenData } from "@/lib/bill/billDriver";
import { createNostrMessageBus } from "@/lib/nostr-message-bus";
import type { NonEmptyString, Uuid7 } from "@/lib/types";
import type { PaymentInit } from "@/storages/payment-progress-storage";

export const tableRequestMessageBus = createNostrMessageBus<{
	subscribeToBillByQrCode: {
		input: {
			subscriptionId: Uuid7;
			pubkey: string;
			qrCodeId: NonEmptyString;
		};
		output: { subscriptionId: Uuid7 };
	};
	unsubscribe: {
		input: { subscriptionId: Uuid7 };
		output: null;
	};
	createPaymentFromSubscribedBill: {
		input: {
			subscriptionId: Uuid7;
			payment: PaymentInit;
		};
		output:
			| {
					variant: "paymentReady";
					payload: Extract<
						ScreenData,
						{
							variant: "paymentReady";
						}
					>["payload"];
			  }
			| {
					variant: "paymentFinished";
					payload: Extract<
						ScreenData,
						{
							variant: "paymentFinished";
						}
					>["payload"];
			  };
	};
}>({
	namespace: "tableRequest",
});

export const tableEventMessageBus = createNostrMessageBus<{
	billChange: {
		input: {
			billScreenData: Omit<
				Extract<ScreenData, { variant: "payment" | "refund" }>,
				"pay" | "parentScreen"
			> | null;
			subscriptionId: Uuid7;
		};
		output: null;
	};
	paymentFinished: {
		input: {
			billScreenData: Omit<
				Extract<ScreenData, { variant: "paymentFinished" }>,
				"pay" | "parentScreen"
			> | null;
			subscriptionId: Uuid7;
		};
		output: null;
	};
}>({
	namespace: "tableEvent",
});
