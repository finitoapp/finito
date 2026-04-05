"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import Barcode from "react-barcode";
import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/copy-button";
import { FieldRow } from "@/components/field-row";
import { InlineEdit } from "@/components/inline-edit/inline-edit";
import selectPlugin, {
	nonEmptyNullableString255Plugin,
	nonEmptyString255Plugin,
	textPlugin,
} from "@/components/inline-edit/inline-edit-plugins";
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
import { activeCategoryLabelsQuery } from "@/lib/evolu/queries/category";
import { createExternalStoreForEvoluQuery } from "@/lib/evolu/utils";
import {
	type Integer,
	IntegerSchema,
	NumberStringSchema,
	ProductCodeType,
} from "@/lib/shared/types";
import { formatDateTime, formatMoney } from "@/lib/shared/utils/format";
import { moneyCodec } from "@/lib/shared/zod/money-codec";
import { createItemDetailQuery } from "./item-detail-query";

export default function Home() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();

	if (id === null) {
		throw Promise.reject();
	}

	const itemDetailQuery = useMemo(() => createItemDetailQuery(id as Id), [id]);

	const { data: items } = useEvoluQuery(itemDetailQuery);
	const item = items[0];

	const CategoryPlugin = useMemo(() => {
		return selectPlugin({
			options: createExternalStoreForEvoluQuery(
				evolu,
				activeCategoryLabelsQuery,
			),
			allowNull: true,
		});
	}, [evolu]);

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/catalog");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>
								<InlineEdit
									value={item.label}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("catalogItem", {
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
										evolu.update("catalogItem", {
											id: item.id,
											price: value,
										});
									}}
								/>
								<Separator />
								<InlineEdit
									label={t("items:form.item-form.label.category-optional")}
									value={item.categoryId ?? null}
									renderValue={() => item.category?.name ?? null}
									PluginComponent={CategoryPlugin}
									onSave={(value: Id | null) => {
										evolu.update("catalogItem", {
											id: item.id,
											categoryId: value,
										});
									}}
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
										evolu.update("catalogItem", {
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
										evolu.update("catalogItem", {
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
										evolu.update("catalogItem", {
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
										evolu.update("catalogItem", {
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
							<CardTitle>{t("items:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("items:detail.fields.recordId")}
								value={item.id}
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
							/>
							<Separator />
							<FieldRow
								label={t("items:detail.fields.updated")}
								value={
									item.updatedAt
										? formatDateTime(new Date(item.updatedAt))
										: null
								}
							/>
							<Separator />
							<FieldRow
								label={t("items:detail.fields.deviceId")}
								value={item.deviceId}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
