import type {
	BillDriver,
	BillSubscription,
	ScreenDataPaymentPayFunction,
} from "@/lib/bill/billDriver";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table-message-bus";
import { NonEmptyString, NonEmptyStringSchema, Uuid7 } from "@/lib/types";

export class TableDriver implements BillDriver {
	public async subscribe({
		billId,
		callback,
		ndk,
	}: Parameters<BillDriver["subscribe"]>[0]) {
		const expectedSubscriptionId = Uuid7.random();
		const [prefix, pubkey = null, qrCodeId = null, ...rest] = billId.split("-");
		if (
			prefix !== "t" ||
			typeof pubkey !== "string" ||
			typeof qrCodeId !== "string"
		) {
			return null;
		}

		if (rest.length !== 0) {
			return null;
		}

		const qrCodeIdResult = NonEmptyStringSchema.safeParse(qrCodeId);
		if (!qrCodeIdResult.success) {
			return null;
		}

		const tableRequestClient = tableRequestMessageBus
			.createInstance({
				pubkey,
			})
			.getClient({
				ndk,
			});

		const pay: ScreenDataPaymentPayFunction = async (params) => {
			callback({
				type: "screen",
				payload: {
					variant: "paymentReady",
					payload: {
						paymentId: params.paymentId,
						type: "btcLn",
						lnInvoice: "",
						bill: {
							items: [],
							currency: params.currency,
							tip: params.tip,
						},
					},
				},
			});

			callback({
				type: "screen",
				payload: {
					variant: "paymentFinished",
					payload: {
						type: "failure",
						paymentId: params.paymentId,
						reason: NonEmptyString("The payment is not ready yet."),
					},
				},
			});
		};

		const server = await tableEventMessageBus
			.createInstance({
				pubkey: ndk.signer.pubkey,
			})
			.listen(
				{
					ndk,
				},
				{
					billChange: async ({ billScreenData, subscriptionId }) => {
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
				},
			);

		await tableRequestClient.call("subscribeToBillByQrCode", {
			pubkey: ndk.signer.pubkey,
			qrCodeId: qrCodeIdResult.data,
			subscriptionId: expectedSubscriptionId,
		});

		const interval = setInterval(() => {
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
