import { createIdFromString, type Id, sqliteTrue } from "@evolu/common";
import * as errore from "errore";
import type { BackgroundProcess } from "@/lib/background/service";
import type { ScreenData } from "@/lib/bill/driver";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table/message-bus";
import { Currency, type NonEmptyString, Uuid7 } from "@/lib/shared/types";

const notificationId = createIdFromString("backgroundTableProcessing");
const subscriptionTimeoutMs = 30_000;

const isCurrency = (
	value: string,
): value is (typeof Currency)[keyof typeof Currency] =>
	Object.values(Currency).includes(
		value as (typeof Currency)[keyof typeof Currency],
	);

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

		const tableCodesQuery = props.evolu.createQuery((db) =>
			db
				.selectFrom("tableCode")
				.select([
					"tableCode.code as code",
					"tableCode.tableId as tableId",
				] as const)
				.where("tableCode.isDeleted", "is not", sqliteTrue),
		);

		const posBillsQuery = props.evolu.createQuery((db) =>
			db
				.selectFrom("posBill")
				.leftJoin("table", "table.id", "posBill.tableId")
				.select([
					"posBill.id as id",
					"posBill.tableId as tableId",
					"posBill.currency as currency",
					"table.label as tableLabel",
				] as const)
				.where("posBill.isDeleted", "is not", sqliteTrue),
		);

		const posBillItemsQuery = props.evolu.createQuery((db) =>
			db
				.selectFrom("posBillItem")
				.select([
					"posBillItem.billId as billId",
					"posBillItem.sourceItemId as sourceItemId",
					"posBillItem.name as name",
					"posBillItem.price as price",
					"posBillItem.quantity as quantity",
				] as const)
				.where("posBillItem.isDeleted", "is not", sqliteTrue),
		);

		let tableCodes: Array<{
			code: string | null;
			tableId: Id | null;
		}> = [];
		let posBills: Array<{
			id: Id;
			tableId: Id | null;
			currency: string | null;
			tableLabel: string | null;
		}> = [];
		let posBillItems: Array<{
			billId: Id | null;
			sourceItemId: string | null;
			name: string | null;
			price: number | null;
			quantity: number | null;
		}> = [];

		const getBillByQrCode = (
			qrCodeId: NonEmptyString,
		): Omit<Extract<ScreenData, { variant: "payment" | "refund" }>, "pay"> => {
			const tableCode = tableCodes.find(({ code }) => code === qrCodeId);
			if (tableCode === undefined || tableCode.tableId === null) {
				return {
					variant: "payment",
					payload: {
						bill: null,
					},
				};
			}

			const bill = posBills.find((item) => item.tableId === tableCode.tableId);
			if (
				bill === undefined ||
				!bill.tableLabel ||
				!bill.currency ||
				!isCurrency(bill.currency)
			) {
				return {
					variant: "payment",
					payload: {
						bill: null,
					},
				};
			}

			const items = posBillItems
				.filter(
					(
						item,
					): item is {
						billId: Id;
						sourceItemId: string;
						name: string;
						price: number;
						quantity: number;
					} =>
						item.billId === bill.id &&
						item.sourceItemId !== null &&
						item.name !== null &&
						item.price !== null &&
						item.quantity !== null,
				)
				.map((item) => ({
					id: item.sourceItemId,
					label: item.name,
					price: item.price,
					quantity: item.quantity,
					optionality: {
						checked: 0,
					},
				}));

			return {
				variant: "payment",
				payload: {
					bill: {
						currency: bill.currency,
						items,
					},
					merchant: {
						name: bill.tableLabel as NonEmptyString,
					},
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
					pubkey: input.pubkey,
				})
				.getClient({
					ndk: props.ndk,
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
					if (errore.isError(result)) {
						console.error(result);
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
				pubkey: props.ndk.signer.pubkey,
			})
			.listen(
				{
					ndk: props.ndk,
				},
				{
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
				},
			);

		const unsubscribeTableCodes = subscribeToEvoluQuery(
			props.evolu,
			tableCodesQuery,
			(data) => {
				tableCodes = [...data];
				sendBillChangeToAll();
			},
		);
		const unsubscribePosBills = subscribeToEvoluQuery(
			props.evolu,
			posBillsQuery,
			(data) => {
				posBills = [...data];
				sendBillChangeToAll();
			},
		);
		const unsubscribePosBillItems = subscribeToEvoluQuery(
			props.evolu,
			posBillItemsQuery,
			(data) => {
				posBillItems = [...data];
				sendBillChangeToAll();
			},
		);

		return () => {
			unsubscribeTableCodes();
			unsubscribePosBills();
			unsubscribePosBillItems();
			for (const subscription of subscriptionRef.values()) {
				clearTimeout(subscription.timeout);
			}
			void serverPromise.then((server) => {
				if (errore.isError(server)) {
					console.error(server);
					return;
				}
				server.close();
			});
		};
	},
};
