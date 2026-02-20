"use client";

import { createIdFromString, sqliteFalse, sqliteTrue } from "@evolu/common";
import { useTranslation } from "react-i18next";
import { FioPluginForm } from "@/app/admin/(private)/settings/fio-plugin/fio-plugin-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("fioPlugin")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const { data } = useEvoluQuery(query);

	const item = data && data[0];

	const tokensQuery = useCreateQuery(
		(db) => {
			return db
				.selectFrom("fioPluginToken")
				.select([
					"fioPluginToken.id as id",
					"fioPluginToken.token as token",
				] as const)
				.where("fioPluginToken.isDeleted", "is not", sqliteTrue)
				.where("fioPluginToken.fioPluginId", "=", itemId);
		},
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
						key={item && tokens !== undefined ? "yes" : "no"}
						defaultValues={
							item && tokens
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
