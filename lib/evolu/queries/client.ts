import { kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export const createGetClientsQuery = (params: { id?: Id } = {}) =>
	createQuery((db) => {
		let qb = db
			.selectFrom("client")
			.select((eb) => [
				"client.id as id",
				"client.name as name",
				"client.label as label",
				"client.email as email",
				"client.countryCode as countryCode",

				kysely
					.jsonObjectFrom(
						eb
							.selectFrom("clientAddress")
							.select([
								"clientAddress.street as street",
								"clientAddress.descriptiveNumber as descriptiveNumber",
								"clientAddress.city as city",
								"clientAddress.postalCode as postalCode",
							])
							.whereRef("clientAddress.id", "=", "client.id")
							.where("clientAddress.isDeleted", "is not", sqliteTrue),
					)
					.as("address"),

				kysely
					.jsonObjectFrom(
						eb
							.selectFrom("clientCz")
							.select([
								"clientCz.vatPayer as vatPayer",
								"clientCz.identificationNumber as identificationNumber",
								"clientCz.vatNumber as vatNumber",
								"clientCz.caseNumber as caseNumber",
							])
							.whereRef("clientCz.id", "=", "client.id")
							.where("clientCz.isDeleted", "is not", sqliteTrue),
					)
					.as("cz"),
			])
			.where("client.isDeleted", "is not", sqliteTrue)
			.where("client.name", "is not", null)
			.where("client.countryCode", "is not", null)
			.$narrowType<{
				name: NotNull;
				countryCode: NotNull;
				address: NotNull;
			}>();

		if (params.id) {
			qb = qb.where("client.id", "=", params.id);
		}

		return qb;
	});
