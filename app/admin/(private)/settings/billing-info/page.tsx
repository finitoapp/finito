"use client";


import { useTranslation } from "react-i18next";
import { createIdFromString, sqliteTrue } from "@evolu/common";
import { BillingInfoForm } from "@/app/admin/(private)/settings/billing-info/billing-info-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { CountryCode } from "@/lib/types";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("billingInfo")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const addressQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("billingInfoAddress")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const czQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("billingInfoCz")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const { data } = useEvoluQuery(query);
	const { data: addressData } = useEvoluQuery(addressQuery);
	const { data: czData } = useEvoluQuery(czQuery);

	const item = data && data[0];
	const address = addressData && addressData[0];
	const cz = czData && czData[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings:page.billingInformation")}</CardTitle>
			</CardHeader>
			<CardContent>
				<BillingInfoForm
					key={item && address && cz ? "yes" : "no"}
					defaultValues={
						item && address && cz
							? {
									...item,
									address,
									cz: {
										vatPayer: cz.vatPayer === sqliteTrue,
										vatNumber: cz.vatNumber ?? "",
										identificationNumber: cz.identificationNumber ?? "",
										caseNumber: cz.caseNumber ?? "",
									},
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
