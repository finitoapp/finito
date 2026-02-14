"use client";


import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { ClientForm } from "@/app/admin/(private)/clients/client-form";
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
					<CardTitle>{t("clients:page.newClient")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ClientForm onSuccess={() => router.push("/admin/clients")} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
