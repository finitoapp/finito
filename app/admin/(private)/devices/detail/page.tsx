"use client";

import { type Id, type KyselyNotNull, sqliteTrue } from "@evolu/common";
import { EditIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { KeyValueList } from "@/components/key-value-list";
import { ResponsiveCard } from "@/components/responsive-card";
import { StaticCard } from "@/components/static-card";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("device")
					.select([
						"device.id as id",
						"device.createdAt as createdAt",
						"device.name as name",
					])
					.where("device.isDeleted", "is not", sqliteTrue)
					.where("device.name", "is not", null)
					.where("device.id", "=", id as Id)
					.$narrowType<{
						name: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(query);
	const item = items[0];

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton fallbackHref={"/admin/devices" as never} />
			</div>

			<div className={"flex gap-4 flex-wrap"}>
				<ResponsiveCard className={"flex-2"}>
					<CardHeader>
						<CardTitle>
							{!item && <Skeleton />}
							{item?.name}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={"flex flex-col gap-8"}>
							<div className={"flex gap-4"}>
								<StaticCard
									title={t("devices:detail.createdAt")}
									content={
										<>
											{!item && <Skeleton />}
											{item && new Date(item.createdAt).toLocaleDateString()}
										</>
									}
									footer={item && new Date(item.createdAt).toLocaleTimeString()}
									className={"flex-1"}
								/>

								<StaticCard
									title={t("devices:detail.modifiedAt")}
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
												key: t("devices:detail.fields.name"),
												value: item?.name ?? "-",
											},
											{
												key: t("devices:detail.fields.id"),
												value: item?.id ?? "-",
											},
											{
												key: t("devices:detail.fields.createdAt"),
												value: item
													? new Date(item.createdAt).toLocaleString()
													: "-",
											},
										]}
									/>
								</div>
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
							<Button
								variant={"outline"}
								className={"w-full"}
								render={
									<Link
										href={
											`/admin/devices/edit?id=${encodeURIComponent(id)}` as never
										}
									/>
								}
							>
								<EditIcon />
								{t("common:actions.edit")}
							</Button>
						</CardContent>
					</ResponsiveCard>
				</div>
			</div>
		</div>
	);
}
