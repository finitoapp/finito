"use client";

import { SmtpForm } from "@/app/admin/(private)/settings/smtp/smtp-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStorageSubscription } from "@/hooks/use-storage-subscription";
import { smtpStorage } from "@/storages/smtp-storage";

export default function Home() {
	const { data } = useStorageSubscription(smtpStorage, {
		limit: 1,
	});

	const item = data && data[0];

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>Email sending settings (SMTP configuration)</CardTitle>
			</CardHeader>
			<CardContent>
				<SmtpForm
					key={data ? "yes" : "no"}
					defaultValues={
						item
							? {
									...item.value,
									port: item.value.port.toString(),
								}
							: undefined
					}
				/>
			</CardContent>
		</ResponsiveCard>
	);
}
