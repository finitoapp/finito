"use client";

import { createIdFromString, kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BillingInfoForm } from "@/app/admin/(private)/settings/billing-info/billing-info-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("billingInfo")
					.select(
						(eb) =>
							[
								kysely
									.jsonObjectFrom(
										eb
											.selectFrom("billingInfoAddress")
											.select([
												"billingInfoAddress.street as street",
												"billingInfoAddress.descriptiveNumber as descriptiveNumber",
												"billingInfoAddress.city as city",
												"billingInfoAddress.postalCode as postalCode",
											])
											.whereRef("billingInfoAddress.id", "=", "billingInfo.id")
											.where(
												"billingInfoAddress.isDeleted",
												"is not",
												sqliteTrue,
											),
									)
									.as("address"),

								kysely
									.jsonObjectFrom(
										eb
											.selectFrom("billingInfoCz")
											.select([
												"billingInfoCz.vatPayer as vatPayer",
												"billingInfoCz.identificationNumber as identificationNumber",
												"billingInfoCz.vatNumber as vatNumber",
												"billingInfoCz.caseNumber as caseNumber",
											])
											.whereRef("billingInfoCz.id", "=", "billingInfo.id")
											.where("isDeleted", "is not", sqliteTrue)
											.where("vatPayer", "is not", null)
											.$narrowType<{
												vatPayer: NotNull;
											}>(),
									)
									.as("cz"),
							] as const,
					)
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", itemId)
					.where("name", "is not", null)
					.where("countryCode", "is not", null)
					.$narrowType<{
						name: NotNull;
						countryCode: NotNull;
					}>();
			}),
		[itemId],
	);

	const { data } = useEvoluQuery(query);
	const item = data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings:page.billingInformation")}</CardTitle>
			</CardHeader>
			<CardContent>
				<BillingInfoForm
					defaultValues={
						item
							? {
									...item,
									address: item.address
										? {
												street: item.address.street ?? "",
												descriptiveNumber: item.address.descriptiveNumber ?? "",
												city: item.address.city ?? "",
												postalCode: item.address.postalCode ?? "",
											}
										: undefined,
									cz: item.cz
										? {
												vatPayer: item.cz.vatPayer === sqliteTrue,
												vatNumber: item.cz.vatNumber ?? "",
												identificationNumber:
													item.cz.identificationNumber ?? "",
												caseNumber: item.cz.caseNumber ?? "",
											}
										: undefined,
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
