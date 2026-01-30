"use client";

import { createIdFromString, sqliteTrue } from "@evolu/common";
import { SmtpForm } from "@/app/admin/(private)/settings/smtp/smtp-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Home() {
	const itemId = createIdFromString("");
	const query = useCreateQuery(
		(db) => {
			return db
				.selectFrom("smtp")
				.selectAll()
				.where("isDeleted", "is not", sqliteTrue)
				.where("id", "=", itemId);
		},
		[itemId],
	);

	const { data } = useEvoluQuery(query);

	const item = data && data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Email sending settings (SMTP configuration)</CardTitle>
			</CardHeader>
			<CardContent>
				<SmtpForm
					key={item ? "yes" : "no"}
					defaultValues={
						item
							? {
									...item,
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
