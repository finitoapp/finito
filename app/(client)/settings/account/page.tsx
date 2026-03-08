"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/settings/account/account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostr } from "@/hooks/use-nostr";

export default function Page() {
	const { t } = useTranslation();
	const { ndk } = useNostr();
	const { data } = useSuspenseQuery({
		queryKey: [],
		queryFn: () =>
			ndk.activeUser.fetchProfile({
				skipOptimisticPublishEvent: true,
			}),
	});

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("settings:page.navigation.account")} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardHeader>
					<CardTitle>{t("settings:page.accountSettings")}</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm key={data ? "yes" : "no"} defaultValues={data} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
