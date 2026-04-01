"use client";

import { type Id, type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";
import { ProductCodeType } from "@/lib/shared/types";
import { moneyCodec } from "@/lib/shared/zod/money-codec";
import { ItemForm } from "../item-form";

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
					.selectFrom("item")
					.select([
						"item.id as id",
						"item.deviceId as deviceId",
						"item.label as label",
						"item.price as price",
						"item.currency as currency",
						"item.unitOfMeasure as unitOfMeasure",
						"item.categoryId as categoryId",
						"item.productCodeType as productCodeType",
						"item.productCodeValue as productCodeValue",
						"item.internalCode as internalCode",
					] as const)
					.where("item.id", "=", id as Id)
					.where("item.isDeleted", "is not", sqliteTrue)
					.where("item.label", "is not", null)
					.where("item.price", "is not", null)
					.where("item.currency", "is not", null)
					.$narrowType<{
						label: KyselyNotNull;
						price: KyselyNotNull;
						currency: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/catalog");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("items:page.editItem")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemForm
						defaultValues={{
							...item,
							price: moneyCodec.encode({
								value: item.price,
								currency: item.currency,
							}).value,
							currency: item.currency,
							categoryId: item.categoryId ?? "",
							productCodeValue: item.productCodeValue ?? "",
							productCodeType: item.productCodeType ?? ProductCodeType.EAN,
							unitOfMeasure: item.unitOfMeasure ?? "",
							internalCode: item.internalCode ?? "",
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
