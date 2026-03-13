"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DeviceForm } from "@/app/admin/(private)/devices/device-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton fallbackHref={"/admin/devices" as never} />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("devices:page.newDevice")}</CardTitle>
				</CardHeader>
				<CardContent>
					<DeviceForm onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
