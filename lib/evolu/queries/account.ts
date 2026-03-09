import {
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export const createGetAccountQuery = (params: { id: Id }) =>
	createQuery((db) =>
		db
			.selectFrom("account")
			.select(
				(eb) =>
					[
						"account.id as id",
						"account.name as name",
						"account._tag as _tag",
						evoluJsonObjectFrom(
							eb
								.selectFrom("accountIban")
								.select([
									"accountIban.iban as iban",
									"accountIban.currency as currency",
								])
								.whereRef("accountIban.id", "=", "account.id")
								.where("accountIban.isDeleted", "is not", sqliteTrue)
								.where("accountIban.iban", "is not", null)
								.where("accountIban.currency", "is not", null)
								.$narrowType<{
									iban: KyselyNotNull;
									currency: KyselyNotNull;
								}>(),
						).as("accountIban"),
						evoluJsonObjectFrom(
							eb
								.selectFrom("accountLud16")
								.select(["accountLud16.lud16 as lud16"])
								.whereRef("accountLud16.id", "=", "account.id")
								.where("accountLud16.isDeleted", "is not", sqliteTrue)
								.where("accountLud16.lud16", "is not", null)
								.$narrowType<{
									lud16: KyselyNotNull;
								}>(),
						).as("accountLud16"),
						evoluJsonObjectFrom(
							eb
								.selectFrom("accountSpark")
								.select(["accountSpark.mnemonic as mnemonic"])
								.whereRef("accountSpark.id", "=", "account.id")
								.where("accountSpark.isDeleted", "is not", sqliteTrue)
								.where("accountSpark.mnemonic", "is not", null)
								.$narrowType<{
									mnemonic: KyselyNotNull;
								}>(),
						).as("accountSpark"),
						evoluJsonObjectFrom(
							eb
								.selectFrom("accountNwc")
								.select(["accountNwc.credentials as credentials"])
								.whereRef("accountNwc.id", "=", "account.id")
								.where("accountNwc.isDeleted", "is not", sqliteTrue)
								.where("accountNwc.credentials", "is not", null)
								.$narrowType<{
									credentials: KyselyNotNull;
								}>(),
						).as("accountNwc"),
						evoluJsonObjectFrom(
							eb
								.selectFrom("accountCashRegister")
								.select(["accountCashRegister.currency as currency"])
								.whereRef("accountCashRegister.id", "=", "account.id")
								.where("accountCashRegister.isDeleted", "is not", sqliteTrue)
								.where("accountCashRegister.currency", "is not", null)
								.$narrowType<{
									currency: KyselyNotNull;
								}>(),
						).as("accountCashRegister"),
					] as const,
			)
			.where("account.isDeleted", "is not", sqliteTrue)
			.where("account.id", "=", params.id)
			.where("account.name", "is not", null)
			.where("account._tag", "is not", null)
			.$narrowType<{
				name: KyselyNotNull;
				_tag: KyselyNotNull;
			}>(),
	);
