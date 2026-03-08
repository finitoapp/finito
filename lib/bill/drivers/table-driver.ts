import * as errore from "errore";
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
			const response = await tableRequestClient.call(
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
			if (errore.isError(response)) {
				console.error(response);
				callback({
					type: "close",
					payload: {
						alertMessage: "Failed to create payment...",
					},
				});
				return;
			}

			isInsideThePayment = true;

			screenStack.push(response);
		};

		const server = await tableEventMessageBus
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
		if (errore.isError(server)) {
			console.error(server);
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
		if (errore.isError(subscribeResult)) {
			console.error(subscribeResult);
			server.close();
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
					if (errore.isError(result)) {
						console.error(result);
					}
				});
		}, 20_000);

		return {
			close: async () => {
				server.close();
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
						if (errore.isError(result)) {
							console.error(result);
						}
					});
			},
		} satisfies BillSubscription;
	}
}
