"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

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
				.selectFrom("table")
				.select([
					"table.id as id",
					"table.label as label",
					"table.numberOfSeats as numberOfSeats",
				] as const)
				.where("table.isDeleted", "is not", sqliteTrue)
				.where("table.id", "=", id as Id);
		},
		[id],
	);

	const codesQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("tableCode")
				.select(["tableCode.id as id", "tableCode.code as code"] as const)
				.where("tableCode.isDeleted", "is not", sqliteTrue)
				.where("tableCode.tableId", "=", id as Id);
		},
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const { data: tableCodes } = useEvoluQuery(codesQuery);
	const item = items && items[0];
	console.log("item", item);

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("tables:page.editTable")}</CardTitle>
				</CardHeader>
				<CardContent>
					<TableForm
						key={item && tableCodes !== undefined ? "yes" : "no"}
						defaultValues={
							item && tableCodes
								? {
										...item,
										numberOfSeats: item.numberOfSeats.toString(),
										codes: tableCodes,
									}
								: undefined
						}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
