import {
	createIdFromString,
	getOrThrow,
	type Id,
	sqliteTrue,
} from "@evolu/common";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { sql } from "kysely";
import type { BackgroundProcess } from "@/lib/background/service";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import {
	extractBtcAmountFromLightningInvoice,
	extractPaymentHashFromLnInvoice,
} from "@/lib/shared/utils/ln";

const notificationId = createIdFromString("syncLnZapTransfers");

type WatchedLnZapPayment = {
	id: Id;
	accountId: Id | null;
	privateKey: string | null;
	walletPubkey: string | null;
	lnInvoice: string | null;
	amount: number | null;
};

const splitAmountByExpectedAllocation = (params: {
	amount: number;
	expectedProductAmount: number;
	expectedTipAmount: number;
}) => {
	let remainingAmount = Math.max(0, params.amount);

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

const createZapPairKey = (authorPubkey: string, recipientPubkey: string) =>
	`${authorPubkey}|${recipientPubkey}`;

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

		const watchedPaymentsById = new Map<Id, WatchedLnZapPayment>();
		let watchedPaymentsByPair = new Map<string, WatchedLnZapPayment[]>();
		let zapReceiptSubscription: { stop: () => void } | null = null;
		let activeZapFilterSignature: string | null = null;
		const verifiedPaymentIds = new Set<Id>();
		const processingPaymentIds = new Set<Id>();
		let syncInProgress = false;
		let queuedWatchedPayments: ReadonlyArray<WatchedLnZapPayment> | null = null;

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

		const upsertTransactionFromReceipt = async (params: {
			payment: WatchedLnZapPayment;
			occurredAtSec: number | null;
		}) => {
			const { payment, occurredAtSec } = params;
			if (!payment.accountId || !payment.lnInvoice) {
				return false;
			}
			if (
				verifiedPaymentIds.has(payment.id) ||
				!watchedPaymentsById.has(payment.id) ||
				processingPaymentIds.has(payment.id)
			) {
				return false;
			}

			processingPaymentIds.add(payment.id);

			try {
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
							occurredAtSec === null ? Date.now() : occurredAtSec * 1000,
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
				getOrThrow(
					props.evolu.update("paymentWatchingState", {
						id: payment.id,
						verifiedAt: Date.now(),
						proveType: "lnZap",
						transactionId,
					}),
				);

				verifiedPaymentIds.add(payment.id);
				watchedPaymentsById.delete(payment.id);
				return true;
			} finally {
				processingPaymentIds.delete(payment.id);
			}
		};

		const watchedPaymentsQuery = props.evolu.createQuery((db) =>
			db
				.selectFrom("payment")
				.innerJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
				.innerJoin(
					"paymentWatchingState",
					"paymentWatchingState.id",
					"payment.id",
				)
				.select([
					"payment.id as id",
					"payment.privateKey as privateKey",
					"paymentLnZap.accountId as accountId",
					"paymentLnZap.walletPubkey as walletPubkey",
					"paymentLnZap.lnInvoice as lnInvoice",
					"paymentLnZap.amount as amount",
				] as const)
				.where("payment.isDeleted", "is not", sqliteTrue)
				.where("paymentLnZap.isDeleted", "is not", sqliteTrue)
				.where("paymentWatchingState.isDeleted", "is not", sqliteTrue)
				.where("paymentWatchingState.verifiedAt", "is", null)
				.where("paymentWatchingState.stoppedAt", "is", null),
		);

		const syncWatchList = async (
			initialWatchedPayments: ReadonlyArray<WatchedLnZapPayment>,
		) => {
			if (syncInProgress) {
				queuedWatchedPayments = initialWatchedPayments;
				return;
			}
			syncInProgress = true;

			try {
				const nextWatchedPaymentsById = new Map<Id, WatchedLnZapPayment>();
				const nextWatchedPaymentsByPair = new Map<
					string,
					WatchedLnZapPayment[]
				>();
				const authors = new Set<string>();
				const recipients = new Set<string>();

				for (const payment of initialWatchedPayments) {
					if (
						verifiedPaymentIds.has(payment.id) ||
						!payment.privateKey ||
						!payment.walletPubkey
					) {
						continue;
					}

					const signer = new NDKPrivateKeySigner(payment.privateKey);
					const recipientPubkey = signer.pubkey;
					const pairKey = createZapPairKey(
						payment.walletPubkey,
						recipientPubkey,
					);

					const pairPayments = nextWatchedPaymentsByPair.get(pairKey) ?? [];
					pairPayments.push(payment);
					nextWatchedPaymentsByPair.set(pairKey, pairPayments);
					nextWatchedPaymentsById.set(payment.id, payment);
					authors.add(payment.walletPubkey);
					recipients.add(recipientPubkey);
				}

				for (const paymentId of watchedPaymentsById.keys()) {
					if (!nextWatchedPaymentsById.has(paymentId)) {
						verifiedPaymentIds.delete(paymentId);
						processingPaymentIds.delete(paymentId);
					}
				}

				watchedPaymentsById.clear();
				for (const [id, payment] of nextWatchedPaymentsById) {
					watchedPaymentsById.set(id, payment);
				}
				watchedPaymentsByPair = nextWatchedPaymentsByPair;

				const filterAuthors = Array.from(authors).sort();
				const filterRecipients = Array.from(recipients).sort();
				const nextFilterSignature = JSON.stringify({
					authors: filterAuthors,
					recipients: filterRecipients,
				});

				if (filterAuthors.length === 0 || filterRecipients.length === 0) {
					if (zapReceiptSubscription !== null) {
						zapReceiptSubscription.stop();
						zapReceiptSubscription = null;
						activeZapFilterSignature = null;
					}
				} else if (nextFilterSignature !== activeZapFilterSignature) {
					if (zapReceiptSubscription !== null) {
						zapReceiptSubscription.stop();
					}

					zapReceiptSubscription = props.ndk.subscribe(
						{
							kinds: [9735], // zap receipt
							authors: filterAuthors,
							"#p": filterRecipients,
							limit: 50,
						},
						{},
						{
							onEvent: (receipt) => {
								const authorPubkey = receipt.pubkey;
								if (!authorPubkey) {
									return;
								}

								const recipientPubkeys = receipt.tags
									.filter(
										(tag): tag is [string, string, ...string[]] =>
											tag[0] === "p" && typeof tag[1] === "string",
									)
									.map((tag) => tag[1]);

								let matched = false;
								const matchedPayments = new Map<Id, WatchedLnZapPayment>();
								for (const recipientPubkey of recipientPubkeys) {
									const payments = watchedPaymentsByPair.get(
										createZapPairKey(authorPubkey, recipientPubkey),
									);
									if (!payments) {
										continue;
									}

									for (const payment of payments) {
										if (
											verifiedPaymentIds.has(payment.id) ||
											!watchedPaymentsById.has(payment.id)
										) {
											continue;
										}

										matchedPayments.set(payment.id, payment);
										matched = true;
									}
								}

								if (!matched) {
									return;
								}

								void (async () => {
									let createdCount = 0;
									for (const payment of matchedPayments.values()) {
										const created = await upsertTransactionFromReceipt({
											payment,
											occurredAtSec: receipt.created_at ?? null,
										});
										if (created) {
											createdCount += 1;
										}
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
								})();
							},
						},
					);
					activeZapFilterSignature = nextFilterSignature;
				}

				notification.update({
					title: "LN zap receipts",
					type: "info",
					progress: null,
					canBeClosed: true,
					description: `Watching ${watchedPaymentsById.size} LN zap payment(s).`,
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
				const nextWatchedPayments = queuedWatchedPayments;
				queuedWatchedPayments = null;
				if (nextWatchedPayments !== null) {
					void syncWatchList(nextWatchedPayments);
				}
			}
		};

		const unsubscribeWatchedPayments = subscribeToEvoluQuery(
			props.evolu,
			watchedPaymentsQuery,
			(watchedPayments) => {
				const nextWatchedPayments =
					watchedPayments as ReadonlyArray<WatchedLnZapPayment>;
				if (syncInProgress) {
					queuedWatchedPayments = nextWatchedPayments;
					return;
				}

				void syncWatchList(nextWatchedPayments);
			},
		);

		return () => {
			unsubscribeWatchedPayments();
			if (zapReceiptSubscription !== null) {
				zapReceiptSubscription.stop();
			}
			watchedPaymentsById.clear();
			watchedPaymentsByPair.clear();
			processingPaymentIds.clear();
		};
	},
};
