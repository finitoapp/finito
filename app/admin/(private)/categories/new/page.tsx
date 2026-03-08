"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CategoryForm } from "@/app/admin/(private)/categories/category-form";
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
					<CardTitle>{t("categories:page.newCategory")}</CardTitle>
				</CardHeader>
				<CardContent>
					<CategoryForm onSuccess={() => router.back()} />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
