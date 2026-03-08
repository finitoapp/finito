import { kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export const createGetTransactionQuery = (params: { id: Id }) =>
	createQuery((db) =>
		db
			.selectFrom("transaction")
			.select(
				(eb) =>
					[
						"transaction.id as id",
						"transaction.createdAt as createdAt",
						"transaction.accountId as accountId",
						"transaction.occurredAt as occurredAt",
						"transaction.amount as amount",
						"transaction.currency as currency",
						"transaction.note as note",
						"transaction.internalTransferGroupId as internalTransferGroupId",
						"transaction._tag as _tag",

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("account")
									.select(["account.name as name"] as const)
									.whereRef("transaction.accountId", "=", "account.id")
									.where("account.isDeleted", "is not", sqliteTrue)
									.where("account.name", "is not", null)
									.$narrowType<{
										name: NotNull;
									}>(),
							)
							.as("account"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("transactionIban")
									.select([
										"transactionIban.variableSymbol as variableSymbol",
										"transactionIban.constantSymbol as constantSymbol",
										"transactionIban.specificSymbol as specificSymbol",
										"transactionIban.bankReference as bankReference",
									] as const)
									.whereRef("transactionIban.id", "=", "transaction.id")
									.where("transactionIban.isDeleted", "is not", sqliteTrue),
							)
							.as("transactionIban"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("transactionLud16")
									.select([
										"transactionLud16.lnInvoice as lnInvoice",
										"transactionLud16.paymentHash as paymentHash",
									] as const)
									.whereRef("transactionLud16.id", "=", "transaction.id")
									.where("transactionLud16.isDeleted", "is not", sqliteTrue)
									.where("transactionLud16.paymentHash", "is not", null)
									.$narrowType<{
										paymentHash: NotNull;
									}>(),
							)
							.as("transactionLud16"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("transactionSpark")
									.select([
										"transactionSpark.sparkTransferId as sparkTransferId",
										"transactionSpark.lnInvoice as lnInvoice",
										"transactionSpark.preImage as preImage",
										"transactionSpark.paymentHash as paymentHash",
									] as const)
									.whereRef("transactionSpark.id", "=", "transaction.id")
									.where("transactionSpark.isDeleted", "is not", sqliteTrue)
									.where("transactionSpark.sparkTransferId", "is not", null)
									.where("transactionSpark.lnInvoice", "is not", null)
									.where("transactionSpark.preImage", "is not", null)
									.where("transactionSpark.paymentHash", "is not", null)
									.$narrowType<{
										sparkTransferId: NotNull;
										lnInvoice: NotNull;
										preImage: NotNull;
										paymentHash: NotNull;
									}>(),
							)
							.as("transactionSpark"),

						kysely
							.jsonObjectFrom(
								eb
									.selectFrom("transactionNwc")
									.select([
										"transactionNwc.nwcEventId as nwcEventId",
										"transactionNwc.nwcRequestId as nwcRequestId",
									] as const)
									.whereRef("transactionNwc.id", "=", "transaction.id")
									.where("transactionNwc.isDeleted", "is not", sqliteTrue)
									.where("transactionNwc.nwcEventId", "is not", null)
									.where("transactionNwc.nwcRequestId", "is not", null)
									.$narrowType<{
										nwcEventId: NotNull;
										nwcRequestId: NotNull;
									}>(),
							)
							.as("transactionNwc"),
					] as const,
			)
			.where("transaction.isDeleted", "is not", sqliteTrue)
			.where("transaction.amount", "is not", null)
			.where("transaction.currency", "is not", null)
			.where("transaction.occurredAt", "is not", null)
			.where("transaction.accountId", "is not", null)
			.where("transaction.id", "=", params.id)
			.$narrowType<{
				amount: NotNull;
				currency: NotNull;
				occurredAt: NotNull;
				accountId: NotNull;
				account: NotNull;
			}>(),
	);
