"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientForm } from "@/app/admin/(private)/clients/client-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { nestObjectSkipNullBranches } from "@/lib/object-utils";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("client")
				.leftJoin("clientAddress", "clientAddress.id", "client.id")
				.leftJoin("clientCz", "clientCz.id", "client.id")
				.select([
					"client.id as id",
					"client.name as name",
					"client.label as label",
					"client.email as email",
					"client.countryCode as countryCode",
					"clientAddress.street as address.street",
					"clientAddress.descriptiveNumber as address.descriptiveNumber",
					"clientAddress.city as address.city",
					"clientAddress.postalCode as address.postalCode",
					"clientCz.identificationNumber as address.identificationNumber",
					"clientCz.vatNumber as address.vatNumber",
					"clientCz.caseNumber as address.caseNumber",
				])
				.where("client.isDeleted", "is not", sqliteTrue)
				.where("client.id", "=", id as Id);
		},
		[id],
	);

	const { data: items } = useEvoluQuery(query);

	const item = items && items[0];
	console.log("item", item);

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("clients:page.editClient")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ClientForm
						key={item ? "yes" : "no"}
						defaultValues={item ? nestObjectSkipNullBranches(item) : undefined}
						onSuccess={() =>
							router.push(`/admin/clients/detail?id=${encodeURIComponent(id)}`)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
