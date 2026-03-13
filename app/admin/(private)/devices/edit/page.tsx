"use client";

import {
	evoluJsonArrayFrom,
	type Id,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DeviceForm } from "@/app/admin/(private)/devices/device-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const deviceQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("device")
					.select((eb) => [
						"device.id as id",
						"device.name as name",
						evoluJsonArrayFrom(
							eb
								.selectFrom("table")
								.select(["table.id as id"] as const)
								.whereRef("table.deviceId", "=", "device.id")
								.where("table.isDeleted", "is not", sqliteTrue),
						).as("tables"),
					])
					.where("device.id", "=", id as Id)
					.where("device.isDeleted", "is not", sqliteTrue)
					.where("device.name", "is not", null)
					.$narrowType<{
						name: KyselyNotNull;
						tables: KyselyNotNull;
					}>();
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(deviceQuery);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/devices" as never);
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton fallbackHref={"/admin/devices" as never} />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("devices:page.editDevice")}</CardTitle>
				</CardHeader>
				<CardContent>
					<DeviceForm defaultValues={item} onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
