"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { ItemForm } from "@/app/admin/(private)/items/item-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { ProductCodeType } from "@/lib/shared/types";

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
				.selectFrom("item")
				.select([
					"item.id as id",
					"item.label as label",
					"item.priceValue as priceValue",
					"item.priceCurrency as priceCurrency",
					"item.unitOfMeasure as unitOfMeasure",
					"item.categoryId as categoryId",
					"item.productCodeType as productCodeType",
					"item.productCodeValue as productCodeValue",
					"item.internalCode as internalCode",
				] as const)
				.where("item.isDeleted", "is not", sqliteTrue)
				.where("item.id", "=", id as Id);
		},
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items && items[0];
	console.log("item", item);

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
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item,
										priceValue: item.priceValue.toString(),
										priceCurrency: item.priceCurrency,
										categoryId: item.categoryId ?? "",
										productCodeValue: item.productCodeValue ?? "",
										productCodeType:
											item.productCodeType ?? ProductCodeType.EAN,
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
