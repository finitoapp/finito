import { createIdFromString, type Id, sqliteTrue } from "@evolu/common";
import { sql } from "kysely";
import { createQuery } from "@/lib/evolu";
import type { EvoluDep } from "@/lib/shared/dependencies";
import { Integer, type NonEmptyString } from "@/lib/shared/types";

type LnPaymentHashSource = "paymentLnSpark" | "paymentLnZap" | "paymentLnNwc";
type LnPaymentHashClaimCreatedBy =
	| "syncLnZapTransfersProcess"
	| "syncSparkTransfersProcess"
	| "syncNwcTransfersProcess"
	| "adminPaymentsDetail";

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

const findPaymentIdsByPaymentHash =
	(deps: EvoluDep) =>
	async (params: {
		paymentHash: NonEmptyString;
		source: LnPaymentHashSource;
	}) => {
		const { paymentHash, source } = params;

		const paymentRows =
			source === "paymentLnSpark"
				? await deps.evolu.loadQuery(
						createQuery((db) =>
							db
								.selectFrom("payment")
								.innerJoin("paymentLnSpark", "paymentLnSpark.id", "payment.id")
								.select(["payment.id as id"] as const)
								.where("payment.isDeleted", "is not", sqliteTrue)
								.where("paymentLnSpark.isDeleted", "is not", sqliteTrue)
								.where("paymentLnSpark.paymentHash", "=", paymentHash),
						),
					)
				: source === "paymentLnZap"
					? await deps.evolu.loadQuery(
							createQuery((db) =>
								db
									.selectFrom("payment")
									.innerJoin("paymentLnZap", "paymentLnZap.id", "payment.id")
									.select(["payment.id as id"] as const)
									.where("payment.isDeleted", "is not", sqliteTrue)
									.where("paymentLnZap.isDeleted", "is not", sqliteTrue)
									.where("paymentLnZap.paymentHash", "=", paymentHash),
							),
						)
					: await deps.evolu.loadQuery(
							createQuery((db) =>
								db
									.selectFrom("payment")
									.innerJoin("paymentLnNwc", "paymentLnNwc.id", "payment.id")
									.select(["payment.id as id"] as const)
									.where("payment.isDeleted", "is not", sqliteTrue)
									.where("paymentLnNwc.isDeleted", "is not", sqliteTrue)
									.where("paymentLnNwc.paymentHash", "=", paymentHash),
							),
						);

		return paymentRows.map((row) => row.id);
	};

const findExpectedAllocationByPaymentId =
	(deps: EvoluDep) => async (params: { paymentId: Id }) => {
		const paymentRows = await deps.evolu.loadQuery(
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
					.where("payment.id", "=", params.paymentId)
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

export const createUpsertLnPaymentHashReconciliationClaims =
	(deps: EvoluDep) =>
	async (params: {
		transactionId: Id;
		accountId: Id;
		paymentHash: NonEmptyString;
		amount: Integer;
		source: LnPaymentHashSource;
		createdBy: LnPaymentHashClaimCreatedBy;
	}) => {
		const paymentIds = await findPaymentIdsByPaymentHash(deps)({
			paymentHash: params.paymentHash,
			source: params.source,
		});

		for (const paymentId of paymentIds) {
			const expectedAllocation = await findExpectedAllocationByPaymentId(deps)({
				paymentId,
			});
			if (expectedAllocation === null) {
				continue;
			}

			const splitAllocation = splitAmountByExpectedAllocation({
				amount: params.amount,
				expectedProductAmount: expectedAllocation.expectedProductAmount,
				expectedTipAmount: expectedAllocation.expectedTipAmount,
			});

			const claimId = createIdFromString(
				`reconciliationClaim:lnPaymentHash:${params.transactionId}:${params.accountId}:${paymentId}`,
			);
			deps.evolu.upsert("reconciliationClaim", {
				id: claimId,
				sourceType: "transaction",
				sourceId: params.transactionId,
				entityType: "payment",
				entityId: paymentId,
				confidence: 1,
				rule: "lnPaymentHash",
				createdBy: params.createdBy,
			});
			deps.evolu.upsert("reconciliationClaimAllocation", {
				id: createIdFromString(
					`reconciliationClaimAllocation:${claimId}:product`,
				),
				claimId,
				componentType: "product",
				amount: splitAllocation.productAmount,
			});
			deps.evolu.upsert("reconciliationClaimAllocation", {
				id: createIdFromString(`reconciliationClaimAllocation:${claimId}:tip`),
				claimId,
				componentType: "tip",
				amount: splitAllocation.tipAmount,
			});
			deps.evolu.upsert("reconciliationClaimAllocation", {
				id: createIdFromString(
					`reconciliationClaimAllocation:${claimId}:overpayment`,
				),
				claimId,
				componentType: "overpayment",
				amount: splitAllocation.overpaymentAmount,
			});
		}
	};
