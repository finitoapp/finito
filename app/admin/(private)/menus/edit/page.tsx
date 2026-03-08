"use client";

import { type Id, kysely, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
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
								"menu.name as name",
								"menu.status as status",
								"menu.validFrom as validFrom",
								"menu.validTo as validTo",
								"menu.publishedAt as publishedAt",

								kysely
									.jsonArrayFrom(
										eb
											.selectFrom("menuCategory")
											.select((eb) => [
												"menuCategory.id as id",
												"menuCategory.menuId as menuId",
												"menuCategory.name as name",

												kysely
													.jsonArrayFrom(
														eb
															.selectFrom("menuItemLine")
															.select(
																(eb) =>
																	[
																		"menuItemLine.id as id",
																		"menuItemLine.availabilityStatus as availabilityStatus",

																		kysely
																			.jsonObjectFrom(
																				eb
																					.selectFrom("menuItem")
																					.select([
																						"menuItem.id as id",
																						"menuItem.categoryId as categoryId",
																						"menuItem.sourceItemId as sourceItemId",
																						"menuItem.label as label",
																						"menuItem.price as price",
																						"menuItem.currency as currency",
																						"menuItem.unitOfMeasure as unitOfMeasure",
																						"menuItem.internalCode as internalCode",
																						"menuItem.productCodeType as productCodeType",
																						"menuItem.productCodeValue as productCodeValue",
																					])
																					.whereRef(
																						"menuItem.id",
																						"=",
																						"menuItemLine.id",
																					)
																					.where(
																						"menuItem.isDeleted",
																						"is not",
																						sqliteTrue,
																					)
																					.where(
																						"menuItem.label",
																						"is not",
																						null,
																					)
																					.where(
																						"menuItem.price",
																						"is not",
																						null,
																					)
																					.where(
																						"menuItem.currency",
																						"is not",
																						null,
																					)
																					.$narrowType<{
																						label: NotNull;
																						price: NotNull;
																						currency: NotNull;
																					}>(),
																			)
																			.as("item"),
																	] as const,
															)
															.whereRef(
																"menuItemLine.menuCategoryId",
																"=",
																"menuCategory.id",
															)
															.where(
																"menuItemLine.isDeleted",
																"is not",
																sqliteTrue,
															)
															.$narrowType<{
																item: NotNull;
															}>(),
													)
													.as("items"),
											])
											.whereRef("menuCategory.menuId", "=", "menu.id")
											.where("menuCategory.isDeleted", "is not", sqliteTrue)
											.where("menuCategory.name", "is not", null)
											.where("menuCategory.menuId", "=", id as Id)
											.$narrowType<{
												name: NotNull;
											}>(),
									)
									.as("categories"),
							] as const,
					)
					.where("menu.isDeleted", "is not", sqliteTrue)
					.where("menu.name", "is not", null)
					.where("menu.status", "is not", null)
					.where("menu.id", "=", id as Id)
					.$narrowType<{
						name: NotNull;
						status: NotNull;
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
