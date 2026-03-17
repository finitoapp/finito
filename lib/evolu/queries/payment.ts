import {
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import type { Integer } from "@/lib/shared/types";

export const getLatestPayments = createQuery((db) =>
	db
		.selectFrom("payment")
		.select(
			(eb) =>
				[
					"id",
					"createdAt",
					"totalAmount",
					"currency",
					"tipAmount",
					"direction",

					evoluJsonObjectFrom(
						eb
							.selectFrom("paymentCounterparty")
							.select([
								"paymentCounterparty.label as label",
								"paymentCounterparty.name as name",
							])
							.whereRef("paymentCounterparty.id", "=", "payment.id")
							.where("paymentCounterparty.isDeleted", "is not", sqliteTrue),
					).as("counterparty"),

					evoluJsonObjectFrom(
						eb
							.selectFrom("reconciliationClaim")
							.innerJoin(
								"reconciliationClaimAllocation",
								"reconciliationClaimAllocation.claimId",
								"reconciliationClaim.id",
							)
							.select(
								(eb) =>
									[
										eb.fn
											.sum<Integer | null>(
												"reconciliationClaimAllocation.amount",
											)
											.as("amount"),
									] as const,
							)
							.whereRef("reconciliationClaim.entityId", "=", "payment.id")
							.where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
							.where(
								"reconciliationClaimAllocation.isDeleted",
								"is not",
								sqliteTrue,
							)
							.where("reconciliationClaim.entityType", "=", "payment"),
					).as("reconciliationClaim"),
				] as const,
		)
		.where("payment.isDeleted", "is not", sqliteTrue)
		.where("payment.currency", "is not", null)
		.where("payment.totalAmount", "is not", null)
		.where("payment.direction", "is not", null)
		.orderBy("payment.createdAt", "desc")
		.limit(20)
		.$narrowType<{
			currency: KyselyNotNull;
			totalAmount: KyselyNotNull;
			direction: KyselyNotNull;
			reconciliationClaim: KyselyNotNull;
		}>(),
);
