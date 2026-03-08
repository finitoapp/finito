"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import type { NotNull } from "kysely";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SmtpForm } from "@/app/admin/(private)/settings/smtp/smtp-form";
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
					.selectFrom("smtp")
					.selectAll()
					.where("isDeleted", "is not", sqliteTrue)
					.where("id", "=", itemId)
					.where("server", "is not", null)
					.where("port", "is not", null)
					.where("username", "is not", null)
					.where("password", "is not", null)
					.where("email", "is not", null)
					.$narrowType<{
						server: NotNull;
						port: NotNull;
						username: NotNull;
						password: NotNull;
						email: NotNull;
					}>();
			}),
		[itemId],
	);

	const { data } = useEvoluQuery(query);

	const item = data && data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>
					{t("settings:page.emailSendingSettingsSmtpConfiguration")}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<SmtpForm
					defaultValues={
						item
							? {
									...item,
									name: item.name ?? "",
									port: item.port.toString(),
									credentials: {
										username: item.username,
										password: item.password,
									},
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
