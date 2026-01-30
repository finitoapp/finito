import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
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
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useNostr } from "@/hooks/use-nostr";
import { useNostrSubscription } from "@/hooks/use-nostr-subscription";
import type { ScreenData } from "@/lib/bill/billDriver";
import { FioApiClient } from "@/lib/fio/fio-api-client";
import {
	tableEventMessageBus,
	tableRequestMessageBus,
} from "@/lib/table-message-bus";
import { type NonEmptyString, Uuid7 } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Notification } from "@/storages/notification-storage";
import { PaymentStatus } from "@/storages/payment-status-storage";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

const resolveUiNotification = (
	notification: Notification & { id: Id; createdAt: number },
): BackgroundJob => {
	if (notification.type === "verifyPayment") {
		const notificationData = notification;

		return {
			title: "Ověření LN platby",
			type: "info",
			progress: null,
			canBeClosed: false,
			description: "Čekáme na příchozí platbu",
			id: notification.id,
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
				const evolu = useEvolu();
				const paymentId = notificationData.paymentId as Id;
				const paymentQuery = useCreateQuery(
					(db) =>
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
					[paymentId],
				);
				const paymentBillItemsQuery = useCreateQuery(
					(db) =>
						db
							.selectFrom("paymentBillItem")
							.select([
								"paymentBillItem.price as price",
								"paymentBillItem.quantity as quantity",
								"paymentBillItem.label as label",
							] as const)
							.where("paymentBillItem.isDeleted", "is not", sqliteTrue)
							.where("paymentBillItem.paymentId", "=", paymentId),
					[paymentId],
				);
				const { data: paymentRows } = useEvoluQuery(paymentQuery);
				const { data: paymentBillItemsRows } = useEvoluQuery(
					paymentBillItemsQuery,
				);
				const item = useMemo(() => {
					const payment = paymentRows?.[0];
					if (!payment || !payment.privateKey || !payment.billCurrency) {
						return null;
					}

					return {
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
				}, [paymentRows, paymentBillItemsRows]);

				const paymentStatusQuery = useCreateQuery(
					(db) =>
						db
							.selectFrom("paymentStatus")
							.select(["paymentStatus.status as status"] as const)
							.where("paymentStatus.isDeleted", "is not", sqliteTrue)
							.where("paymentStatus.id", "=", notificationData.paymentId as Id),
					[notificationData.paymentId],
				);
				const { data: paymentStatusRows } = useEvoluQuery(paymentStatusQuery);
				const paymentStatus = paymentStatusRows?.[0];
				useEffect(() => {
					if (paymentStatus?.status === PaymentStatus.Paid) {
						deleteNotification();
					}
				}, [paymentStatus?.status, deleteNotification]);

				// LN
				{
					const zapWallet =
						item &&
						item.paymentOptions.find(
							(paymentOption) => paymentOption.type === "lnZap",
						);

					const ndkSigner = item
						? new NDKPrivateKeySigner(item.privateKey)
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
								getOrThrow(
									evolu.upsert("paymentStatus", {
										id: notificationData.paymentId as Id,
										status: PaymentStatus.Paid,
										proveType: "lnZap",
									}),
								);
								deleteNotification();
							})();
						}
					}, [zapReceipt, deleteNotification, evolu]);
				}

				// LN Spark
				{
					const sparkWallet =
						item &&
						item.paymentOptions.find(
							(paymentOption) => paymentOption.type === "lnSpark",
						);

					useEffect(() => {
						if (!sparkWallet || markAsPaid.current) {
							return;
						}

						const walletPromise = (async () => {
							const accounts = await evolu.loadQuery(
								evolu.createQuery((db) =>
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
							markAsPaid.current = true;

							getOrThrow(
								evolu.upsert("paymentStatus", {
									id: notificationData.paymentId as Id,
									status: PaymentStatus.Paid,
									proveType: "bankTransferCZ",
								}),
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
					}, [deleteNotification, sparkWallet, evolu]);
				}

				// FIO
				const fioPluginId = createIdFromString("");
				const fioPluginQuery = useCreateQuery(
					(db) =>
						db
							.selectFrom("fioPlugin")
							.selectAll()
							.where("isDeleted", "is not", sqliteTrue)
							.where("id", "=", fioPluginId),
					[fioPluginId],
				);
				const { data: fioPluginRows } = useEvoluQuery(fioPluginQuery);

				const fioPluginTokenQuery = useCreateQuery(
					(db) =>
						db
							.selectFrom("fioPluginToken")
							.select(["fioPluginToken.token as token"] as const)
							.where("fioPluginToken.isDeleted", "is not", sqliteTrue)
							.where("fioPluginToken.fioPluginId", "=", fioPluginId),
					[fioPluginId],
				);
				const { data: fioPluginTokens } = useEvoluQuery(fioPluginTokenQuery);

				const fioData = fioPluginRows && fioPluginRows[0];

				const fioApiClient = useMemo(() => {
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
				}, [
					fioData?.apiUrl,
					fioData?.numberOfSecondsBetweenChecks,
					fioPluginTokens,
				]);

				useEffect(() => {
					if (!item || !fioApiClient || markAsPaid.current || !fioData) {
						return;
					}

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
								markAsPaid.current = true;
								getOrThrow(
									evolu.upsert("paymentStatus", {
										id: notificationData.paymentId as Id,
										status: PaymentStatus.Paid,
										proveType: "bankTransferCZ",
									}),
								);
								deleteNotification();
							}
						}
					}, fioData.numberOfSecondsBetweenChecks * 1000);

					return () => {
						clearInterval(timer);
					};
				}, [fioApiClient, item, fioData, deleteNotification, evolu]);

				return null;
			},
		};
	} else if (notification.type === "backgroundTableProcessing") {
		return {
			title: "Table processing is running",
			type: "info",
			canBeClosed: false,
			description:
				"This is only an indication that payment processing from the table is operational.",
			id: notification.type,
			Component: () => {
				const { ndk } = useNostr();
				const pos = useAtomValue(posAtom);
				const subscriptionRef = useRef<
					Map<
						Uuid7,
						{ pubkey: string; qrCodeId: NonEmptyString; timeout: Timeout }
					>
				>(new Map());
				const tableCodesQuery = useCreateQuery(
					(db) =>
						db
							.selectFrom("tableCode")
							.select([
								"tableCode.id as id",
								"tableCode.tableId as tableId",
							] as const)
							.where("tableCode.isDeleted", "is not", sqliteTrue),
					[],
				);
				const { data: tableCodes } = useEvoluQuery(tableCodesQuery);

				const getBillByQrCode = useEffectEvent(
					(
						pos: Pos,
						qrCodeId: NonEmptyString,
					): Omit<
						Extract<ScreenData, { variant: "payment" | "refund" }>,
						"pay"
					> => {
						const tableCode = (tableCodes ?? []).find(
							(code) => code.id === qrCodeId,
						);

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

	throw new Error("Unsupported notification type");
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
	notification: Notification & { id: Id; createdAt: number };
}) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: It's OK
	const uiNotification = useMemo(
		() => resolveUiNotification(notification),
		[notification.id],
	);
	const evolu = useEvolu();
	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			getOrThrow(
				evolu.update("notification", {
					id: notification.id,
					isDeleted: sqliteTrue,
				}),
			);
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

	const ComponentKey = Component && JSON.stringify(notification);

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
				<div className="shrink-0 pt-0.5">{getIcon()}</div>
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
