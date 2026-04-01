"use client";

import {
	createIdFromString,
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Trash2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { CopyButton } from "@/components/copy-button";
import { FieldRow } from "@/components/field-row";
import { InlineEdit } from "@/components/inline-edit/inline-edit";
import {
	nonEmptyString255Plugin,
	tagsPlugin,
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
import { useNostr } from "@/hooks/use-nostr";
import { createQuery } from "@/lib/evolu";
import {
	NonEmptyString255Schema,
	type PositiveInteger,
	PositiveIntegerSchema,
	StringToNumberSchema,
} from "@/lib/shared/types";
import { formatDateTime } from "@/lib/shared/utils/format";
import { clientBaseUrl } from "@/lib/shared/utils/window";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const { ndk } = useNostr();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const id = searchParams.get("id");
	const router = useRouter();
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("table")
					.select((eb) => [
						"table.id as id",
						"table.deviceId as deviceId",
						"table.createdAt as createdAt",
						"table.updatedAt as updatedAt",
						"table.label as label",
						"table.numberOfSeats as numberOfSeats",

						evoluJsonArrayFrom(
							eb
								.selectFrom("tableCode")
								.select(["tableCode.code as code"] as const)
								.whereRef("tableCode.tableId", "=", "table.id")
								.where("tableCode.isDeleted", "is not", sqliteTrue)
								.where("tableCode.code", "is not", null)
								.$narrowType<{
									code: KyselyNotNull;
								}>(),
						).as("codes"),
					])
					.where("table.isDeleted", "is not", sqliteTrue)
					.where("table.label", "is not", null)
					.where("table.numberOfSeats", "is not", null)
					.where("table.id", "=", id as Id)
					.$narrowType<{
						label: KyselyNotNull;
						numberOfSeats: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: tables } = useEvoluQuery(query);
	const table = tables[0];

	const { mutateAsync: deleteTable } = useMutation({
		mutationFn: async () => {
			if (table === undefined) {
				return;
			}

			evolu.update("table", { id: table.id, isDeleted: sqliteTrue });
			router.push("/admin/venue/tables");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteTable();
		},
		{
			title: t("tables:detail.deleteDialog.title"),
			description: t("tables:detail.deleteDialog.description"),
			confirmText: t("tables:detail.actions.delete"),
			cancelText: t("tables:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (table === undefined) {
			router.replace("/admin/venue/tables");
		}
	}, [table, router]);

	if (table === undefined) {
		return null;
	}

	const qrCode = table.codes[0];
	const allCodesValue = table.codes.map(({ code }) => code);
	const signerPubkey = ndk.signer?.pubkey;
	const frontendUrl =
		qrCode && signerPubkey
			? `${clientBaseUrl}#t-${signerPubkey}-${qrCode.code}`
			: null;

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
									value={table.label}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("table", {
											id: table.id,
											label: value,
										});
									}}
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-8">
							<div>
								<InlineEdit
									label={t("tables:form.fields.numberOfSeats.label")}
									value={table.numberOfSeats.toString()}
									renderValue={() => table.numberOfSeats.toLocaleString()}
									PluginComponent={textPlugin({
										inputProps: {
											type: "number",
											min: 1,
											step: 1,
										},
										schema: StringToNumberSchema.pipe(PositiveIntegerSchema),
									})}
									onSave={(value: PositiveInteger) => {
										evolu.update("table", {
											id: table.id,
											numberOfSeats: value,
										});
									}}
								/>
								<Separator />
								<InlineEdit
									label={t("tables:detail.fields.codesCount")}
									value={allCodesValue}
									renderValue={() => allCodesValue.join(", ") || "—"}
									PluginComponent={tagsPlugin({
										schema: NonEmptyString255Schema.array(),
									})}
									onSave={async (values) => {
										const origCodes = new Set(allCodesValue);

										for (const code of values) {
											const removed = origCodes.delete(code);
											if (removed) {
												continue;
											}

											evolu.upsert("tableCode", {
												id: createIdFromString(code),
												tableId: table.id,
												code,
											});
										}

										for (const code of origCodes) {
											evolu.update("tableCode", {
												id: createIdFromString(code),
												isDeleted: sqliteTrue,
											});
										}
									}}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>
								{t("tables:detail.sections.codesAndScanning")}
							</CardTitle>
							<CardDescription>
								{t("tables:detail.sections.codesAndScanningDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
							<div>
								<FieldRow
									label={t("tables:detail.fields.accessUrl")}
									value={frontendUrl}
									emptyLabel={t("tables:detail.empty.accessUrl")}
									action={
										frontendUrl ? (
											<Button
												variant="outline"
												size="sm"
												className="shrink-0"
												render={
													<a
														href={frontendUrl}
														target="_blank"
														rel="noopener noreferrer"
													>
														<ExternalLink />
														{t("tables:detail.actions.open")}
													</a>
												}
											/>
										) : null
									}
								/>
							</div>

							<div>
								<div className="mb-3 text-sm text-muted-foreground">
									{t("tables:detail.fields.qrCode")}
								</div>
								{frontendUrl ? (
									<div className="flex min-h-52 items-center justify-center rounded-md border bg-white p-4">
										<QRCodeSVG
											className="w-full"
											size={256}
											value={frontendUrl}
										/>
									</div>
								) : (
									<div className="flex min-h-52 items-center justify-center rounded-md border border-dashed p-6 text-center">
										<p className="max-w-52 text-sm text-muted-foreground">
											{t("tables:detail.empty.qrCode")}
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
								{t("tables:detail.actions.delete")}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("tables:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("tables:detail.fields.recordId")}
								value={table.id}
								action={
									<CopyButton
										text={table.id}
										size="sm"
										className="shrink-0"
										aria-label={t("tables:detail.actions.copyRecordId")}
									/>
								}
							/>
							<Separator />
							<FieldRow
								label={t("tables:detail.fields.added")}
								value={formatDateTime(new Date(table.createdAt))}
							/>
							<Separator />
							<FieldRow
								label={t("tables:detail.fields.updated")}
								value={
									table.updatedAt
										? formatDateTime(new Date(table.updatedAt))
										: null
								}
							/>
							<Separator />
							<FieldRow
								label={t("tables:detail.fields.deviceId")}
								value={table.deviceId}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
