import type {
	BillDriver,
	BillSubscription,
	ScreenDataPaymentPayFunction,
} from "@/lib/bill/billDriver";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table-message-bus";
import { NonEmptyStringSchema, Uuid7 } from "@/lib/types";

export class TableDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
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
			qrCodeIdFirstPart + (rest.length > 0 ? "-" + rest.join("-") : "");
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
			console.log("pay", params);
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

			console.log("response", response);

			isInsideThePayment = true;

			callback({
				type: "screen",
				payload: response,
			});
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

					callback({
						type: "screen",
						payload: {
							...billScreenData,
							pay,
						},
					});
					return null;
				},
				paymentFinished: async ({ billScreenData, subscriptionId }) => {
					console.log("paymentFinished2", billScreenData, subscriptionId);
					if (
						billScreenData === null ||
						expectedSubscriptionId !== subscriptionId
					) {
						return null;
					}

					isInsideThePayment = true;

					console.log("paymentFinished3", billScreenData, subscriptionId);
					callback({
						type: "screen",
						payload: billScreenData,
					});
					return null;
				},
			});

		console.log("Subscribing to bill by QR code", qrCodeId);
		await tableRequestClient.call("subscribeToBillByQrCode", {
			pubkey: ndk.signer.pubkey,
			qrCodeId: qrCodeIdResult.data,
			subscriptionId: expectedSubscriptionId,
		});

		const interval = setInterval(() => {
			if (isInsideThePayment) {
				return;
			}

			void tableRequestClient.call(
				"subscribeToBillByQrCode",
				{
					pubkey: ndk.signer.pubkey,
					qrCodeId: qrCodeIdResult.data,
					subscriptionId: expectedSubscriptionId,
				},
				{
					ignoreResponse: true,
				},
			);
		}, 20_000);

		return {
			refresh: async () => {},
			close: async () => {
				server.close();
				clearInterval(interval);
				void tableRequestClient.call(
					"unsubscribe",
					{
						subscriptionId: expectedSubscriptionId,
					},
					{
						ignoreResponse: true,
					},
				);
			},
		} satisfies BillSubscription;
	}
}
