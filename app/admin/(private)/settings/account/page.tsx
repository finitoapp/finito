"use client";

import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/settings/account/account-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNostrProfile } from "@/hooks/useNostrProfile";

export default function Home() {
	const { t } = useTranslation();
	const data = useNostrProfile();

	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings:page.accountSettings")}</CardTitle>
			</CardHeader>
			<CardContent>
				<AccountForm key={data ? "yes" : "no"} defaultValues={data ?? null} />
			</CardContent>
		</ResponsiveCard>
	);
}
