"use client";

import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ContactForm } from "@/app/admin/(private)/contacts/contact-form";
import { accountAtom } from "@/atoms/account";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const account = useAtomValue(accountAtom);

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
					<ContactForm
						defaultValues={{
							deviceId: account.device.id,
						}}
						onSuccess={() => router.push("/admin/contacts")}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
