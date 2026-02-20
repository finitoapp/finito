import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { sql } from "kysely";
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

const splitAmountByExpectedAllocation = (params: {
	amount: number;
	expectedProductAmount: number;
	expectedTipAmount: number;
}) => {
	const totalAmount = Math.max(0, params.amount);
	let remainingAmount = totalAmount;

	const productAmount = Math.min(
		Math.max(0, params.expectedProductAmount),
		remainingAmount,
	);
	remainingAmount -= productAmount;

	const tipAmount = Math.min(
		Math.max(0, params.expectedTipAmount),
		remainingAmount,
	);
	remainingAmount -= tipAmount;

	return {
		productAmount,
		tipAmount,
		overpaymentAmount: remainingAmount,
	};
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
			const paymentRows = await props.evolu.loadQuery(
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

			return paymentRows.map((row) => row.id as Id);
		};

		const findExpectedAllocationByPaymentId = async (paymentId: Id) => {
			const paymentRows = await props.evolu.loadQuery(
				props.evolu.createQuery((db) =>
					db
						.selectFrom("payment")
						.leftJoin("paymentBillItem", (join) =>
							join
								.onRef("paymentBillItem.paymentId", "=", "payment.id")
								.on("paymentBillItem.isDeleted", "is not", sqliteTrue),
						)
						.select([
							"payment.expectedTipAmount as expectedTipAmount",
							sql<number>`
								coalesce(
									sum("paymentBillItem"."price" * "paymentBillItem"."quantity"),
									0
								)
							`.as("expectedProductAmount"),
						] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("payment.id", "=", paymentId)
						.groupBy("payment.id")
						.groupBy("payment.expectedTipAmount")
						.limit(1),
				),
			);

			const payment = paymentRows[0];
			if (payment === undefined) {
				return null;
			}

			return {
				expectedProductAmount: payment.expectedProductAmount ?? 0,
				expectedTipAmount: payment.expectedTipAmount ?? 0,
			};
		};

		const upsertPaymentMatchingClaims = async (payload: {
			transactionId: Id;
			paymentHash: string;
			amount: number;
		}) => {
			const paymentIds = await findPaymentIdsByPaymentHash(payload.paymentHash);

			for (const paymentId of paymentIds) {
				const expectedAllocation =
					await findExpectedAllocationByPaymentId(paymentId);
				if (expectedAllocation === null) {
					continue;
				}

				const splitAllocation = splitAmountByExpectedAllocation({
					amount: payload.amount,
					expectedProductAmount: expectedAllocation.expectedProductAmount,
					expectedTipAmount: expectedAllocation.expectedTipAmount,
				});

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
				const allocationId = createIdFromString(
					`reconciliationClaimAllocation:${claimId}:product`,
				);
				getOrThrow(
					props.evolu.upsert("reconciliationClaimAllocation", {
						id: allocationId,
						claimId,
						componentType: "product",
						amount: splitAllocation.productAmount,
					}),
				);
				getOrThrow(
					props.evolu.upsert("reconciliationClaimAllocation", {
						id: createIdFromString(
							`reconciliationClaimAllocation:${claimId}:tip`,
						),
						claimId,
						componentType: "tip",
						amount: splitAllocation.tipAmount,
					}),
				);
				getOrThrow(
					props.evolu.upsert("reconciliationClaimAllocation", {
						id: createIdFromString(
							`reconciliationClaimAllocation:${claimId}:overpayment`,
						),
						claimId,
						componentType: "overpayment",
						amount: splitAllocation.overpaymentAmount,
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
					amount,
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
