"use client";

import { type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CategoryForm } from "@/app/admin/(private)/categories/category-form";
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

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("category")
					.select([
						"category.id as id",
						"category.deviceId as deviceId",
						"category.name as name",
					] as const)
					.where("category.isDeleted", "is not", sqliteTrue)
					.where("category.id", "=", id as never)
					.where("category.name", "is not", null)
					.$narrowType<{
						name: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: categories } = useEvoluQuery(query);
	const category = categories[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("categories:page.editCategory")}</CardTitle>
				</CardHeader>
				<CardContent>
					<CategoryForm
						defaultValues={category}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
