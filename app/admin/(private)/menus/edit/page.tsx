"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	MenuForm,
	type MenuFormDefaultValues,
} from "@/app/admin/(private)/menus/menu-form";
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

	const menuQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menu")
				.select([
					"menu.id as id",
					"menu.name as name",
					"menu.status as status",
					"menu.validFrom as validFrom",
					"menu.validTo as validTo",
					"menu.publishedAt as publishedAt",
				] as const)
				.where("menu.isDeleted", "is not", sqliteTrue)
				.where("menu.id", "=", id as Id),
		[id],
	);
	const categoriesQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menuCategory")
				.select([
					"menuCategory.id as id",
					"menuCategory.menuId as menuId",
					"menuCategory.name as name",
				] as const)
				.where("menuCategory.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.menuId", "=", id as Id),
		[id],
	);
	const itemsQuery = useCreateQuery(
		(db) =>
			db
				.selectFrom("menuItem")
				.innerJoin("menuCategory", "menuCategory.id", "menuItem.menuCategoryId")
				.select([
					"menuItem.id as id",
					"menuItem.menuCategoryId as menuCategoryId",
					"menuItem.sourceItemId as sourceItemId",
					"menuItem.label as label",
					"menuItem.priceValue as priceValue",
					"menuItem.priceCurrency as priceCurrency",
					"menuItem.unitOfMeasure as unitOfMeasure",
					"menuItem.internalCode as internalCode",
					"menuItem.productCodeType as productCodeType",
					"menuItem.productCodeValue as productCodeValue",
				] as const)
				.where("menuItem.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.isDeleted", "is not", sqliteTrue)
				.where("menuCategory.menuId", "=", id as Id),
		[id],
	);

	const { data: menus } = useEvoluQuery(menuQuery);
	const { data: categoriesRows } = useEvoluQuery(categoriesQuery);
	const { data: itemsRows } = useEvoluQuery(itemsQuery);

	const defaultValues = useMemo<MenuFormDefaultValues | undefined>(() => {
		const menu = menus?.[0];
		if (!menu) return undefined;

		const categoriesMap = new Map<
			string,
			{
				id: string;
				name: string;
				items: NonNullable<
					MenuFormDefaultValues["categories"]
				>[number]["items"];
			}
		>();
		for (const category of categoriesRows ?? []) {
			categoriesMap.set(category.id, {
				id: category.id,
				name: category.name,
				items: [],
			});
		}
		for (const item of itemsRows ?? []) {
			const category = categoriesMap.get(item.menuCategoryId);
			if (!category) continue;
			category.items.push({
				id: item.id,
				sourceItemId: item.sourceItemId,
				label: item.label,
				priceValue: item.priceValue,
				priceCurrency: item.priceCurrency,
				unitOfMeasure: item.unitOfMeasure,
				internalCode: item.internalCode,
				productCodeType: item.productCodeType,
				productCodeValue: item.productCodeValue,
			});
		}

		const categories = [...categoriesMap.values()]
			.map((category) => ({
				...category,
				items: [...category.items].sort((a, b) =>
					a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
				),
			}))
			.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			);

		return {
			id: menu.id,
			name: menu.name,
			status: menu.status,
			validFrom: menu.validFrom,
			validTo: menu.validTo,
			publishedAt: menu.publishedAt,
			categories,
		};
	}, [menus, categoriesRows, itemsRows]);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("menus:page.editMenu")}</CardTitle>
				</CardHeader>
				<CardContent>
					<MenuForm
						key={`${defaultValues?.id ?? "new"}:${defaultValues?.categories?.length ?? 0}:${defaultValues?.categories?.flatMap((category) => category.items).length ?? 0}`}
						defaultValues={defaultValues}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
