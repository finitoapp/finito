import {
	createIdFromString,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { type Nip47Notification, NWCClient } from "@getalby/sdk/nwc";
import { sql } from "kysely";
import { z } from "zod";
import type { BackgroundProcess } from "@/lib/background/service";
import { createQuery } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import { createUpsertLnPaymentHashReconciliationClaims } from "@/lib/reconciliation/service";
import {
	Currency,
	Integer,
	NonEmptyString,
	TimestampMs,
} from "@/lib/shared/types";
import { stableStringify } from "@/lib/shared/utils/json";

const notificationId = createIdFromString("syncNwcTransfers");
const syncIntervalMs = 30_000;
const listTransactionsPageSize = 50;
const transferHistoryOverlapMs = 60 * 60 * 1000;

type NwcTransaction = {
	raw: Record<string, unknown>;
	type: "incoming" | "outgoing";
	state: NonEmptyString | null;
	paymentHash: NonEmptyString | null;
	invoice: NonEmptyString | null;
	description: NonEmptyString | null;
	amountMsats: number;
	feesPaidMsats: number | null;
	createdAtSec: number | null;
	settledAtSec: number | null;
};

type NwcListTransactionsResult = {
	receivedCount: number;
	transactions: readonly NwcTransaction[];
};

type NwcClient = {
	credentials: NonEmptyString;
	client: NWCClient;
	notificationUnsubscribe: (() => void) | null;
};

const rawRecordSchema = z.record(z.string(), z.unknown());

const finiteNumberSchema = z
	.union([z.number(), z.string()])
	.transform((value, context) => {
		const parsed =
			typeof value === "number"
				? value
				: value.trim().length === 0
					? Number.NaN
					: Number(value.trim());
		if (!Number.isFinite(parsed)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Expected a finite number",
			});
			return z.NEVER;
		}
		return parsed;
	});

const optionalTextSchema = z
	.union([z.number(), z.string(), z.null(), z.undefined()])
	.transform((value): NonEmptyString | null => {
		if (value === null || value === undefined) return null;
		const trimmed = `${value}`.trim();
		return trimmed.length === 0 ? null : NonEmptyString(trimmed);
	});

const optionalNormalizedHashSchema = optionalTextSchema.transform((value) =>
	value === null ? null : NonEmptyString(value.toLowerCase()),
);

const optionalNonNegativeFiniteNumberSchema = z
	.union([z.number(), z.string(), z.null(), z.undefined()])
	.transform((value): number | null => {
		if (value === null || value === undefined) return null;

		const parsed =
			typeof value === "number"
				? value
				: value.trim().length === 0
					? Number.NaN
					: Number(value.trim());
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
	});

const optionalTimestampSecSchema = z
	.union([z.number(), z.string(), z.null(), z.undefined()])
	.transform((value): number | null => {
		if (value === null || value === undefined) return null;

		const parsed =
			typeof value === "number"
				? value
				: value.trim().length === 0
					? Number.NaN
					: Number(value.trim());
		if (!Number.isFinite(parsed)) return null;

		const normalized = Math.trunc(parsed);
		return normalized >= 0 ? normalized : null;
	});

const nwcTransactionSchema = z
	.object({
		type: z.enum(["incoming", "outgoing"]),
		state: optionalTextSchema.transform((value) =>
			value === null ? null : NonEmptyString(value.toLowerCase()),
		),
		payment_hash: optionalNormalizedHashSchema,
		invoice: optionalTextSchema,
		description: optionalTextSchema,
		amount: finiteNumberSchema.refine((value) => value > 0, {
			message: "Expected a positive amount",
		}),
		fees_paid: optionalNonNegativeFiniteNumberSchema,
		created_at: optionalTimestampSecSchema,
		settled_at: optionalTimestampSecSchema,
	})
	.passthrough();

const parseNwcTransaction = (value: unknown): NwcTransaction | null => {
	const rawResult = rawRecordSchema.safeParse(value);
	if (!rawResult.success) {
		return null;
	}

	const parsed = nwcTransactionSchema.safeParse(rawResult.data);
	if (!parsed.success) {
		return null;
	}

	const data = parsed.data;

	return {
		raw: rawResult.data,
		type: data.type,
		state: data.state,
		paymentHash: data.payment_hash,
		invoice: data.invoice,
		description: data.description,
		amountMsats: data.amount,
		feesPaidMsats: data.fees_paid,
		createdAtSec: data.created_at,
		settledAtSec: data.settled_at,
	};
};

const toNwcSyncAmountSats = (transaction: NwcTransaction): Integer | null => {
	const amountSats = Math.trunc(transaction.amountMsats / 1000);
	if (amountSats <= 0) return null;

	const feesPaidSats =
		transaction.feesPaidMsats === null
			? 0
			: Math.max(0, Math.trunc(transaction.feesPaidMsats / 1000));
	const signedAmount =
		transaction.type === "incoming" ? amountSats : -(amountSats + feesPaidSats);

	return signedAmount === 0 ? null : Integer(signedAmount);
};

const resolveOccurredAt = (transaction: NwcTransaction): TimestampMs => {
	const timestampSec =
		transaction.settledAtSec ??
		transaction.createdAtSec ??
		Math.floor(Date.now() / 1000);
	return TimestampMs(timestampSec * 1000);
};

const shouldPersistNwcTransaction = (transaction: NwcTransaction) => {
	if (transaction.state === null) {
		return true;
	}

	return transaction.state === "settled";
};

const createNwcTransactionId = (params: {
	accountId: Id;
	transaction: NwcTransaction;
}) => {
	const dedupeKey =
		params.transaction.paymentHash ??
		NonEmptyString(stableStringify(params.transaction.raw));

	return createIdFromString(
		`nwcTransaction:${params.accountId}:${params.transaction.type}:${dedupeKey}`,
	);
};

const requestNwcListTransactions = async (params: {
	client: NwcClient;
	fromSec?: number;
	limit: number;
	offset: number;
}): Promise<NwcListTransactionsResult | null> => {
	const result = await params.client.client.listTransactions({
		...(params.fromSec === undefined ? {} : { from: params.fromSec }),
		limit: params.limit,
		offset: params.offset,
	});
	const rawTransactions = result.transactions;

	return {
		receivedCount: rawTransactions.length,
		transactions: rawTransactions.flatMap((rawTransaction) => {
			const transaction = parseNwcTransaction(rawTransaction);
			return transaction === null ? [] : [transaction];
		}),
	};
};

export const syncNwcTransfersProcess: BackgroundProcess = {
	name: "syncNwcTransfers",
	run: async (props) => {
		const upsertPaymentMatchingClaims =
			createUpsertLnPaymentHashReconciliationClaims({
				evolu: props.evolu,
			});

		const notification = props.addNotification({
			title: "NWC transfers sync",
			type: "info",
			progress: null,
			canBeClosed: true,
			description: "Waiting for next sync...",
			isUnread: false,
			id: notificationId,
			timestamp: Date.now(),
		});

		const findLatestNwcTransactionOccurredAtByAccountId = async (
			accountId: Id,
		) => {
			const rows = await props.evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("transaction")
						.select([
							sql<number | null>`max("transaction"."occurredAt")`.as(
								"latestOccurredAt",
							),
						] as const)
						.where("transaction.isDeleted", "is not", sqliteTrue)
						.where("transaction.accountId", "=", accountId)
						.where("transaction._tag", "=", "accountNwc"),
				),
			);

			return rows[0]?.latestOccurredAt ?? null;
		};

		const nwcAccountsQuery = createQuery((db) =>
			db
				.selectFrom("account")
				.innerJoin("accountNwc", "accountNwc.id", "account.id")
				.select([
					"account.id as id",
					"accountNwc.credentials as credentials",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("accountNwc.isDeleted", "is not", sqliteTrue)
				.where("account._tag", "=", "accountNwc")
				.where("accountNwc.credentials", "is not", null)
				.$narrowType<{
					credentials: KyselyNotNull;
				}>(),
		);

		const activeClientsByAccountId = new Map<Id, NwcClient>();
		const inFlightTransactionIds = new Set<Id>();
		let syncInProgress = false;
		let syncQueued = false;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const scheduleSync = (delayMs: number) => {
			if (stopped) return;
			if (timer !== null) {
				globalThis.clearTimeout(timer);
			}

			timer = globalThis.setTimeout(() => {
				timer = null;
				runSyncLoop();
			}, delayMs);
		};

		const queueImmediateSync = () => {
			if (stopped) return;
			if (syncInProgress) {
				syncQueued = true;
				return;
			}

			scheduleSync(0);
		};

		const cleanupClient = (client: NwcClient) => {
			if (client.notificationUnsubscribe !== null) {
				client.notificationUnsubscribe();
			}
			client.client.close();
		};

		const persistNwcTransaction = async (params: {
			accountId: Id;
			transaction: NwcTransaction;
		}) => {
			const { accountId, transaction } = params;
			if (!shouldPersistNwcTransaction(transaction)) {
				return false;
			}

			const amount = toNwcSyncAmountSats(transaction);
			if (amount === null) {
				return false;
			}

			const id = createNwcTransactionId({
				accountId,
				transaction,
			});
			if (inFlightTransactionIds.has(id)) {
				return false;
			}

			inFlightTransactionIds.add(id);
			try {
				props.evolu.upsert("transaction", {
					id,
					accountId,
					_tag: "accountNwc",
					amount,
					currency: Currency.BTC,
					occurredAt: resolveOccurredAt(transaction),
					note: transaction.description,
					internalTransferGroupId: null,
				});
				props.evolu.upsert("transactionNwc", {
					id,
					nwcEventId: null,
					nwcRequestId: null,
				});
				if (
					transaction.type === "incoming" &&
					transaction.paymentHash !== null &&
					amount > 0
				) {
					await upsertPaymentMatchingClaims({
						transactionId: id,
						accountId,
						paymentHash: transaction.paymentHash,
						amount,
						source: "paymentLnNwc",
						createdBy: "syncNwcTransfersProcess",
					});
				}

				return true;
			} finally {
				inFlightTransactionIds.delete(id);
			}
		};

		const watchClientNotifications = async (params: {
			accountId: Id;
			client: NwcClient;
		}) => {
			const { accountId, client } = params;
			if (client.notificationUnsubscribe !== null) {
				client.notificationUnsubscribe();
			}

			const onNotification = (notification: Nip47Notification) => {
				const transaction = parseNwcTransaction(notification.notification);
				if (transaction === null) {
					return;
				}

				void persistNwcTransaction({
					accountId,
					transaction,
				}).catch((error) => {
					console.error(
						"NWC notification transaction processing failed",
						error,
					);
					queueImmediateSync();
				});
			};

			try {
				client.notificationUnsubscribe =
					await client.client.subscribeNotifications(onNotification, [
						"payment_received",
						"payment_sent",
					]);
			} catch (error) {
				client.notificationUnsubscribe = null;
				console.warn("NWC notifications subscription failed", error);
			}
		};

		const ensureClient = async (params: {
			accountId: Id;
			credentials: NonEmptyString;
		}) => {
			const existing = activeClientsByAccountId.get(params.accountId);
			if (existing && existing.credentials === params.credentials) {
				return existing;
			}

			if (existing) {
				cleanupClient(existing);
				activeClientsByAccountId.delete(params.accountId);
			}

			let nwcClient: NWCClient;
			try {
				nwcClient = new NWCClient({
					nostrWalletConnectUrl: params.credentials,
				});
			} catch {
				return null;
			}

			const client: NwcClient = {
				credentials: params.credentials,
				client: nwcClient,
				notificationUnsubscribe: null,
			};
			await watchClientNotifications({
				accountId: params.accountId,
				client,
			});

			activeClientsByAccountId.set(params.accountId, client);
			return client;
		};

		const syncOnce = async () => {
			if (syncInProgress) return;
			syncInProgress = true;

			try {
				notification.update({
					title: "NWC transfers sync",
					type: "info",
					progress: null,
					canBeClosed: true,
					description: "Syncing transfers from NWC...",
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});

				const accounts = await props.evolu.loadQuery(nwcAccountsQuery);

				const activeAccountIds = new Set<Id>();
				let syncedTransfers = 0;
				let failedAccounts = 0;

				for (const account of accounts) {
					activeAccountIds.add(account.id);
					try {
						const client = await ensureClient({
							accountId: account.id,
							credentials: account.credentials,
						});
						if (client === null) {
							failedAccounts += 1;
							continue;
						}

						const latestOccurredAt =
							await findLatestNwcTransactionOccurredAtByAccountId(account.id);
						const fromSec =
							latestOccurredAt === null
								? undefined
								: Math.max(
										0,
										Math.floor(latestOccurredAt - transferHistoryOverlapMs) /
											1000,
									);

						let offset = 0;
						while (true) {
							const listResult = await requestNwcListTransactions({
								client,
								fromSec,
								limit: listTransactionsPageSize,
								offset,
							});
							if (listResult === null || listResult.receivedCount === 0) {
								break;
							}

							for (const transaction of listResult.transactions) {
								if (
									await persistNwcTransaction({
										accountId: account.id,
										transaction,
									})
								) {
									syncedTransfers += 1;
								}
							}

							offset += listResult.receivedCount;
							if (listResult.receivedCount < listTransactionsPageSize) {
								break;
							}
						}
					} catch (error) {
						failedAccounts += 1;
						console.error(
							`NWC transfer sync failed for account ${account.id}`,
							error,
						);
					}
				}

				for (const [accountId, client] of activeClientsByAccountId) {
					if (activeAccountIds.has(accountId)) {
						continue;
					}

					cleanupClient(client);
					activeClientsByAccountId.delete(accountId);
				}

				if (accounts.length === 0) {
					notification.update({
						title: "NWC transfers sync",
						type: "info",
						progress: null,
						canBeClosed: true,
						description: "No NWC accounts configured.",
						isUnread: false,
						id: notificationId,
						timestamp: Date.now(),
					});
					return;
				}

				notification.update({
					title: "NWC transfers sync",
					type: failedAccounts > 0 ? "warning" : "success",
					progress: null,
					canBeClosed: true,
					description:
						failedAccounts > 0
							? `Synced ${syncedTransfers} transfer(s), ${failedAccounts} account(s) failed. Next check in ${Math.round(syncIntervalMs / 1000)}s or on new event.`
							: `Synced ${syncedTransfers} transfer(s). Next check in ${Math.round(syncIntervalMs / 1000)}s or on new event.`,
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} catch (error) {
				notification.update({
					title: "NWC transfers sync",
					type: "error",
					progress: null,
					canBeClosed: true,
					description:
						error instanceof Error
							? `Sync failed: ${error.message}`
							: "Sync failed due to unknown error.",
					isUnread: false,
					id: notificationId,
					timestamp: Date.now(),
				});
			} finally {
				syncInProgress = false;
			}
		};

		const runSyncLoop = () => {
			if (stopped) return;
			if (syncInProgress) {
				syncQueued = true;
				return;
			}

			void syncOnce().finally(() => {
				if (stopped) {
					return;
				}
				if (syncQueued) {
					syncQueued = false;
					scheduleSync(0);
					return;
				}

				scheduleSync(syncIntervalMs);
			});
		};

		const unsubscribeNwcAccounts = subscribeToEvoluQuery(
			props.evolu,
			nwcAccountsQuery,
			() => {
				queueImmediateSync();
			},
		);

		return () => {
			stopped = true;
			unsubscribeNwcAccounts();
			if (timer !== null) {
				globalThis.clearTimeout(timer);
			}

			for (const client of activeClientsByAccountId.values()) {
				cleanupClient(client);
			}
			activeClientsByAccountId.clear();
		};
	},
};
