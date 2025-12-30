import { SparkWallet } from "@buildonspark/spark-sdk";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { Timeout } from "@radix-ui/primitive";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Info,
	X,
} from "lucide-react";
import {
	type ComponentProps,
	type FC,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
} from "react";
import { type Pos, posAtom } from "@/atoms/pos";
import { ButtonGroup } from "@/components/ui/button-group";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrSubscription } from "@/hooks/use-nostr-subscription";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import type { ScreenData } from "@/lib/bill/billDriver";
import { FioApiClient } from "@/lib/fio/fio-api-client";
import type { NostrStorageRow } from "@/lib/nostr-storage";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table-message-bus";
import { assertNever } from "@/lib/type-utils";
import { type NonEmptyString, Uuid7 } from "@/lib/types";
import { cn } from "@/lib/utils";
import { accountStorage } from "@/storages/account-storage";
import { fioPluginStorage } from "@/storages/fio-plugin-storage";
import {
	type Notification,
	notificationStorage,
} from "@/storages/notification-storage";
import {
	PaymentStatus,
	paymentStatusStorage,
} from "@/storages/payment-status-storage";
import { paymentStorage } from "@/storages/payment-storage";
import { tableStorage } from "@/storages/table-storage";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

const resolveUiNotification = (
	notification: NostrStorageRow<Notification>,
): BackgroundJob => {
	if (notification.value.type === "verifyPayment") {
		const notificationData = notification.value;

		return {
			title: "Ověření LN platby",
			type: "info",
			progress: null,
			canBeClosed: false,
			description: "Čekáme na příchozí platbu",
			id: notification.value.id,
			timestamp: notification.createdAt,
			actions: [
				{
					buttonProps: {
						children: "Stop waiting",
					},
					callback: ({ deleteNotification }) => {
						deleteNotification();
					},
				},
			],
			Component: ({ deleteNotification }) => {
				const markAsPaid = useRef(false);
				const { ndk } = useNostr();
				const { data: items } = useStorageSubscription(paymentStorage, {
					key: notificationData.paymentId,
				});

				const item = items && items[0];

				const { data: paymentStatusRows } = useStorageSubscription(
					paymentStatusStorage,
					{
						key: notificationData.paymentId,
					},
				);
				const paymentStatus = paymentStatusRows && paymentStatusRows[0];
				useEffect(() => {
					if (paymentStatus?.value.status === PaymentStatus.Paid) {
						deleteNotification();
					}
				}, [paymentStatus?.value.status, deleteNotification]);

				// LN
				{
					const zapWallet =
						item &&
						item.value.paymentOptions.find(
							(paymentOption) => paymentOption.type === "lnZap",
						);

					const ndkSigner = item
						? new NDKPrivateKeySigner(item.value.privateKey)
						: null;

					const { data: zapReceipt } = useNostrSubscription(
						ndkSigner && zapWallet
							? {
									kinds: [9735], // zap receipt
									authors: [zapWallet.walletPubkey],
									"#p": [ndkSigner.pubkey],
									limit: 1,
								}
							: false,
					);

					useEffect(() => {
						if (!markAsPaid.current && zapReceipt && zapReceipt.length > 0) {
							markAsPaid.current = true;

							(async () => {
								await paymentStatusStorage.insertOrUpdate(
									ndk,
									notificationData.paymentId,
									{
										paymentId: notificationData.paymentId,
										status: PaymentStatus.Paid,
										prove: {
											type: "lnZap",
										},
									},
								);
								deleteNotification();
							})();
						}
					}, [zapReceipt, deleteNotification, ndk]);
				}

				// LN Spark
				{
					const sparkWallet =
						item &&
						item.value.paymentOptions.find(
							(paymentOption) => paymentOption.type === "lnSpark",
						);

					useEffect(() => {
						if (!sparkWallet || markAsPaid.current) {
							return;
						}

						const walletPromise = (async () => {
							const { data: accounts } = await accountStorage.select(ndk, {
								key: sparkWallet.accountId,
								limit: 1,
							});

							const account = accounts[0];
							if (account === undefined) {
								return;
							}

							if (account.value._tag !== "spark") {
								return;
							}

							const { wallet } = await SparkWallet.initialize({
								mnemonicOrSeed: account.value.mnemonic,
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
							markAsPaid.current = true;

							await paymentStatusStorage.insertOrUpdate(
								ndk,
								notificationData.paymentId,
								{
									paymentId: notificationData.paymentId,
									status: PaymentStatus.Paid,
									prove: {
										type: "bankTransferCZ",
									},
								},
							);
							deleteNotification();
						}, 5 * 1000);

						return () => {
							walletPromise.then((wallet) => {
								if (wallet) {
									void wallet.cleanupConnections();
								}
							});

							clearInterval(timer);
						};
					}, [deleteNotification, ndk, sparkWallet]);
				}

				// FIO
				const { data: fioPluginRows } = useStorageSubscription(
					fioPluginStorage,
					{
						key: null,
					},
				);

				const fioData = fioPluginRows && fioPluginRows[0];

				const fioApiClient = useMemo(() => {
					if (!fioData) {
						return null;
					}

					return new FioApiClient(
						fioData.value.tokens.map((token) => token.token),
						fioData.value.apiUrl,
					);
				}, [fioData]);

				useEffect(() => {
					if (!item || !fioApiClient || markAsPaid.current || !fioData) {
						return;
					}

					const totalAmount = item.value.bill.items.reduce((acc, item) => {
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
								transaction.Měna === item.value.bill.currency &&
								transaction.Objem === totalAmount
							) {
								console.log("FIO OK");
								markAsPaid.current = true;
								await paymentStatusStorage.insertOrUpdate(
									ndk,
									notificationData.paymentId,
									{
										paymentId: notificationData.paymentId,
										status: PaymentStatus.Paid,
										prove: {
											type: "bankTransferCZ",
										},
									},
								);
								deleteNotification();
							}
						}
					}, fioData.value.numberOfSecondsBetweenChecks * 1000);

					return () => {
						clearInterval(timer);
					};
				}, [fioApiClient, item, fioData, deleteNotification, ndk]);

				return null;
			},
		};
	} else if (notification.value.type === "backgroundTableProcessing") {
		return {
			title: "Table processing is running",
			type: "info",
			canBeClosed: false,
			description:
				"This is only an indication that payment processing from the table is operational.",
			id: notification.value.type,
			Component: () => {
				const { ndk } = useNostr();
				const pos = useAtomValue(posAtom);
				const subscriptionRef = useRef<
					Map<
						Uuid7,
						{ pubkey: string; qrCodeId: NonEmptyString; timeout: Timeout }
					>
				>(new Map());
				const {
					data: tables,
					hasNextPage,
					loadNextPage,
					eose,
				} = useStorageSubscription(tableStorage, {
					limit: 15,
				});

				const getBillByQrCode = useEffectEvent(
					(
						pos: Pos,
						qrCodeId: NonEmptyString,
					): Omit<
						Extract<ScreenData, { variant: "payment" | "refund" }>,
						"pay"
					> => {
						const tableId = (tables ?? []).find((table) =>
							(table.value.qrCodes ?? [])
								.map((qrCode) => qrCode.id)
								.includes(qrCodeId),
						);

						if (tableId === undefined) {
							return {
								variant: "payment",
								payload: {
									bill: null,
								},
							};
						}

						for (const bill of Object.values(pos.bills)) {
							if (bill.table && bill.table.id === tableId.value.id) {
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
					},
				);

				const sendBillChange = useEffectEvent(
					(input: {
						pubkey: string;
						qrCodeId: NonEmptyString;
						subscriptionId: Uuid7;
					}) => {
						void tableEventMessageBus
							.createInstance({
								pubkey: input.pubkey,
							})
							.getClient({
								ndk,
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
					},
				);

				useEffect(() => {
					for (const [
						subscriptionId,
						{ pubkey, qrCodeId },
					] of subscriptionRef.current.entries()) {
						void tableEventMessageBus
							.createInstance({
								pubkey,
							})
							.getClient({
								ndk,
							})
							.call(
								"billChange",
								{
									billScreenData: getBillByQrCode(pos, qrCodeId),
									subscriptionId,
								},
								{
									ignoreResponse: true,
								},
							);
					}
				}, [pos, ndk]);

				useEffect(() => {
					console.log("pubkey", ndk.signer.pubkey);
					const serverPromise = tableRequestMessageBus
						.createInstance({
							pubkey: ndk.signer.pubkey,
						})
						.listen(
							{
								ndk,
							},
							{
								subscribeToBillByQrCode: async (input) => {
									const subscriptionId = input.subscriptionId ?? Uuid7.random();
									const subscription =
										subscriptionRef.current.get(subscriptionId);
									if (subscription !== undefined) {
										clearTimeout(subscription.timeout);
										subscription.timeout = setTimeout(() => {
											subscriptionRef.current.delete(subscriptionId);
										}, 30_000);
										return {
											subscriptionId,
										};
									}

									subscriptionRef.current.set(subscriptionId, {
										pubkey: input.pubkey,
										qrCodeId: input.qrCodeId,
										timeout: setTimeout(() => {
											subscriptionRef.current.delete(subscriptionId);
										}, 30_000),
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
									subscriptionRef.current.delete(input.subscriptionId);
									return null;
								},
							},
						);

					return () => {
						serverPromise.then((server) => server.close());
					};
				}, [ndk, ndk.signer.pubkey]);

				return null;
			},
		};
	}

	assertNever(notification.value);
};

type BackgroundJob = {
	id: string;
	title: string;
	description: string;
	type: "info" | "success" | "warning" | "error";
	timestamp?: number;
	progress?: number | null; // Use null for an unknown time horizon (rotating spinner)
	canBeClosed?: boolean;
	Component?: FC<{
		deleteNotification: () => unknown;
	}>;
	actions?: {
		buttonProps: ComponentProps<typeof Button>;
		callback: (params: { deleteNotification: () => unknown }) => unknown;
	}[];
};

export function NotificationItem({
	notification,
}: {
	notification: NostrStorageRow<Notification>;
}) {
	const uiNotification = useMemo(
		() => resolveUiNotification(notification),
		[notification],
	);
	const { ndk } = useNostr();
	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			await notificationStorage.delete(ndk, notification.eventId);
		},
	});

	const getIcon = () => {
		switch (uiNotification.type) {
			case "success":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "error":
				return <AlertCircle className="h-5 w-5 text-red-500" />;
			case "warning":
				return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			default:
				return <Info className="h-5 w-5 text-blue-500" />;
		}
	};

	const getAccentColor = () => {
		switch (uiNotification.type) {
			case "success":
				return "border-l-green-500";
			case "error":
				return "border-l-red-500";
			case "warning":
				return "border-l-yellow-500";
			default:
				return "border-l-blue-500";
		}
	};

	const Component = uiNotification.Component;
	const actionComponents = uiNotification.actions
		? uiNotification.actions.map((action, index) => (
				<Button
					key={index.toString()}
					{...action.buttonProps}
					onClick={() => {
						action.callback({
							deleteNotification: deleteItem,
						});
					}}
				/>
			))
		: [];

	const ComponentKey = Component && JSON.stringify(notification.value);

	return (
		<div
			className={cn(
				"group relative border-l-4 bg-card px-6 py-4 transition-colors hover:bg-accent",
				getAccentColor(),
			)}
		>
			{Component && (
				<Component key={ComponentKey} deleteNotification={deleteItem} />
			)}

			<div className="flex gap-4">
				<div className="flex-shrink-0 pt-0.5">{getIcon()}</div>
				<div className="flex-1 space-y-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1 space-y-1">
							<h3 className="font-semibold leading-none">
								{uiNotification.title}
							</h3>
							<p className="text-sm text-muted-foreground">
								{uiNotification.description}
							</p>
						</div>
						{uiNotification.canBeClosed && (
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
								onClick={() => {}}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
					{uiNotification.progress !== undefined && (
						<div className="space-y-1">
							<Progress value={uiNotification.progress} className="h-1.5" />
							<p className="text-xs text-muted-foreground">
								{uiNotification.progress}%
							</p>
						</div>
					)}
					{uiNotification.timestamp && (
						<p className="text-xs text-muted-foreground">
							{new Date(uiNotification.timestamp).toLocaleTimeString()}
						</p>
					)}
					{actionComponents.length > 0 && actionComponents.length > 1 ? (
						<ButtonGroup size={"sm"}>{actionComponents}</ButtonGroup>
					) : (
						actionComponents
					)}
				</div>
			</div>
		</div>
	);
}
