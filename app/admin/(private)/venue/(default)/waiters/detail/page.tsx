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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

	const waiterQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("waiter")
					.select([
						"waiter.id as id",
						"waiter.deviceId as deviceId",
						"waiter.name as name",
						"waiter.createdAt as createdAt",
						"waiter.updatedAt as updatedAt",
					] as const)
					.where("waiter.isDeleted", "is not", sqliteTrue)
					.where("waiter.name", "is not", null)
					.where("waiter.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: waiters } = useEvoluQuery(waiterQuery);
	const waiter = waiters[0];

	const { mutateAsync: deleteWaiter } = useMutation({
		mutationFn: async () => {
			if (waiter === undefined) {
				return;
			}

			evolu.update("waiter", {
				id: waiter.id,
				isDeleted: sqliteTrue,
			});

			router.push("/admin/venue/waiters");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteWaiter();
		},
		{
			title: t("waiters:detail.deleteDialog.title"),
			description: t("waiters:detail.deleteDialog.description"),
			confirmText: t("waiters:detail.actions.delete"),
			cancelText: t("waiters:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (waiter === undefined) {
			router.replace("/admin/venue/waiters");
		}
	}, [waiter, router]);

	if (waiter === undefined) {
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
									value={waiter.name}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("waiter", {
											id: waiter.id,
											name: value,
										});
									}}
								/>
							</CardTitle>
						</CardHeader>
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
								{t("waiters:detail.actions.delete")}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("waiters:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("waiters:detail.fields.recordId")}
								value={waiter.id}
								action={
									<CopyButton
										text={waiter.id}
										size="sm"
										className="shrink-0"
										aria-label={t("waiters:detail.actions.copyRecordId")}
									/>
								}
							/>
							<Separator />
							<FieldRow
								label={t("waiters:detail.fields.added")}
								value={formatDateTime(new Date(waiter.createdAt))}
							/>
							<Separator />
							<FieldRow
								label={t("waiters:detail.fields.updated")}
								value={
									waiter.updatedAt
										? formatDateTime(new Date(waiter.updatedAt))
										: null
								}
							/>
							<Separator />
							<FieldRow
								label={t("waiters:detail.fields.deviceId")}
								value={waiter.deviceId}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
