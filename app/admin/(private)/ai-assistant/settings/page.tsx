"use client";

import {
	createIdFromString,
	type KyselyNotNull,
	sqliteTrue,
} from "@evolu/common";
import { useMemo } from "react";
import { AiAssistantSettingsForm } from "@/app/admin/(private)/ai-assistant/settings/ai-assistant-settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createQuery } from "@/lib/evolu";

export default function Home() {
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
		<Card className="w-full max-w-xl">
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
		</Card>
	);
}
