"use client";

import { type Id, kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const tableQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("table")
					.select(
						(eb) =>
							[
								"table.id as id",
								"table.label as label",
								"table.numberOfSeats as numberOfSeats",

								kysely
									.jsonArrayFrom(
										eb
											.selectFrom("tableCode")
											.select([
												"tableCode.id as id",
												"tableCode.code as code",
											] as const)
											.whereRef("tableCode.tableId", "=", "table.id")
											.where("tableCode.isDeleted", "is not", sqliteTrue)
											.where("tableCode.code", "is not", null)
											.$narrowType<{
												code: NotNull;
											}>(),
									)
									.as("codes"),
							] as const,
					)
					.where("table.id", "=", id as Id)
					.where("table.isDeleted", "is not", sqliteTrue)
					.where("table.label", "is not", null)
					.where("table.numberOfSeats", "is not", null)
					.$narrowType<{
						label: NotNull;
						numberOfSeats: NotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(tableQuery);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/tables");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

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
						defaultValues={{
							...item,
							numberOfSeats: item.numberOfSeats.toString(),
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
