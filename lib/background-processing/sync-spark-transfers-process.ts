import { SparkWallet } from "@buildonspark/spark-sdk";
import { createIdFromString, getOrThrow, sqliteTrue } from "@evolu/common";
import type { BackgroundProcess } from "@/lib/background-processing/background-process";

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
			props.evolu.createQuery((db) =>
				db
					.selectFrom("account")
					.innerJoin("accountSpark", "accountSpark.id", "account.id")
					.select([
						"account.id as id",
						"account._tag as _tag",
						"accountSpark.mnemonic as mnemonic",
					] as const)
					.where("account.isDeleted", "is not", sqliteTrue),
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
				getOrThrow(
					props.evolu.upsert("transaction", {
						id,
						accountId: account.id,
						_tag: "transactionSpark",
						amount: walletTransfer.totalValue,
						occurredAt: walletTransfer.updatedTime?.getTime() ?? Date.now(),
					}),
				);
				getOrThrow(
					props.evolu.upsert("transactionSpark", {
						id,
						sparkTransferId: walletTransfer.id,
						preImage: userRequest.paymentPreimage,
						lnInvoice: userRequest.invoice.encodedInvoice,
						paymentHash: userRequest.invoice.paymentHash,
					}),
				);
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
