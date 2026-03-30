"use client";

import { useTranslation } from "react-i18next";
import { AiAssistantChat } from "@/app/admin/(private)/ai-assistant/ai-assistant-chat";
import { ResponsiveCard } from "@/components/responsive-card";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Home() {
	const { t } = useTranslation();

	return (
		<div className="w-full max-w-4xl">
			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("settings:page.aiAssistant")}</CardTitle>
					<CardDescription>
						{t("settings:page.aiAssistantDescription")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AiAssistantChat />
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
