import { SparkWallet, SparkWalletEvent } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { sql } from "kysely";
import { z } from "zod";
import type { BackgroundProcess } from "@/lib/background/service";
import { createQuery, type EvoluSchemaType } from "@/lib/evolu";
import { subscribeToEvoluQuery } from "@/lib/evolu/utils";
import { createUpsertLnPaymentHashReconciliationClaims } from "@/lib/reconciliation/service";
import {
	Currency,
	Integer,
	NonEmptyString,
	TimestampMs,
} from "@/lib/shared/types";

type WalletTransfer = Awaited<
	ReturnType<SparkWallet["getTransfers"]>
>["transfers"][number];
type SparkAccount = EvoluSchemaType["accountSpark"];

const claimedLightningTransferDataSchema = z.object({
	invoice: z.object({
		encodedInvoice: z.string(),
		paymentHash: z.string(),
	}),
	paymentPreimage: z.string(),
});

const transferHistoryOverlapMs = 60 * 60 * 1000;

export const syncSparkTransfersProcess: BackgroundProcess = {
	name: "verifyPayment",
	run: async (props) => {
		props.addNotification({
			title: props.t("components:notificationItem.verifyPayment.title"),
			type: "info",
			progress: null,
			canBeClosed: false,
			description: props.t(
				"components:notificationItem.verifyPayment.description",
			),
			id: createIdFromString("syncSparkTransfers"),
			timestamp: Date.now(),
			actions: [
				{
					buttonProps: {
						children: props.t(
							"components:notificationItem.verifyPayment.actions.stopWaiting",
						),
					},
					callback: () => {},
				},
			],
		});

		const upsertPaymentMatchingClaims =
			createUpsertLnPaymentHashReconciliationClaims({
				evolu: props.evolu,
			});

		const hasRecordedSparkTransfer = async (params: {
			accountId: Id;
			transactionId: Id;
		}) => {
			const { accountId, transactionId } = params;
			const rows = await props.evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("transaction")
						.select(["transaction.id as id"] as const)
						.where("transaction.isDeleted", "is not", sqliteTrue)
						.where("transaction.accountId", "=", accountId)
						.where("transaction._tag", "=", "accountSpark")
						.where("transaction.id", "=", transactionId)
						.limit(1),
				),
			);

			return rows[0] !== undefined;
		};

		const findLatestSparkTransactionOccurredAtByAccountId = async (
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
						.where("transaction._tag", "=", "accountSpark"),
				),
			);

			return rows[0]?.latestOccurredAt ?? null;
		};

		const inFlightTransferIds = new Set<string>();

		const upsertCompletedSparkTransfer = async (params: {
			accountId: Id;
			walletTransfer: WalletTransfer;
		}) => {
			const { accountId, walletTransfer } = params;
			if (walletTransfer.status !== "TRANSFER_STATUS_COMPLETED") {
				return;
			}

			const sparkTransferId = NonEmptyString(walletTransfer.id);
			if (inFlightTransferIds.has(sparkTransferId)) {
				return;
			}

			inFlightTransferIds.add(sparkTransferId);
			try {
				const id = createIdFromString(
					`sparkTransfer:${accountId}:${sparkTransferId}`,
				);
				if (await hasRecordedSparkTransfer({ accountId, transactionId: id })) {
					return;
				}

				const amountValue = Math.abs(walletTransfer.totalValue);
				const amount = Integer(
					walletTransfer.transferDirection === "OUTGOING"
						? -amountValue
						: amountValue,
				);

				props.evolu.upsert("transaction", {
					id,
					accountId,
					_tag: "accountSpark",
					amount,
					currency: Currency.BTC,
					occurredAt: TimestampMs(
						walletTransfer.updatedTime?.getTime() ?? Date.now(),
					),
				});

				const parsedUserRequest = claimedLightningTransferDataSchema.safeParse(
					walletTransfer.userRequest,
				);
				if (parsedUserRequest.success) {
					const userRequest = parsedUserRequest.data;
					const paymentHash = NonEmptyString(
						userRequest.invoice.paymentHash.toLowerCase(),
					);

					props.evolu.upsert("transactionSpark", {
						id,
						sparkTransferId,
						preImage: NonEmptyString(userRequest.paymentPreimage),
						lnInvoice: NonEmptyString(userRequest.invoice.encodedInvoice),
						paymentHash,
					});

					if (walletTransfer.transferDirection === "INCOMING") {
						await upsertPaymentMatchingClaims({
							transactionId: id,
							accountId,
							paymentHash,
							amount,
							source: "paymentLnSpark",
							createdBy: "syncSparkTransfersProcess",
						});
					}
				}
			} finally {
				inFlightTransferIds.delete(sparkTransferId);
			}
		};

		const sparkAccountsQuery = createQuery((db) =>
			db
				.selectFrom("account")
				.innerJoin("accountSpark", "accountSpark.id", "account.id")
				.select([
					"account.id as id",
					"account._tag as _tag",
					"accountSpark.mnemonic as mnemonic",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("accountSpark.mnemonic", "is not", null)
				.$narrowType<{
					mnemonic: KyselyNotNull;
				}>(),
		);

		const transferHistoryPageSize = 100;
		type SparkAccountWatcher = {
			mnemonic: EvoluSchemaType["accountSpark"]["mnemonic"];
			stop: () => void;
		};
		const accountWatchers = new Map<Id, SparkAccountWatcher>();
		let syncAccountsInProgress = false;
		let queuedAccounts: ReadonlyArray<SparkAccount> | null = null;

		const startAccountWatcher = async (account: SparkAccount) => {
			let wallet: SparkWallet | null = null;
			let syncHistoryInProgress = false;
			let syncHistoryQueued = false;
			let isStopped = false;

			const syncClaimedTransferHistory = async () => {
				if (isStopped || wallet === null) {
					syncHistoryQueued = true;
					return;
				}

				if (syncHistoryInProgress) {
					syncHistoryQueued = true;
					return;
				}

				syncHistoryInProgress = true;
				try {
					do {
						if (isStopped || wallet === null) {
							return;
						}
						syncHistoryQueued = false;

						const latestOccurredAt =
							await findLatestSparkTransactionOccurredAtByAccountId(account.id);
						const createdAfter =
							latestOccurredAt === null
								? undefined
								: new Date(
										Math.max(0, latestOccurredAt - transferHistoryOverlapMs),
									);

						let offset = 0;
						while (true) {
							const { transfers } = await wallet.getTransfers(
								transferHistoryPageSize,
								offset,
								createdAfter,
							);
							if (transfers.length === 0) {
								break;
							}

							for (const walletTransfer of transfers) {
								await upsertCompletedSparkTransfer({
									accountId: account.id,
									walletTransfer,
								});
							}

							offset += transfers.length;
							if (transfers.length < transferHistoryPageSize) {
								break;
							}
						}
					} while (syncHistoryQueued);
				} catch (error) {
					console.error("Spark transfer history sync failed", error);
				} finally {
					syncHistoryInProgress = false;
				}
			};

			const onTransferClaimed = (transferId: string) => {
				if (isStopped || wallet === null) {
					syncHistoryQueued = true;
					return;
				}

				void (async () => {
					try {
						const walletTransfer = await wallet.getTransfer(transferId);
						if (walletTransfer === undefined) {
							return;
						}

						await upsertCompletedSparkTransfer({
							accountId: account.id,
							walletTransfer,
						});
					} catch (error) {
						console.error("Spark transfer claim handling failed", error);
					}
				})();
			};

			const onStreamConnected = () => {
				if (isStopped) {
					return;
				}
				void syncClaimedTransferHistory();
			};

			try {
				const initializedWallet = await SparkWallet.initialize({
					mnemonicOrSeed: account.mnemonic,
					options: {
						network: "MAINNET",
						events: {
							[SparkWalletEvent.TransferClaimed]: onTransferClaimed,
							[SparkWalletEvent.StreamConnected]: onStreamConnected,
						},
					},
				});
				wallet = initializedWallet.wallet;

				if (syncHistoryQueued) {
					void syncClaimedTransferHistory();
				}
			} catch (error) {
				console.error("Spark wallet initialization failed", error);
			}

			const stop = () => {
				isStopped = true;
				if (wallet === null) {
					return;
				}

				wallet.off(SparkWalletEvent.TransferClaimed, onTransferClaimed);
				wallet.off(SparkWalletEvent.StreamConnected, onStreamConnected);
				void wallet.cleanupConnections();
				wallet = null;
			};

			return { mnemonic: account.mnemonic, stop } satisfies SparkAccountWatcher;
		};

		const syncAccountWatchers = async (
			nextAccounts: ReadonlyArray<SparkAccount>,
		) => {
			if (syncAccountsInProgress) {
				queuedAccounts = nextAccounts;
				return;
			}
			syncAccountsInProgress = true;

			try {
				const nextAccountsById = new Map<Id, SparkAccount>(
					nextAccounts.map((account) => [account.id, account]),
				);

				for (const [accountId, watcher] of accountWatchers) {
					const nextAccount = nextAccountsById.get(accountId);
					if (
						nextAccount === undefined ||
						nextAccount.mnemonic !== watcher.mnemonic
					) {
						watcher.stop();
						accountWatchers.delete(accountId);
					}
				}

				for (const account of nextAccounts) {
					if (accountWatchers.has(account.id)) {
						continue;
					}

					const watcher = await startAccountWatcher(account);
					accountWatchers.set(account.id, watcher);
				}
			} finally {
				syncAccountsInProgress = false;
				const queued = queuedAccounts;
				queuedAccounts = null;
				if (queued !== null) {
					void syncAccountWatchers(queued);
				}
			}
		};

		const unsubscribeAccounts = subscribeToEvoluQuery(
			props.evolu,
			sparkAccountsQuery,
			(accounts) => {
				void syncAccountWatchers(accounts);
			},
		);

		return () => {
			unsubscribeAccounts();
			for (const watcher of accountWatchers.values()) {
				watcher.stop();
			}
			accountWatchers.clear();
		};
	},
};
