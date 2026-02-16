"use client";

import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { useMutation } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { type Atom, atom, useAtomValue, useStore } from "jotai";
import type { Store } from "jotai/vanilla/store";
import { Bell, X } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { deviceEvoluAtom } from "@/atoms/device-evolu";
import { type Pos, posAtom } from "@/atoms/pos";
import { NotificationItem } from "@/components/notification-item";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostr } from "@/hooks/use-nostr";
import type { ScreenData } from "@/lib/bill/billDriver";
import type { DeviceEvolu } from "@/lib/device-evolu";
import type { Evolu } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu-utils";
import { FioApiClient } from "@/lib/fio/fio-api-client";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table-message-bus";
import type { NonEmptyString } from "@/lib/types";
import { Uuid7 } from "@/lib/types";
import type { Notification } from "@/storages/notification-storage";
import { PaymentStatus } from "@/storages/payment-status-storage";
import { Button } from "./ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "./ui/sheet";

type NotificationUI = {
	id: string;
	title: string;
	description: string;
	type: "info" | "success" | "warning" | "error";
	timestamp?: number;
	progress?: number | null; // Use null for an unknown time horizon (rotating spinner)
	canBeClosed?: boolean;
	actions?: {
		buttonProps: ComponentProps<typeof Button>;
		callback: (params: { deleteNotification: () => unknown }) => unknown;
	}[];
};

type BackgroundDef = {
	subscribe: (props: {
		ndk: NDK & {
			signer: NDKSigner;
			activeUser: NDKUser;
		};
		evolu: Evolu;
		deviceEvolu: DeviceEvolu;
		jotaiStore: Store;
		setNotification: (notification: NotificationUI) => void;
		deleteNotification: () => void;
	}) => Promise<() => void>;
};

export const resolveNotificationDef = (
	t: TFunction,
	notification: Notification & { id: Id; createdAt: number },
): BackgroundDef => {
	if (notification.type === "verifyPayment") {
		const notificationData = notification;

		return {
			subscribe: async (props) => {
				props.setNotification({
					title: t("components:notificationItem.verifyPayment.title"),
					type: "info",
					progress: null,
					canBeClosed: false,
					description: t(
						"components:notificationItem.verifyPayment.description",
					),
					id: notification.id,
					timestamp: notification.createdAt,
					actions: [
						{
							buttonProps: {
								children: t(
									"components:notificationItem.verifyPayment.actions.stopWaiting",
								),
							},
							callback: ({ deleteNotification }) => {
								deleteNotification();
							},
						},
					],
				});

				let markAsPaid = false;
				const paymentId = notificationData.paymentId as Id;
				const paymentQuery = props.evolu.createQuery((db) =>
					db
						.selectFrom("payment")
						.leftJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
						.leftJoin("paymentLnSpark", "paymentLnSpark.id", "payment.id")
						.leftJoin(
							"paymentBankTransferCZ",
							"paymentBankTransferCZ.id",
							"payment.id",
						)
						.leftJoin("paymentCash", "paymentCash.id", "payment.id")
						.select([
							"payment.id as id",
							"payment.type as type",
							"payment.privateKey as privateKey",
							"payment.billCurrency as billCurrency",
							"paymentLnZap.lnInvoice as lnZapLnInvoice",
							"paymentLnZap.walletPubkey as lnZapWalletPubkey",
							"paymentLnZap.amount as lnZapAmount",
							"paymentLnZap.expirationIn as lnZapExpirationIn",
							"paymentLnSpark.accountId as lnSparkAccountId",
							"paymentLnSpark.lnInvoice as lnSparkLnInvoice",
							"paymentLnSpark.sparkInvoiceId as lnSparkSparkInvoiceId",
							"paymentLnSpark.amount as lnSparkAmount",
							"paymentLnSpark.expirationIn as lnSparkExpirationIn",
							"paymentBankTransferCZ.iban as bankTransferIban",
							"paymentBankTransferCZ.variableSymbol as bankTransferVariableSymbol",
							"paymentCash.id as cashId",
						] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("payment.id", "=", paymentId),
				);
				const paymentBillItemsQuery = props.evolu.createQuery((db) =>
					db
						.selectFrom("paymentBillItem")
						.select([
							"paymentBillItem.price as price",
							"paymentBillItem.quantity as quantity",
							"paymentBillItem.label as label",
						] as const)
						.where("paymentBillItem.isDeleted", "is not", sqliteTrue)
						.where("paymentBillItem.paymentId", "=", paymentId),
				);

				const paymentRows = await props.evolu.loadQuery(paymentQuery);
				const paymentBillItemsRows = await props.evolu.loadQuery(
					paymentBillItemsQuery,
				);

				const payment = paymentRows?.[0];
				if (!payment || !payment.privateKey || !payment.billCurrency) {
					return () => {};
				}

				const item = {
					privateKey: payment.privateKey,
					bill: {
						currency: payment.billCurrency,
						items: (paymentBillItemsRows ?? []).map((billItem) => ({
							price: billItem.price ?? 0,
							quantity: billItem.quantity ?? 0,
							label: billItem.label ?? "",
						})),
					},
					paymentOptions: [
						payment.type === "lnZap" &&
						payment.lnZapLnInvoice &&
						payment.lnZapWalletPubkey &&
						payment.lnZapAmount !== null &&
						payment.lnZapExpirationIn !== null
							? {
									type: "lnZap" as const,
									lnInvoice: payment.lnZapLnInvoice,
									walletPubkey: payment.lnZapWalletPubkey,
									amount: payment.lnZapAmount,
									expirationIn: payment.lnZapExpirationIn,
								}
							: payment.type === "lnSpark" &&
									payment.lnSparkAccountId &&
									payment.lnSparkLnInvoice &&
									payment.lnSparkSparkInvoiceId &&
									payment.lnSparkAmount !== null &&
									payment.lnSparkExpirationIn !== null
								? {
										type: "lnSpark" as const,
										accountId: payment.lnSparkAccountId,
										lnInvoice: payment.lnSparkLnInvoice,
										sparkInvoiceId: payment.lnSparkSparkInvoiceId,
										amount: payment.lnSparkAmount,
										expirationIn: payment.lnSparkExpirationIn,
									}
								: payment.type === "bankTransferCZ" &&
										payment.bankTransferIban &&
										payment.bankTransferVariableSymbol
									? {
											type: "bankTransferCZ" as const,
											iban: payment.bankTransferIban,
											variableSymbol: payment.bankTransferVariableSymbol,
										}
									: payment.type === "cash" && payment.cashId
										? { type: "cash" as const }
										: null,
					].filter((paymentOption) => paymentOption !== null),
				};

				const paymentStatusQuery = props.evolu.createQuery((db) =>
					db
						.selectFrom("paymentStatus")
						.select(["paymentStatus.status as status"] as const)
						.where("paymentStatus.isDeleted", "is not", sqliteTrue)
						.where("paymentStatus.id", "=", notificationData.paymentId as Id),
				);

				const subscriptions: (() => void)[] = [];
				subscriptions.push(
					subscribeToEvoluQuery(
						props.evolu,
						paymentStatusQuery,
						(paymentStatusRows) => {
							const paymentStatus = paymentStatusRows[0];
							if (paymentStatus?.status === PaymentStatus.Paid) {
								props.deleteNotification();
							}
						},
					),
				);

				// LN
				{
					const zapWallet = item.paymentOptions.find(
						(paymentOption) => paymentOption.type === "lnZap",
					);

					if (zapWallet) {
						const ndkSigner = new NDKPrivateKeySigner(item.privateKey);
						const subscription = props.ndk.subscribe(
							{
								kinds: [9735], // zap receipt
								authors: [zapWallet.walletPubkey],
								"#p": [ndkSigner.pubkey],
								limit: 1,
							},
							{},
							{
								onEvent: (zapReceipt) => {
									if (!markAsPaid && zapReceipt) {
										markAsPaid = true;

										(async () => {
											getOrThrow(
												props.evolu.upsert("paymentStatus", {
													id: notificationData.paymentId as Id,
													status: PaymentStatus.Paid,
													proveType: "lnZap",
												}),
											);
											props.deleteNotification();
										})();
									}
								},
							},
						);

						subscriptions.push(() => subscription.stop());
					}
				}

				// LN Spark
				{
					const sparkWallet = item.paymentOptions.find(
						(paymentOption) => paymentOption.type === "lnSpark",
					);

					if (sparkWallet) {
						const walletPromise = (async () => {
							const accounts = await props.evolu.loadQuery(
								props.evolu.createQuery((db) =>
									db
										.selectFrom("account")
										.leftJoin("accountSpark", "accountSpark.id", "account.id")
										.select([
											"account._tag as _tag",
											"accountSpark.mnemonic as mnemonic",
										] as const)
										.where("account.isDeleted", "is not", sqliteTrue)
										.where("account.id", "=", sparkWallet.accountId as Id),
								),
							);

							const account = accounts[0];
							if (account === undefined) {
								return;
							}

							if (account._tag !== "accountSpark" || !account.mnemonic) {
								return;
							}

							const { wallet } = await SparkWallet.initialize({
								mnemonicOrSeed: account.mnemonic,
								options: {
									network: "MAINNET",
								},
							});

							return wallet;
						})();

						const timer = setInterval(async () => {
							const wallet = await walletPromise;
							if (wallet === undefined) {
								return;
							}

							const invoiceResult = await wallet.getLightningReceiveRequest(
								sparkWallet.sparkInvoiceId,
							);
							if (invoiceResult === null) {
								return;
							}

							if (invoiceResult.status !== "TRANSFER_COMPLETED") {
								return;
							}

							console.log("Spark OK");
							markAsPaid = true;

							getOrThrow(
								props.evolu.upsert("paymentStatus", {
									id: notificationData.paymentId as Id,
									status: PaymentStatus.Paid,
									proveType: "bankTransferCZ",
								}),
							);
							props.deleteNotification();
						}, 5 * 1000);

						subscriptions.push(() => {
							walletPromise.then((wallet) => {
								if (wallet) {
									void wallet.cleanupConnections();
								}
							});

							clearInterval(timer);
						});
					}
				}

				// FIO
				{
					const fioPluginId = createIdFromString("");
					const fioPluginQuery = props.evolu.createQuery((db) =>
						db
							.selectFrom("fioPlugin")
							.selectAll()
							.where("isDeleted", "is not", sqliteTrue)
							.where("id", "=", fioPluginId),
					);
					const fioPluginRows = await props.evolu.loadQuery(fioPluginQuery);

					const fioPluginTokenQuery = props.evolu.createQuery((db) =>
						db
							.selectFrom("fioPluginToken")
							.select(["fioPluginToken.token as token"] as const)
							.where("fioPluginToken.isDeleted", "is not", sqliteTrue)
							.where("fioPluginToken.fioPluginId", "=", fioPluginId),
					);
					const fioPluginTokens =
						await props.evolu.loadQuery(fioPluginTokenQuery);

					const fioData = fioPluginRows && fioPluginRows[0];
					if (fioData) {
						const fioApiClient = (() => {
							if (
								!fioData?.apiUrl ||
								!fioData?.numberOfSecondsBetweenChecks ||
								!fioPluginTokens ||
								fioPluginTokens.length === 0
							) {
								return null;
							}

							const tokens = fioPluginTokens
								.map((token) => token.token)
								.filter((token): token is string => token !== null);

							if (tokens.length === 0) {
								return null;
							}

							return new FioApiClient(tokens, fioData.apiUrl);
						})();

						if (fioApiClient) {
							const totalAmount = item.bill.items.reduce((acc, item) => {
								return item.price + acc;
							}, 0);

							const timer = setInterval(async () => {
								const transactions = await fioApiClient.getTransactions();
								console.log("FIO check", transactions);
								for (const transaction of transactions.accountStatement
									.transactionList.transaction) {
									if (
										[
											"Bezhotovostní příjem",
											"Příjem převodem uvnitř banky",
										].includes(transaction.Typ) &&
										transaction.Měna === item.bill.currency &&
										transaction.Objem === totalAmount
									) {
										console.log("FIO OK");
										markAsPaid = true;
										getOrThrow(
											props.evolu.upsert("paymentStatus", {
												id: notificationData.paymentId as Id,
												status: PaymentStatus.Paid,
												proveType: "bankTransferCZ",
											}),
										);
										props.deleteNotification();
									}
								}
							}, fioData.numberOfSecondsBetweenChecks * 1000);

							subscriptions.push(() => clearInterval(timer));
						}
					}
				}

				return () => {
					for (const unsubscribe of subscriptions) {
						unsubscribe();
					}
				};
			},
		};
	} else if (notification.type === "backgroundTableProcessing") {
		return {
			subscribe: async (props) => {
				props.setNotification({
					title: t(
						"components:notificationItem.backgroundTableProcessing.title",
					),
					type: "info",
					canBeClosed: false,
					description: t(
						"components:notificationItem.backgroundTableProcessing.description",
					),
					id: notification.type,
				});

				const subscriptionRef = new Map();

				const tableCodesQuery = props.evolu.createQuery((db) =>
					db
						.selectFrom("tableCode")
						.select([
							"tableCode.code as code",
							"tableCode.tableId as tableId",
						] as const)
						.where("tableCode.isDeleted", "is not", sqliteTrue),
				);

				let tableCodes = [];

				const getBillByQrCode = (
					pos: Pos,
					qrCodeId: NonEmptyString,
				): Omit<
					Extract<ScreenData, { variant: "payment" | "refund" }>,
					"pay"
				> => {
					const tableCode = tableCodes.find(({ code }) => code === qrCodeId);
					if (tableCode === undefined) {
						return {
							variant: "payment",
							payload: {
								bill: null,
							},
						};
					}

					for (const bill of Object.values(pos.bills)) {
						if (bill.table && bill.table.id === tableCode.tableId) {
							return {
								variant: "payment",
								payload: {
									bill: {
										currency: bill.currency,
										items: bill.items.map((item) => ({
											id: item.id,
											label: item.name,
											price: item.price,
											quantity: item.quantity,
											optionality: {
												checked: 0,
											},
										})),
									},
									merchant: {
										name: bill.table.name,
									},
								},
							};
						}
					}

					return {
						variant: "payment",
						payload: {
							bill: null,
						},
					};
				};

				const sendBillChange = (input: {
					pubkey: string;
					qrCodeId: NonEmptyString;
					subscriptionId: Uuid7;
				}) => {
					const pos = props.jotaiStore.get(posAtom);

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
								billScreenData: getBillByQrCode(pos, input.qrCodeId),
								subscriptionId: input.subscriptionId,
							},
							{
								ignoreResponse: true,
							},
						);
				};

				let unsubscribeStore: null | (() => void) = null;
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
									}, 30_000);
									return {
										subscriptionId,
									};
								}

								subscriptionRef.set(subscriptionId, {
									pubkey: input.pubkey,
									qrCodeId: input.qrCodeId,
									timeout: setTimeout(() => {
										subscriptionRef.delete(subscriptionId);
									}, 30_000),
								});

								sendBillChange({
									...input,
									subscriptionId,
								});

								unsubscribeStore = props.jotaiStore.sub(posAtom, () => {
									sendBillChange({
										...input,
										subscriptionId,
									});
								});

								return {
									subscriptionId,
								};
							},
							unsubscribe: async (input) => {
								subscriptionRef.delete(input.subscriptionId);
								if (unsubscribeStore) {
									unsubscribeStore();
									unsubscribeStore = null;
								}
								return null;
							},
						},
					);

				const unsubscribe = subscribeToEvoluQuery(
					props.evolu,
					tableCodesQuery,
					(data) => {
						tableCodes = data;
					},
				);

				return () => {
					unsubscribe();
					serverPromise.then((server) => server.close());
				};
			},
		};
	}

	throw new Error("Unsupported notification type");
};

export function NotificationCenter() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const deviceEvolu = useAtomValue(deviceEvoluAtom);
	const [notificationUis, setNotificationUis] = useState<
		Record<string, Atom<NotificationUI>>
	>({});
	const { ndk } = useNostr();
	const jotaiStore = useStore();
	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("notification")
				.leftJoin(
					"notificationVerifyPayment",
					"notificationVerifyPayment.id",
					"notification.id",
				)
				.select([
					"notification.id as id",
					"notification.type as type",
					"notificationVerifyPayment.paymentId as paymentId",
					"notification.createdAt as createdAt",
				] as const)
				.where("notification.isDeleted", "is not", sqliteTrue)
				.orderBy("notification.createdAt", "desc")
				.limit(5),
		[],
	);

	const notificationDefsRef = useRef<Record<string, Promise<() => void>>>({});

	const { mutateAsync: deleteNotification } = useMutation({
		mutationFn: async (id: Id) => {
			getOrThrow(
				evolu.update("notification", {
					id,
					isDeleted: sqliteTrue,
				}),
			);
		},
	});

	const { data: items } = useEvoluQuery(query);

	useEffect(() => {
		const currentIds = new Set(Object.keys(notificationDefsRef.current));
		if (items) {
			for (const item of items) {
				const has = currentIds.delete(item.id);
				if (has) {
					continue;
				}

				notificationDefsRef.current[item.id] = resolveNotificationDef(
					t,
					item,
				).subscribe({
					setNotification: (notificationUi: NotificationUI) => {
						const currentAtom = notificationUis[item.id];
						if (currentAtom) {
							jotaiStore.set(currentAtom, notificationUi);
						}

						setNotificationUis((values) => ({
							...values,
							[item.id]: atom(notificationUi),
						}));
					},
					deleteNotification: deleteNotification.bind(item.id),
					evolu,
					deviceEvolu,
					ndk,
					jotaiStore,
				});
			}
		}

		return () => {
			for (const id of currentIds) {
				const unsubscribePromise = notificationDefsRef.current[id];
				if (unsubscribePromise) {
					unsubscribePromise.then((unsubscribe) => unsubscribe());
				}

				delete notificationDefsRef.current[id];
			}
		};
	}, [items, deleteNotification, evolu, deviceEvolu, ndk, jotaiStore, t]);

	useEffect(() => {
		return () => {
			for (const unsubscribePromise of Object.values(
				notificationDefsRef.current,
			)) {
				unsubscribePromise.then((unsubscribe) => unsubscribe());
			}

			notificationDefsRef.current = {};
		};
	}, []);

	const [isOpen, setIsOpen] = useState(false);
	const actionableItems =
		items?.filter((item) => item.type !== "backgroundTableProcessing") ?? [];
	const unreadCount = actionableItems.length;
	const { mutateAsync: clearAllNotifications, isPending: isClearingAll } =
		useMutation({
			mutationFn: async () => {
				for (const item of actionableItems) {
					getOrThrow(
						evolu.update("notification", {
							id: item.id,
							isDeleted: sqliteTrue,
						}),
					);
				}
			},
		});

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button
					size="icon"
					variant="outline"
					className="relative h-8 w-8 rounded-full bg-card shadow-lg hover:bg-accent"
					aria-label={t("components:notifications.open")}
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				close={false}
				className="h-screen w-full max-w-md p-0"
			>
				<div className="flex h-full flex-col safe-area-t safe-area-b">
					<div className="flex items-center justify-between border-b border-border px-6 py-4">
						<div>
							<SheetTitle className="text-xl font-semibold">
								{t("components:notifications.backgroundJobs")}
							</SheetTitle>
						</div>
						<div className="flex items-center gap-2">
							{unreadCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void clearAllNotifications()}
									disabled={isClearingAll}
									className="text-xs"
								>
									{t("components:notifications.clearAll")}
								</Button>
							)}
							<SheetClose asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									aria-label={t("components:notifications.close")}
								>
									<X className="h-4 w-4" />
								</Button>
							</SheetClose>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto">
						{items === undefined ? (
							<div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
								{t("components:notifications.loading")}
							</div>
						) : items.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center px-6 text-center">
								<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
									<Bell className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mb-2 text-lg font-semibold">
									{t("components:notifications.empty.title")}
								</h3>
								<p className="text-sm text-muted-foreground text-pretty">
									{t("components:notifications.empty.description")}
								</p>
							</div>
						) : (
							<div className="divide-y divide-border">
								{Object.entries(notificationUis).map(([id, notificationUi]) => (
									<NotificationItem
										key={id}
										notificationAtom={notificationUi}
										deleteNotification={deleteNotification.bind(id)}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
