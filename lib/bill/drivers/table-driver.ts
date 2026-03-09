import type {
	BillDriver,
	BillSubscription,
	ScreenDataPaymentPayFunction,
} from "@/lib/bill/driver";
import { NonEmptyStringSchema, Uuid7 } from "@/lib/shared/types";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table/message-bus";

export class TableDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
		screenStack,
		ndk,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		let isInsideThePayment = false;
		const expectedSubscriptionId = Uuid7.random();
		const [prefix, pubkey = null, qrCodeIdFirstPart = null, ...rest] =
			billId.split("-");
		if (
			prefix !== "t" ||
			typeof pubkey !== "string" ||
			typeof qrCodeIdFirstPart !== "string"
		) {
			return null;
		}

		const qrCodeId =
			qrCodeIdFirstPart + (rest.length > 0 ? `-${rest.join("-")}` : "");
		const qrCodeIdResult = NonEmptyStringSchema.safeParse(qrCodeId);
		if (!qrCodeIdResult.success) {
			return null;
		}

		const tableRequestClient = tableRequestMessageBus
			.createInstance({
				ndk,
			})
			.getClient({
				recipientPubkey: pubkey,
			});

		const pay: ScreenDataPaymentPayFunction = async (params) => {
			const responseResult = await tableRequestClient.call(
				"createPaymentFromSubscribedBill",
				{
					subscriptionId: expectedSubscriptionId,
					payment: {
						paymentId: params.paymentId,
						paymentOption: {
							type: "btcLn",
						},
						currency: params.currency,
						items: params.items,
						tip: params.tip,
					},
				},
			);
			if (!responseResult.ok) {
				console.error(responseResult.error);
				callback({
					type: "close",
					payload: {
						alertMessage: "Failed to create payment...",
					},
				});
				return;
			}

			isInsideThePayment = true;

			screenStack.push(responseResult.value);
		};

		const serverResult = await tableEventMessageBus
			.createInstance({
				ndk,
			})
			.listen({
				billChange: async ({ billScreenData, subscriptionId }) => {
					if (isInsideThePayment) {
						return null;
					}

					if (
						billScreenData === null ||
						expectedSubscriptionId !== subscriptionId
					) {
						return null;
					}

					screenStack.replace({
						variant: "table",
						payload: billScreenData,
						pay,
					});
					return null;
				},
				paymentFinished: async ({ billScreenData, subscriptionId }) => {
					if (
						billScreenData === null ||
						expectedSubscriptionId !== subscriptionId
					) {
						return null;
					}

					isInsideThePayment = true;

					screenStack.replace({
						variant: "table",
						payload: billScreenData,
						pay,
					});
					return null;
				},
			});
		if (!serverResult.ok) {
			console.error(serverResult.error);
			callback({
				type: "close",
				payload: {
					alertMessage: "Failed to subscribe to table updates...",
				},
			});
			return null;
		}

		console.log("Subscribing to bill by QR code", qrCodeId);
		const subscribeResult = await tableRequestClient.call(
			"subscribeToBillByQrCode",
			{
				pubkey: ndk.signer.pubkey,
				qrCodeId: qrCodeIdResult.data,
				subscriptionId: expectedSubscriptionId,
			},
		);
		if (!subscribeResult.ok) {
			console.error(subscribeResult.error);
			serverResult.value.close();
			callback({
				type: "close",
				payload: {
					alertMessage: "Failed to subscribe to bill...",
				},
			});
			return null;
		}

		const interval = setInterval(() => {
			if (isInsideThePayment) {
				return;
			}

			void tableRequestClient
				.call(
					"subscribeToBillByQrCode",
					{
						pubkey: ndk.signer.pubkey,
						qrCodeId: qrCodeIdResult.data,
						subscriptionId: expectedSubscriptionId,
					},
					{
						ignoreResponse: true,
					},
				)
				.then((result) => {
					if (!result.ok) {
						console.error(result.error);
					}
				});
		}, 20_000);

		return {
			close: async () => {
				serverResult.value.close();
				clearInterval(interval);
				void tableRequestClient
					.call(
						"unsubscribe",
						{
							subscriptionId: expectedSubscriptionId,
						},
						{
							ignoreResponse: true,
						},
					)
					.then((result) => {
						if (!result.ok) {
							console.error(result.error);
						}
					});
			},
		} satisfies BillSubscription;
	}
}
