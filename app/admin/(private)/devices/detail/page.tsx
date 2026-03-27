"use client";

import {
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { EditIcon } from "lucide-react";
import Link from "next/link";
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
import { createQuery } from "@/lib/evolu";
import { formatDateTime } from "@/lib/shared/utils/format";

export default function Home() {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();

	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("device")
					.select((eb) => [
						"device.id as id",
						"device.createdAt as createdAt",
						"device.updatedAt as updatedAt",
						"device.name as name",
						"device.deviceType as deviceType",
						"device.deviceVendor as deviceVendor",
						"device.browserName as browserName",
						"device.osName as osName",
						evoluJsonArrayFrom(
							eb
								.selectFrom("table")
								.select(["table.id as id"] as const)
								.whereRef("table.deviceId", "=", "device.id")
								.where("table.isDeleted", "is not", sqliteTrue),
						).as("tables"),
					])
					.where("device.isDeleted", "is not", sqliteTrue)
					.where("device.name", "is not", null)
					.where("device.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
						tables: KyselyNotNull;
					}>(),
			),
		[id],
	);

	const { data: devices } = useEvoluQuery(query);
	const device = devices[0];

	useEffect(() => {
		if (device === undefined) {
			router.replace("/admin/devices");
		}
	}, [device, router]);

	if (device === undefined) {
		return null;
	}

	return (
		<div className="w-full lg:max-w-7xl">
			<div className="mb-4">
				<BackButton fallbackHref={"/admin/devices"} />
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>
								<InlineEdit
									value={device.name}
									PluginComponent={nonEmptyString255Plugin}
									onSave={(value) => {
										evolu.update("device", {
											id: device.id,
											name: value,
										});
									}}
								/>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("devices:detail.fields.tablesCount")}
								value={device.tables.length.toLocaleString()}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("devices:detail.sections.environment")}</CardTitle>
							<CardDescription>
								{t("devices:detail.sections.environmentDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("devices:table.columns.device-type")}
								value={device.deviceType}
								emptyLabel={t("devices:detail.empty.unknown")}
							/>
							<Separator />
							<FieldRow
								label={t("devices:table.columns.device-vendor")}
								value={device.deviceVendor}
								emptyLabel={t("devices:detail.empty.unknown")}
							/>
							<Separator />
							<FieldRow
								label={t("devices:table.columns.os-name")}
								value={device.osName}
								emptyLabel={t("devices:detail.empty.unknown")}
							/>
							<Separator />
							<FieldRow
								label={t("devices:table.columns.browser-name")}
								value={device.browserName}
								emptyLabel={t("devices:detail.empty.unknown")}
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
								variant="outline"
								className="w-full"
								render={
									<Link
										href={`/admin/devices/edit?id=${encodeURIComponent(id)}`}
									/>
								}
							>
								<EditIcon />
								{t("common:actions.edit")}
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("devices:detail.sections.metadata")}</CardTitle>
						</CardHeader>
						<CardContent>
							<FieldRow
								label={t("devices:detail.fields.recordId")}
								value={device.id}
								action={
									<CopyButton
										text={device.id}
										size="sm"
										className="shrink-0"
										aria-label={t("devices:detail.actions.copyRecordId")}
									/>
								}
							/>
							<Separator />
							<FieldRow
								label={t("devices:detail.fields.added")}
								value={formatDateTime(new Date(device.createdAt))}
							/>
							<Separator />
							<FieldRow
								label={t("devices:detail.fields.updated")}
								value={
									device.updatedAt
										? formatDateTime(new Date(device.updatedAt))
										: null
								}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
