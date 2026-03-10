"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ContactForm } from "@/app/admin/(private)/contacts/contact-form";
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
					<CardTitle>{t("contacts:page.newContact")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ContactForm onSuccess={() => router.push("/admin/contacts")} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
