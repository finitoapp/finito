"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FioPluginForm } from "@/app/admin/(private)/settings/fio-plugin/fio-plugin-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const query = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("fioPlugin")
					.selectAll()
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", itemId)
					.where("apiUrl", "is not", null)
					.where("numberOfSecondsBetweenChecks", "is not", null)
					.where("isActive", "is not", null)
					.$narrowType<{
						apiUrl: KyselyNotNull;
						numberOfSecondsBetweenChecks: KyselyNotNull;
						isActive: KyselyNotNull;
					}>();
			}),
		[itemId],
	);

	const { data } = useEvoluQuery(query);

	const item = data[0];

	const tokensQuery = useMemo(
		() =>
			createQuery((db) => {
				return db
					.selectFrom("fioPluginToken")
					.select([
						"fioPluginToken.id as id",
						"fioPluginToken.token as token",
					] as const)
					.where("fioPluginToken.isDeleted", "is not", sqliteTrue)
					.where("fioPluginToken.fioPluginId", "=", itemId)
					.where("fioPluginToken.token", "is not", null)
					.$narrowType<{
						token: KyselyNotNull;
					}>();
			}),
		[itemId],
	);

	const { data: tokens } = useEvoluQuery(tokensQuery);

	return (
		<div className={"w-full lg:max-w-4xl"}>
			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("settings:page.fioBankPlugin")}</CardTitle>
				</CardHeader>
				<CardContent>
					<FioPluginForm
						defaultValues={
							item
								? {
										...item,
										isActive: item.isActive === sqliteTrue,
										numberOfSecondsBetweenChecks:
											item.numberOfSecondsBetweenChecks.toString(),
										tokens,
									}
								: undefined
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
