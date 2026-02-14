"use client";


import { useTranslation } from "react-i18next";
import { CredentialsForm } from "@/app/admin/(private)/settings/credentials/credentials-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
	const { t } = useTranslation();
	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={"Credentials"} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardHeader>
					<CardTitle>{t("settings:page.credentialsSettings")}</CardTitle>
				</CardHeader>
				<CardContent>
					<CredentialsForm />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
