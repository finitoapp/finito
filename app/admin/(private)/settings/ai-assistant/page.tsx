"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AiAssistantSettingsForm } from "@/app/admin/(private)/settings/ai-assistant/ai-assistant-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
	const { t } = useTranslation();
	const itemId = createIdFromString("");
	const query = useMemo(
		() =>
			createQuery((db) =>
				db
					.selectFrom("aiAssistantSettings")
					.select(["googleApiKey"])
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", itemId)
					.where("googleApiKey", "is not", null)
					.$narrowType<{
						googleApiKey: KyselyNotNull;
					}>(),
			),
		[itemId],
	);

	const { data } = useEvoluQuery(query);
	const item = data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings:page.aiAssistantSettings")}</CardTitle>
			</CardHeader>
			<CardContent>
				<AiAssistantSettingsForm
					defaultValues={
						item
							? {
									googleApiKey: item.googleApiKey,
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
