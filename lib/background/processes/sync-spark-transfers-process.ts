import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import type { BackgroundProcess } from "@/lib/background/service";
import { createQuery } from "@/lib/evolu";
import {
	Currency,
	Integer,
	NonEmptyString,
	TimestampMs,
} from "@/lib/shared/types";

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

		const accounts = await props.evolu.loadQuery(
			createQuery((db) =>
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
			),
		);

		console.log("wallet listening", accounts);
		const unsubscribe: (() => void)[] = [];
		for (const account of accounts) {
			const { wallet } = await SparkWallet.initialize({
				mnemonicOrSeed: account.mnemonic,
				options: {
					network: "MAINNET",
				},
			});

			console.log("wallet listening");
			wallet.on("transfer:claimed", async (transferId: string) => {
				console.log("transfer:claimed", transferId);
				const walletTransfer = await wallet.getTransfer(transferId);
				console.log("walletTransfer", walletTransfer);
				if (walletTransfer === undefined) {
					return;
				}

				const userRequest = walletTransfer.userRequest;
				if (userRequest === undefined) {
					return;
				}

				if (!("invoice" in userRequest) || !userRequest.invoice) {
					return;
				}

				if (
					!("paymentPreimage" in userRequest) ||
					!userRequest.paymentPreimage
				) {
					return;
				}

				const id = createIdFromString(`sparkTransfer:${walletTransfer.id}`);
				props.evolu.upsert("transaction", {
					id,
					accountId: account.id,
					_tag: "accountSpark",
					amount: Integer(walletTransfer.totalValue),
					currency: Currency.BTC,
					occurredAt: TimestampMs(
						walletTransfer.updatedTime?.getTime() ?? Date.now(),
					),
				});
				props.evolu.upsert("transactionSpark", {
					id,
					sparkTransferId: NonEmptyString(walletTransfer.id),
					preImage: NonEmptyString(
						userRequest.paymentPreimage as unknown as string,
					),
					lnInvoice: NonEmptyString(
						(userRequest.invoice as any).encodedInvoice as unknown as string,
					),
					paymentHash: NonEmptyString(
						(userRequest.invoice as any).paymentHash as unknown as string,
					),
				});
			});

			unsubscribe.push(() => {
				wallet.off("transfer:claimed");
				wallet.cleanupConnections();
			});
		}

		return () => {
			for (const unsubscribeFn of unsubscribe) {
				unsubscribeFn();
			}
		};
	},
};
