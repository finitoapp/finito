"use client";

import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TableForm } from "@/app/admin/(private)/tables/table-form";
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
					<CardTitle>{t("tables:page.newTable")}</CardTitle>
				</CardHeader>
				<CardContent>
					<TableForm
						defaultValues={{
							deviceId: account.device.id,
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
