"use client";


import { useTranslation } from "react-i18next";
import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { formatAmount } from "@/lib/shared/utils/format";

export default function Home() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("item")
				.leftJoin("category", "category.id", "item.categoryId")
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
					"item.createdAt as createdAt",
					"category.name as category.name",
				] as const)
				.where("item.isDeleted", "is not", sqliteTrue)
				.where("item.id", "=", id as Id);
		},
		[id],
	);

	const { data: items } = useEvoluQuery(query);

	const item = items && items[0];

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("item", {
				id: item.id,
				isDeleted: sqliteTrue,
			});

			router.push("/admin/items");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: "Delete item?",
			description: "This action cannot be undone.",
			confirmText: "Delete",
			cancelText: "Cancel",
			confirmVariant: "destructive",
		},
	);

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!item && <Skeleton />}
							{item?.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={"Price"}
									content={
										<>
											{!item && <Skeleton />}
											{item &&
												`${formatAmount(item.priceValue, item.priceCurrency)}${item.unitOfMeasure ? ` / ${item.unitOfMeasure}` : ""}`}
										</>
									}
									className={"flex-1"}
								/>

								<StaticCard
									title={"Modified at"}
									content={
										<>
											{!item && <Skeleton />}
											{item && new Date(item.createdAt).toLocaleDateString()}
										</>
									}
									footer={item && new Date(item.createdAt).toLocaleTimeString()}
									className={"flex-1"}
								/>
							</div>

							<div className={"flex flex-wrap gap-8"}>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Name",
												value: item?.label ?? "-",
											},
											{
												key: "Price",
												value: item
													? formatAmount(item.priceValue, item.priceCurrency)
													: "-",
											},
											{
												key: "Unit of measure",
												value: item?.unitOfMeasure ?? "-",
											},
											{
												key: "Category",
												value: item?.category?.name ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}>
									<KeyValueList
										items={[
											{
												key: "Product code",
												value:
													item?.productCodeType && item?.productCodeValue
														? `${item.productCodeType} ${item.productCodeValue}`
														: "-",
												help: "Setting up a product code makes it easier to work with a barcode reader.",
											},
											{
												key: "Internal code (SKU)",
												value: item?.internalCode ?? "-",
											},
										]}
									/>
								</div>
								<div className={"flex-1"}></div>
							</div>
						</div>
					</CardContent>
				</ResponsiveCard>

				<div className={"flex-1 flex flex-col gap-4"}>
					<ResponsiveCard>
						<CardHeader>
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className={"space-y-2"}>
							<Button variant={"outline"} className={"w-full"} asChild>
								<Link href={`/admin/items/edit?id=${encodeURIComponent(id)}`}>
									<EditIcon />
									Edit
								</Link>
							</Button>
							<Button className={"w-full"} onClick={() => void onDelete()}>
								<Trash2Icon />
								Delete
							</Button>
						</CardContent>
					</ResponsiveCard>

					{item && item.productCodeValue && item.productCodeType && (
						<ResponsiveCard>
							<CardHeader>
								<CardTitle>{t("items:page.barcode")}</CardTitle>
							</CardHeader>
							<CardContent>
								<div className={"flex flex-col gap-2"}>
									<div className={"bg-white flex rounded justify-center"}>
										<Barcode
											value={item.productCodeValue}
											displayValue={true}
										/>
									</div>
								</div>
							</CardContent>
						</ResponsiveCard>
					)}
				</div>
			</div>
		</div>
	);
}
