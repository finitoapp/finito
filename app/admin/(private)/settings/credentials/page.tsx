"use client";

import { useTranslation } from "react-i18next";
import { CredentialsForm } from "@/app/admin/(private)/settings/credentials/credentials-form";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
	return (
		<ResponsiveCard className="w-full max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings:page.credentialsSettings")}</CardTitle>
			</CardHeader>
			<CardContent>
				<CredentialsForm />
			</CardContent>
		</ResponsiveCard>
	);
}
