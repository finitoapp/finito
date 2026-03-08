"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("accounts:page.newAccount")}</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
