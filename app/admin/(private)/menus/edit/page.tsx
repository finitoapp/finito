"use client";

import {
	evoluJsonArrayFrom,
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MenuForm } from "@/app/admin/(private)/menus/menu-form";
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

	const menuQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("menu")
					.select(
						(eb) =>
							[
								"menu.id as id",
								"menu.deviceId as deviceId",
								"menu.name as name",
								"menu.status as status",
								"menu.validFrom as validFrom",
								"menu.validTo as validTo",
								"menu.publishedAt as publishedAt",

								evoluJsonArrayFrom(
									eb
										.selectFrom("menuCategory")
										.select((eb) => [
											"menuCategory.id as id",
											"menuCategory.menuId as menuId",
											"menuCategory.name as name",

											evoluJsonArrayFrom(
												eb
													.selectFrom("menuItemLine")
													.select(
														(eb) =>
															[
																"menuItemLine.id as id",
																"menuItemLine.availabilityStatus as availabilityStatus",

																evoluJsonObjectFrom(
																	eb
																		.selectFrom("itemRevision")
																		.select([
																			"itemRevision.id as id",
																			"itemRevision.categoryId as categoryId",
																			"itemRevision.itemId as itemId",
																			"itemRevision.label as label",
																			"itemRevision.price as price",
																			"itemRevision.currency as currency",
																			"itemRevision.unitOfMeasure as unitOfMeasure",
																			"itemRevision.internalCode as internalCode",
																			"itemRevision.productCodeType as productCodeType",
																			"itemRevision.productCodeValue as productCodeValue",
																		])
																		.whereRef(
																			"itemRevision.id",
																			"=",
																			"menuItemLine.itemRevisionId",
																		)
																		.where(
																			"itemRevision.isDeleted",
																			"is not",
																			sqliteTrue,
																		)
																		.where("itemRevision.label", "is not", null)
																		.where("itemRevision.price", "is not", null)
																		.where(
																			"itemRevision.currency",
																			"is not",
																			null,
																		)
																		.$narrowType<{
																			label: KyselyNotNull;
																			price: KyselyNotNull;
																			currency: KyselyNotNull;
																		}>(),
																).as("item"),
															] as const,
													)
													.whereRef(
														"menuItemLine.menuCategoryId",
														"=",
														"menuCategory.id",
													)
													.where("menuItemLine.isDeleted", "is not", sqliteTrue)
													.$narrowType<{
														item: KyselyNotNull;
													}>(),
											).as("items"),
										])
										.whereRef("menuCategory.menuId", "=", "menu.id")
										.where("menuCategory.isDeleted", "is not", sqliteTrue)
										.where("menuCategory.name", "is not", null)
										.where("menuCategory.menuId", "=", id as Id)
										.$narrowType<{
											name: KyselyNotNull;
										}>(),
								).as("categories"),
							] as const,
					)
					.where("menu.isDeleted", "is not", sqliteTrue)
					.where("menu.name", "is not", null)
					.where("menu.status", "is not", null)
					.where("menu.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
						status: KyselyNotNull;
					}>(),
			),
		[id],
	);

	const { data: menus } = useEvoluQuery(menuQuery);

	const menu = menus[0];

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
					<MenuForm defaultValues={menu} onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
