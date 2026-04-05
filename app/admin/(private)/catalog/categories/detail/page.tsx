"use client";

import { type Id, type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { CopyButton } from "@/components/copy-button";
import { FieldRow } from "@/components/field-row";
import { InlineEdit } from "@/components/inline-edit/inline-edit";
import { nonEmptyString255Plugin } from "@/components/inline-edit/inline-edit-plugins";
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
import { formatDateTime } from "@/lib/shared/utils/format";

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

	const categoryQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("category")
					.select([
						"category.id as id",
						"category.deviceId as deviceId",
						"category.name as name",
						"category.createdAt as createdAt",
						"category.updatedAt as updatedAt",
					] as const)
					.where("category.isDeleted", "is not", sqliteTrue)
					.where("category.name", "is not", null)
					.where("category.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const linkedItemsQuery = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("catalogItem")
					.select(["catalogItem.id as id"] as const)
					.where("catalogItem.isDeleted", "is not", sqliteTrue)
					.where("catalogItem.categoryId", "=", id as Id),
			),
		[id],
	);

	const { data: categories } = useEvoluQuery(categoryQuery);
	const { data: linkedItems } = useEvoluQuery(linkedItemsQuery);

	const category = categories[0];
	const linkedItemsCount = linkedItems.length;

	const { mutateAsync: deleteCategory } = useMutation({
		mutationFn: async () => {
			if (category === undefined) {
				return;
			}

			evolu.update("category", {
				id: category.id,
				isDeleted: sqliteTrue,
			});

			router.push("/admin/catalog/categories");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteCategory();
		},
		{
			title: t("categories:detail.deleteDialog.title"),
			description: t("categories:detail.deleteDialog.description"),
			confirmText: t("categories:detail.actions.delete"),
			cancelText: t("categories:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (category === undefined) {
			router.replace("/admin/catalog/categories");
		}
	}, [category, router]);

	if (category === undefined) {
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
									value={category.name}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("category", {
											id: category.id,
											name: value,
										});
									}}
								/>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("categories:detail.fields.itemsCount")}
								value={linkedItemsCount.toLocaleString()}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("categories:detail.sections.items")}</CardTitle>
							<CardDescription>
								{t("categories:detail.sections.itemsDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("categories:detail.fields.itemsCount")}
								value={linkedItemsCount.toLocaleString()}
							/>
							<Separator />
							<FieldRow
								label={t("categories:detail.fields.usageStatus")}
								value={
									linkedItemsCount > 0
										? t("categories:detail.values.inUse")
										: t("categories:detail.values.notUsed")
								}
							/>
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
								{t("categories:detail.actions.delete")}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("categories:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("categories:detail.fields.recordId")}
								value={category.id}
								action={
									<CopyButton
										text={category.id}
										size="sm"
										className="shrink-0"
										aria-label={t("categories:detail.actions.copyRecordId")}
									/>
								}
							/>
							<Separator />
							<FieldRow
								label={t("categories:detail.fields.added")}
								value={formatDateTime(new Date(category.createdAt))}
							/>
							<Separator />
							<FieldRow
								label={t("categories:detail.fields.updated")}
								value={
									category.updatedAt
										? formatDateTime(new Date(category.updatedAt))
										: null
								}
							/>
							<Separator />
							<FieldRow
								label={t("categories:detail.fields.deviceId")}
								value={category.deviceId}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
