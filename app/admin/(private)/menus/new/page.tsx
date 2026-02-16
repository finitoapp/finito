"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { MenuForm } from "@/app/admin/(private)/menus/menu-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className={"w-full lg:max-w-7xl"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("menus:page.newMenu")}</CardTitle>
				</CardHeader>
				<CardContent>
					<MenuForm
						onSuccess={(newId) =>
							router.push(
								`/admin/menus/detail?id=${encodeURIComponent(newId)}` as never,
							)
						}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
