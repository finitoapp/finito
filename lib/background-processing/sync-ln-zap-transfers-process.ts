import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { BackgroundProcess } from "@/lib/background-processing/background-process";
import {
	extractBtcAmountFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/ln-utils";
import { PaymentStatus } from "@/storages/payment-status-storage";

const notificationId = createIdFromString("syncLnZapTransfers");
const refreshIntervalMs = 30_000;

type WatchedLnZapPayment = {
	id: Id;
	accountId: Id | null;
	privateKey: string | null;
	walletPubkey: string | null;
	lnInvoice: string | null;
	amount: number | null;
	status: string | null;
};

export const syncLnZapTransfersProcess: BackgroundProcess = {
	name: "syncLnZapTransfers",
	run: async (props) => {
		const notification = props.addNotification({
			title: "LN zap receipts",
			type: "info",
			progress: null,
			canBeClosed: true,
			description: "Watching LN zap payments...",
			isUnread: false,
			id: notificationId,
			timestamp: Date.now(),
		});

		const subscriptions = new Map<Id, { stop: () => void }>();
		const pendingReceipts = new Map<
			Id,
			{
				payment: WatchedLnZapPayment;
				occurredAtSec: number | null;
			}
		>();
		const verifiedPaymentIds = new Set<Id>();
		let syncInProgress = false;

		const findPaymentIdsByPaymentHash = async (paymentHash: string) => {
			const zapPayments = await props.evolu.loadQuery(
				props.evolu.createQuery((db) =>
					db
						.selectFrom("payment")
						.innerJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
						.select(["payment.id as id"] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("paymentLnZap.isDeleted", "is not", sqliteTrue)
						.where("paymentLnZap.paymentHash", "=", paymentHash),
				),
			);
			const sparkPayments = await props.evolu.loadQuery(
				props.evolu.createQuery((db) =>
					db
						.selectFrom("payment")
						.innerJoin("paymentLnSpark", "paymentLnSpark.id", "payment.id")
						.select(["payment.id as id"] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("paymentLnSpark.isDeleted", "is not", sqliteTrue)
						.where("paymentLnSpark.paymentHash", "=", paymentHash),
				),
			);

			const paymentIds = new Set<Id>();
			for (const row of zapPayments) {
				if (row.id === null) continue;
				paymentIds.add(row.id);
			}
			for (const row of sparkPayments) {
				if (row.id === null) continue;
				paymentIds.add(row.id);
			}
			return Array.from(paymentIds);
		};

		const upsertPaymentMatchingClaims = async (payload: {
			transactionId: Id;
			paymentHash: string;
		}) => {
			const paymentIds = await findPaymentIdsByPaymentHash(payload.paymentHash);

			for (const paymentId of paymentIds) {
				const claimId = createIdFromString(
					`reconciliationClaim:lnPaymentHash:${payload.transactionId}:${paymentId}`,
				);
				getOrThrow(
					props.evolu.upsert("reconciliationClaim", {
						id: claimId,
						sourceType: "transaction",
						sourceId: payload.transactionId,
						entityType: "payment",
						entityId: paymentId,
						confidence: 1,
						rule: "lnPaymentHash",
						createdBy: "syncLnZapTransfersProcess",
					}),
				);
			}
		};

		const upsertTransactionsFromPendingReceipts = async () => {
			let createdCount = 0;

			for (const [paymentId, pending] of pendingReceipts.entries()) {
				const { payment } = pending;
				console.log("payment...", payment);

				if (!payment.accountId || !payment.lnInvoice) {
					continue;
				}

				const transactionId = createIdFromString(`lnZapReceipt:${payment.id}`);
				const amount = extractBtcAmountFromLightningInvoice(payment.lnInvoice);
				const paymentHash = extractPaymentHashFromLnInvoice(payment.lnInvoice);

				getOrThrow(
					props.evolu.upsert("transaction", {
						id: transactionId,
						accountId: payment.accountId,
						_tag: "accountLud16",
						amount,
						occurredAt:
							pending.occurredAtSec === null
								? Date.now()
								: pending.occurredAtSec * 1000,
						note: "Incoming LN zap payment",
						internalTransferGroupId: null,
					}),
				);
				getOrThrow(
					props.evolu.upsert("transactionLud16", {
						id: transactionId,
						lnInvoice: payment.lnInvoice,
						paymentHash,
					}),
				);
				await upsertPaymentMatchingClaims({
					transactionId,
					paymentHash,
				});

				verifiedPaymentIds.add(paymentId);
				pendingReceipts.delete(paymentId);

				const subscription = subscriptions.get(paymentId);
				if (subscription) {
					subscription.stop();
					subscriptions.delete(paymentId);
				}

				createdCount += 1;
			}

			if (createdCount > 0) {
				notification.update({
					title: "LN zap receipts",
					type: "success",
					progress: null,
					canBeClosed: true,
					description: `Verified ${createdCount} LN zap payment(s).`,
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			}
		};

		const syncWatchList = async () => {
			if (syncInProgress) return;
			syncInProgress = true;

			try {
				const watchedPayments = await props.evolu.loadQuery(
					props.evolu.createQuery((db) =>
						db
							.selectFrom("payment")
							.innerJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
							.leftJoin("paymentStatus", "paymentStatus.id", "payment.id")
							.select([
								"payment.id as id",
								"payment.privateKey as privateKey",
								"paymentLnZap.accountId as accountId",
								"paymentLnZap.walletPubkey as walletPubkey",
								"paymentLnZap.lnInvoice as lnInvoice",
								"paymentLnZap.amount as amount",
								"paymentStatus.status as status",
							] as const)
							.where("payment.isDeleted", "is not", sqliteTrue)
							.where("paymentLnZap.isDeleted", "is not", sqliteTrue),
					),
				);

				const watchedPaymentIds = new Set(
					watchedPayments.map((payment) => payment.id),
				);

				for (const [paymentId, subscription] of subscriptions.entries()) {
					if (!watchedPaymentIds.has(paymentId)) {
						subscription.stop();
						subscriptions.delete(paymentId);
						pendingReceipts.delete(paymentId);
						verifiedPaymentIds.delete(paymentId);
					}
				}

				for (const payment of watchedPayments) {
					if (
						payment.status === PaymentStatus.Paid ||
						verifiedPaymentIds.has(payment.id) ||
						subscriptions.has(payment.id) ||
						!payment.privateKey ||
						!payment.walletPubkey
					) {
						continue;
					}

					console.log("watching.....");
					const signer = new NDKPrivateKeySigner(payment.privateKey);
					const subscription = props.ndk.subscribe(
						{
							kinds: [9735], // zap receipt
							authors: [payment.walletPubkey],
							"#p": [signer.pubkey],
							limit: 1,
						},
						{},
						{
							onEvent: (receipt) => {
								console.log("receipt.....");
								pendingReceipts.set(payment.id, {
									payment,
									occurredAtSec: receipt.created_at ?? null,
								});
								void upsertTransactionsFromPendingReceipts();
							},
						},
					);

					subscriptions.set(payment.id, {
						stop: () => subscription.stop(),
					});
				}

				await upsertTransactionsFromPendingReceipts();

				notification.update({
					title: "LN zap receipts",
					type: "info",
					progress: null,
					canBeClosed: true,
					description: `Watching ${subscriptions.size} LN zap payment(s).`,
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} catch (error) {
				notification.update({
					title: "LN zap receipts",
					type: "error",
					progress: null,
					canBeClosed: true,
					description:
						error instanceof Error
							? `Watcher failed: ${error.message}`
							: "Watcher failed due to unknown error.",
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} finally {
				syncInProgress = false;
			}
		};

		void syncWatchList();
		const interval = globalThis.setInterval(() => {
			void syncWatchList();
		}, refreshIntervalMs);

		return () => {
			globalThis.clearInterval(interval);
			for (const subscription of subscriptions.values()) {
				subscription.stop();
			}
			subscriptions.clear();
			pendingReceipts.clear();
		};
	},
};
