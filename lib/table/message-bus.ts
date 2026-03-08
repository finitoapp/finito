import type { ScreenData } from "@/lib/bill/driver";
import type { PaymentInit } from "@/lib/evolu/model/payment-progress";
import { createNostrMessageBus } from "@/lib/nostr/message-bus";
import type { NonEmptyString, Uuid7 } from "@/lib/shared/types";

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
					variant: "info";
					payload: Extract<
						ScreenData,
						{
							variant: "info";
						}
					>["payload"];
			  }
			| {
					variant: "payment";
					payload: Extract<
						ScreenData,
						{
							variant: "payment";
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
			billScreenData: Extract<ScreenData, { variant: "table" }>["payload"];
			subscriptionId: Uuid7;
		};
		output: null;
	};
	paymentFinished: {
		input: {
			billScreenData:
				| Extract<ScreenData, { variant: "table" }>["payload"]
				| null;
			subscriptionId: Uuid7;
		};
		output: null;
	};
}>({
	namespace: "tableEvent",
});
