import {
	evoluJsonObjectFrom,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { createQuery } from "@/lib/evolu";
import type { Id } from "@/lib/evolu/types";

export const createGetContactsQuery = (params: { id?: Id } = {}) =>
	createQuery((db) => {
		let qb = db
			.selectFrom("contact")
			.select((eb) => [
				"contact.id as id",
				"contact.deviceId as deviceId",
				"contact.createdAt as createdAt",
				"contact.name as name",
				"contact.label as label",
				"contact.email as email",
				"contact.phone as phone",

				evoluJsonObjectFrom(
					eb
						.selectFrom("contactAddress")
						.select([
							"contactAddress.street as street",
							"contactAddress.descriptiveNumber as descriptiveNumber",
							"contactAddress.city as city",
							"contactAddress.postalCode as postalCode",
						])
						.whereRef("contactAddress.id", "=", "contact.id")
						.where("contactAddress.isDeleted", "is not", sqliteTrue),
				).as("address"),

				evoluJsonObjectFrom(
					eb
						.selectFrom("contactBillingInfo")
						.select((eb) => [
							"contactBillingInfo.countryCode as countryCode",

							evoluJsonObjectFrom(
								eb
									.selectFrom("contactBillingInfoCz")
									.select([
										"contactBillingInfoCz.vatPayer as vatPayer",
										"contactBillingInfoCz.identificationNumber as identificationNumber",
										"contactBillingInfoCz.vatNumber as vatNumber",
										"contactBillingInfoCz.caseNumber as caseNumber",
									])
									.whereRef("contactBillingInfoCz.id", "=", "contact.id")
									.where(
										"contactBillingInfoCz.isDeleted",
										"is not",
										sqliteTrue,
									),
							).as("cz"),
						])
						.whereRef("contactBillingInfo.id", "=", "contact.id")
						.where("contactBillingInfo.isDeleted", "is not", sqliteTrue)
						.where("contactBillingInfo.countryCode", "is not", null)
						.$narrowType<{
							countryCode: KyselyNotNull;
						}>(),
				).as("billingInfo"),
			])
			.where("contact.isDeleted", "is not", sqliteTrue)
			.where("contact.name", "is not", null)
			.$narrowType<{
				name: KyselyNotNull;
			}>();

		if (params.id) {
			qb = qb.where("contact.id", "=", params.id);
		}

		return qb;
	});
