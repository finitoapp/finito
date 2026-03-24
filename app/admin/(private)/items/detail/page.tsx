"use client";

import {
	evoluJsonObjectFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import Barcode from "react-barcode";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { CopyButton } from "@/components/copy-button";
import { FieldRow } from "@/components/field-row";
import { InlineEdit } from "@/components/inline-edit/inline-edit";
import {
	nonEmptyNullableString255Plugin,
	nonEmptyString255Plugin,
	selectPlugin,
	textPlugin,
} from "@/components/inline-edit/inline-edit-plugins";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createQuery } from "@/lib/evolu";
import {
	type Integer,
	IntegerSchema,
	NumberStringSchema,
	ProductCodeType,
} from "@/lib/shared/types";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";
import { moneyCodec } from "@/lib/shared/zod/money-codec";

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

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("item")
					.leftJoin("category", "category.id", "item.categoryId")
					.select(
						(eb) =>
							[
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
								"item.createdAt as createdAt",
								"item.updatedAt as updatedAt",
								"category.name as category.name",

								evoluJsonObjectFrom(
									eb
										.selectFrom("category")
										.select(["category.name as name"])
										.whereRef("category.id", "=", "item.categoryId")
										.where("category.name", "is not", null)
										.$narrowType<{
											name: KyselyNotNull;
										}>(),
								).as("category"),
							] as const,
					)
					.where("item.isDeleted", "is not", sqliteTrue)
					.where("item.price", "is not", null)
					.where("item.currency", "is not", null)
					.where("item.id", "=", id as Id)
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
			title: t("items:detail.deleteDialog.title"),
			description: t("items:detail.deleteDialog.description"),
			confirmText: t("items:detail.actions.delete"),
			cancelText: t("items:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/items");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<div className="mb-4">
				<BackButton />
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>
								<InlineEdit
									value={item.label}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("item", {
											id: item.id,
											label: value,
										});
									}}
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-8 md:grid-cols-2">
							<div>
								<InlineEdit
									label={t("items:form.item-form.label.price")}
									value={
										moneyCodec.encode({
											value: item.price,
											currency: item.currency,
										}).value
									}
									renderValue={() =>
										formatMoney({ value: item.price, currency: item.currency })
									}
									PluginComponent={textPlugin({
										schema: NumberStringSchema.transform(
											(value) =>
												moneyCodec.decode({
													value: value,
													currency: item.currency,
												}).value,
										).pipe(IntegerSchema),
									})}
									onSave={(value: Integer) => {
										evolu.update("item", {
											id: item.id,
											price: value,
										});
									}}
								/>
								<Separator />
								<FieldRow
									label={t("items:form.item-form.label.category-optional")}
									value={item.category?.name}
									emptyLabel={t("items:detail.empty.category")}
								/>
							</div>
							<div>
								<InlineEdit
									value={item.unitOfMeasure}
									label={t(
										"items:form.item-form.label.unit-of-measure-uom-optional",
									)}
									PluginComponent={nonEmptyNullableString255Plugin}
									onSave={(value) => {
										evolu.update("item", {
											id: item.id,
											unitOfMeasure: value,
										});
									}}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>
								{t("items:detail.sections.codesAndScanning")}
							</CardTitle>
							<CardDescription>
								{t("items:detail.sections.codesAndScanningDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
							<div>
								<InlineEdit
									label={t("items:form.item-form.label.type")}
									value={item.productCodeType}
									PluginComponent={selectPlugin({
										options: ProductCodeType,
										allowNull: true,
									})}
									onSave={(value) => {
										evolu.update("item", {
											id: item.id,
											productCodeType: value,
										});
									}}
								/>
								<Separator />
								<InlineEdit
									value={item.productCodeValue}
									label={t("items:form.item-form.label.product-code-optional")}
									PluginComponent={nonEmptyNullableString255Plugin}
									onSave={(value) => {
										evolu.update("item", {
											id: item.id,
											productCodeValue: value,
										});
									}}
								/>
								<Separator />
								<InlineEdit
									value={item.internalCode}
									label={t(
										"items:form.item-form.label.internal-code-sku-optional",
									)}
									PluginComponent={nonEmptyNullableString255Plugin}
									onSave={(value) => {
										evolu.update("item", {
											id: item.id,
											internalCode: value,
										});
									}}
								/>
							</div>

							<div>
								<div className="mb-3 text-sm text-muted-foreground">
									{t("items:detail.fields.barcode")}
								</div>
								{item.productCodeValue ? (
									<div className="flex min-h-52 items-center justify-center rounded-md border bg-white p-4">
										<Barcode
											value={item.productCodeValue}
											displayValue={true}
										/>
									</div>
								) : (
									<div className="flex min-h-52 items-center justify-center rounded-md border border-dashed p-6 text-center">
										<p className="max-w-52 text-sm text-muted-foreground">
											{t("items:detail.empty.barcode")}
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
					<Card>
						<CardHeader>
							<CardTitle>{t("common:table.actions")}</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<Button
								variant="destructive"
								className="w-full"
								onClick={() => void onDelete()}
							>
								<Trash2Icon />
								{t("items:detail.actions.delete")}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("items:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("items:detail.fields.recordId")}
								value={item.id}
								emptyLabel="..."
								action={
									<CopyButton
										text={item.id}
										size="sm"
										className="shrink-0"
										aria-label={t("items:detail.actions.copyRecordId")}
									/>
								}
							/>
							<Separator />
							<FieldRow
								label={t("items:detail.fields.added")}
								value={formatDateTime(new Date(item.createdAt))}
								emptyLabel="..."
							/>
							<Separator />
							<FieldRow
								label={t("items:detail.fields.updated")}
								value={
									item.updatedAt
										? formatDateTime(new Date(item.updatedAt))
										: null
								}
								emptyLabel="..."
							/>
							<Separator />
							<FieldRow
								label={t("items:detail.fields.deviceId")}
								value={item.deviceId}
								emptyLabel="..."
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
