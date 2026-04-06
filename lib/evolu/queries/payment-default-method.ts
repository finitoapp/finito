import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { createQuery } from "@/lib/evolu";

export const createPaymentDefaultMethodsQuery = (params?: {
	onlyActive?: boolean;
}) =>
	createQuery((db) => {
		let query = db
			.selectFrom("paymentDefaultMethod")
			.leftJoin("account", (join) =>
				join
					.onRef("account.id", "=", "paymentDefaultMethod.accountId")
					.on("account.isDeleted", "is not", sqliteTrue),
			)
			.leftJoin("accountIban", (join) =>
				join
					.onRef("accountIban.id", "=", "account.id")
					.on("accountIban.isDeleted", "is not", sqliteTrue),
			)
			.leftJoin("accountLud16", (join) =>
				join
					.onRef("accountLud16.id", "=", "account.id")
					.on("accountLud16.isDeleted", "is not", sqliteTrue),
			)
			.select([
				"paymentDefaultMethod.id as id",
				"paymentDefaultMethod.type as type",
				"paymentDefaultMethod.accountId as accountId",
				"paymentDefaultMethod.pausedAt as pausedAt",
				"account.name as accountName",
				"account._tag as accountTag",
				"accountIban.iban as accountIban",
				"accountLud16.lud16 as accountLud16",
			] as const)
			.where("paymentDefaultMethod.isDeleted", "is not", sqliteTrue)
			.where("paymentDefaultMethod.type", "is not", null)
			.where("paymentDefaultMethod.accountId", "is not", null)
			.orderBy("paymentDefaultMethod.createdAt", "asc")
			.orderBy("paymentDefaultMethod.id", "asc");

		if (params?.onlyActive) {
			query = query.where("paymentDefaultMethod.pausedAt", "is", null);
		}

		return query.$narrowType<{
			type: KyselyNotNull;
			accountId: KyselyNotNull;
		}>();
	});
