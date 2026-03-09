import { createIdFromString, kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import type { BackgroundProcess } from "@/lib/background/service";
import type { ScreenData } from "@/lib/bill/driver";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import { NonEmptyString, NonNegativeInteger, Uuid7 } from "@/lib/shared/types";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table/message-bus";

const notificationId = createIdFromString("backgroundTableProcessing");
const subscriptionTimeoutMs = 30_000;

export const backgroundTableProcessingProcess: BackgroundProcess = {
	name: "backgroundTableProcessing",
	run: async (props) => {
		props.addNotification({
			title: props.t(
				"components:notificationItem.backgroundTableProcessing.title",
			),
			type: "info",
			progress: null,
			canBeClosed: false,
			description: props.t(
				"components:notificationItem.backgroundTableProcessing.description",
			),
			isUnread: false,
			id: notificationId,
			timestamp: Date.now(),
		});

		const subscriptionRef = new Map<
			Uuid7,
			{
				pubkey: string;
				qrCodeId: NonEmptyString;
				timeout: ReturnType<typeof setTimeout>;
			}
		>();

		const posBillsQuery = createQuery((db) =>
			db
				.selectFrom("posBill")
				.select(
					(eb) =>
						[
							"posBill.id as id",
							"posBill.tableId as tableId",
							"posBill.currency as currency",

							kysely
								.jsonObjectFrom(
									eb
										.selectFrom("table")
										.select((eb) => [
											"table.label as label",

											kysely
												.jsonArrayFrom(
													eb
														.selectFrom("tableCode")
														.select(["tableCode.code as code"] as const)
														.whereRef("tableCode.tableId", "=", "table.id")
														.where("tableCode.isDeleted", "is not", sqliteTrue)
														.where("tableCode.code", "is not", null)
														.$narrowType<{
															code: NotNull;
														}>(),
												)
												.as("codes"),
										])
										.whereRef("posBill.tableId", "=", "table.id")
										.where("table.isDeleted", "is not", sqliteTrue)
										.where("table.label", "is not", null)
										.$narrowType<{
											label: NotNull;
										}>(),
								)
								.as("table"),

							kysely
								.jsonArrayFrom(
									eb
										.selectFrom("posBillItemLine")
										.select(
											(eb) =>
												[
													"posBillItemLine.totalAmount as totalAmount",
													"posBillItemLine.quantity as quantity",

													kysely
														.jsonObjectFrom(
															eb
																.selectFrom("posBillItem")
																.select([
																	"posBillItem.label as label",
																	"posBillItem.price as price",
																	"posBillItem.id as id",
																])
																.whereRef(
																	"posBillItem.id",
																	"=",
																	"posBillItemLine.id",
																)
																.where(
																	"posBillItem.isDeleted",
																	"is not",
																	sqliteTrue,
																)
																.where("posBillItem.label", "is not", null)
																.where("posBillItem.price", "is not", null)
																.$narrowType<{
																	label: NotNull;
																	price: NotNull;
																}>(),
														)
														.as("item"),
												] as const,
										)
										.whereRef("posBillItemLine.posBillId", "=", "posBill.id")
										.where("posBillItemLine.isDeleted", "is not", sqliteTrue)
										.where("posBillItemLine.totalAmount", "is not", null)
										.where("posBillItemLine.quantity", "is not", null)
										.$narrowType<{
											totalAmount: NotNull;
											quantity: NotNull;
											item: NotNull;
										}>(),
								)
								.as("items"),
						] as const,
				)
				.where("posBill.isDeleted", "is not", sqliteTrue)
				.where("posBill.currency", "is not", null)
				.$narrowType<{
					currency: NotNull;
				}>(),
		);

		let posBills: (typeof posBillsQuery.Row)[] = [];

		const getBillByQrCode = (
			qrCodeId: NonEmptyString,
		): Extract<ScreenData, { variant: "table" }>["payload"] => {
			const bill = posBills.find(
				(item) =>
					item.table &&
					item.table.codes.find((code) => code.code === qrCodeId) !== undefined,
			);
			if (bill === undefined) {
				return {
					bill: null,
				};
			}

			const items = bill.items.map((item) => ({
				id: item.item.id,
				quantity: item.quantity,
				optionality: {
					checked: NonNegativeInteger(0),
				},
				item: {
					label: item.item.label,
					price: item.item.price,
				},
			}));

			return {
				bill: {
					currency: bill.currency,
					items,
				},
				merchant: {
					name: bill.table?.label ?? NonEmptyString("Unknown"),
				},
			};
		};

		const sendBillChange = (input: {
			pubkey: string;
			qrCodeId: NonEmptyString;
			subscriptionId: Uuid7;
		}) => {
			tableEventMessageBus
				.createInstance({
					ndk: props.ndk,
				})
				.getClient({
					recipientPubkey: input.pubkey,
				})
				.call(
					"billChange",
					{
						billScreenData: getBillByQrCode(input.qrCodeId),
						subscriptionId: input.subscriptionId,
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
		};

		const sendBillChangeToAll = () => {
			for (const [subscriptionId, subscription] of subscriptionRef.entries()) {
				sendBillChange({
					pubkey: subscription.pubkey,
					qrCodeId: subscription.qrCodeId,
					subscriptionId,
				});
			}
		};

		const serverPromise = tableRequestMessageBus
			.createInstance({
				ndk: props.ndk,
			})
			.listen({
				createPaymentFromSubscribedBill: async (_input) => {
					// @TODO
					return {
						variant: "info",
						payload: {
							status: "failure",
							text: NonEmptyString("Unexpected subscription"),
						},
					};
				},
				subscribeToBillByQrCode: async (input) => {
					const subscriptionId = input.subscriptionId ?? Uuid7.random();
					const subscription = subscriptionRef.get(subscriptionId);
					if (subscription !== undefined) {
						clearTimeout(subscription.timeout);
						subscription.timeout = setTimeout(() => {
							subscriptionRef.delete(subscriptionId);
						}, subscriptionTimeoutMs);

						sendBillChange({
							pubkey: subscription.pubkey,
							qrCodeId: subscription.qrCodeId,
							subscriptionId,
						});

						return {
							subscriptionId,
						};
					}

					subscriptionRef.set(subscriptionId, {
						pubkey: input.pubkey,
						qrCodeId: input.qrCodeId,
						timeout: setTimeout(() => {
							subscriptionRef.delete(subscriptionId);
						}, subscriptionTimeoutMs),
					});

					sendBillChange({
						...input,
						subscriptionId,
					});

					return {
						subscriptionId,
					};
				},
				unsubscribe: async (input) => {
					const subscription = subscriptionRef.get(input.subscriptionId);
					if (subscription) {
						clearTimeout(subscription.timeout);
					}
					subscriptionRef.delete(input.subscriptionId);
					return null;
				},
			});

		const unsubscribePosBills = subscribeToEvoluQuery(
			props.evolu,
			posBillsQuery,
			(data) => {
				posBills = [...data];
				sendBillChangeToAll();
			},
		);

		return () => {
			unsubscribePosBills();
			for (const subscription of subscriptionRef.values()) {
				clearTimeout(subscription.timeout);
			}
			void serverPromise.then((server) => {
				if (!server.ok) {
					console.error(server.error);
					return;
				}
				server.value.close();
			});
		};
	},
};
