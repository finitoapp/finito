import { SparkWallet } from "@buildonspark/spark-sdk";
import {
	createIdFromString,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { sql } from "kysely";
import type { BackgroundProcess } from "@/lib/background/service";
import { createQuery } from "@/lib/evolu";
import {
	Currency,
	Integer,
	NonEmptyString,
	TimestampMs,
} from "@/lib/shared/types";

const splitAmountByExpectedAllocation = (params: {
	amount: Integer;
	expectedProductAmount: Integer;
	expectedTipAmount: Integer;
}) => {
	let remainingAmount = Math.max(0, params.amount);

	const productAmount = Math.min(
		Math.max(0, params.expectedProductAmount),
		remainingAmount,
	) as Integer;
	remainingAmount -= productAmount;

	const tipAmount = Math.min(
		Math.max(0, params.expectedTipAmount),
		remainingAmount,
	) as Integer;
	remainingAmount -= tipAmount;

	return {
		productAmount,
		tipAmount,
		overpaymentAmount: remainingAmount as Integer,
	};
};

const hasClaimedLightningTransferData = (
	userRequest: unknown,
): userRequest is {
	invoice: {
		encodedInvoice: string;
		paymentHash: string;
	};
	paymentPreimage: string;
} => {
	if (
		typeof userRequest !== "object" ||
		userRequest === null ||
		!("invoice" in userRequest) ||
		!("paymentPreimage" in userRequest)
	) {
		return false;
	}

	const { invoice, paymentPreimage } = userRequest;
	if (typeof paymentPreimage !== "string") {
		return false;
	}

	if (typeof invoice !== "object" || invoice === null) {
		return false;
	}

	return (
		"encodedInvoice" in invoice &&
		typeof invoice.encodedInvoice === "string" &&
		"paymentHash" in invoice &&
		typeof invoice.paymentHash === "string"
	);
};

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

		const findPaymentIdsByPaymentHash = async (paymentHash: NonEmptyString) => {
			const paymentRows = await props.evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("payment")
						.innerJoin("paymentLnSpark", "paymentLnSpark.id", "payment.id")
						.select(["payment.id as id"] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("paymentLnSpark.isDeleted", "is not", sqliteTrue)
						.where("paymentLnSpark.paymentHash", "=", paymentHash),
				),
			);

			return paymentRows.map((row) => row.id);
		};

		const findExpectedAllocationByPaymentId = async (paymentId: Id) => {
			const paymentRows = await props.evolu.loadQuery(
				createQuery((db) =>
					db
						.selectFrom("payment")
						.leftJoin("paymentItemLine", (join) =>
							join
								.onRef("paymentItemLine.paymentId", "=", "payment.id")
								.on("paymentItemLine.isDeleted", "is not", sqliteTrue),
						)
						.select([
							"payment.tipAmount as tipAmount",
							sql<Integer>`
								coalesce(
									sum("paymentItemLine"."totalAmount"),
									0
								)
							`.as("expectedProductAmount"),
						] as const)
						.where("payment.isDeleted", "is not", sqliteTrue)
						.where("payment.id", "=", paymentId)
						.groupBy("payment.id")
						.groupBy("payment.tipAmount")
						.limit(1),
				),
			);

			const payment = paymentRows[0];
			if (payment === undefined) {
				return null;
			}

			return {
				expectedProductAmount: payment.expectedProductAmount ?? Integer(0),
				expectedTipAmount: payment.tipAmount ?? Integer(0),
			};
		};

		const upsertPaymentMatchingClaims = async (payload: {
			transactionId: Id;
			paymentHash: NonEmptyString;
			amount: Integer;
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
				props.evolu.upsert("reconciliationClaim", {
					id: claimId,
					sourceType: "transaction",
					sourceId: payload.transactionId,
					entityType: "payment",
					entityId: paymentId,
					confidence: 1,
					rule: "lnPaymentHash",
					createdBy: "syncSparkTransfersProcess",
				});
				props.evolu.upsert("reconciliationClaimAllocation", {
					id: createIdFromString(
						`reconciliationClaimAllocation:${claimId}:product`,
					),
					claimId,
					componentType: "product",
					amount: splitAllocation.productAmount,
				});
				props.evolu.upsert("reconciliationClaimAllocation", {
					id: createIdFromString(
						`reconciliationClaimAllocation:${claimId}:tip`,
					),
					claimId,
					componentType: "tip",
					amount: splitAllocation.tipAmount,
				});
				props.evolu.upsert("reconciliationClaimAllocation", {
					id: createIdFromString(
						`reconciliationClaimAllocation:${claimId}:overpayment`,
					),
					claimId,
					componentType: "overpayment",
					amount: splitAllocation.overpaymentAmount,
				});
			}
		};

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
				if (!hasClaimedLightningTransferData(userRequest)) {
					return;
				}

				const id = createIdFromString(`sparkTransfer:${walletTransfer.id}`);
				const amount = Integer(walletTransfer.totalValue);
				const paymentHash = NonEmptyString(
					userRequest.invoice.paymentHash.toLowerCase(),
				);
				props.evolu.upsert("transaction", {
					id,
					accountId: account.id,
					_tag: "accountSpark",
					amount,
					currency: Currency.BTC,
					occurredAt: TimestampMs(
						walletTransfer.updatedTime?.getTime() ?? Date.now(),
					),
				});
				props.evolu.upsert("transactionSpark", {
					id,
					sparkTransferId: NonEmptyString(walletTransfer.id),
					preImage: NonEmptyString(userRequest.paymentPreimage),
					lnInvoice: NonEmptyString(userRequest.invoice.encodedInvoice),
					paymentHash,
				});
				await upsertPaymentMatchingClaims({
					transactionId: id,
					paymentHash,
					amount,
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
