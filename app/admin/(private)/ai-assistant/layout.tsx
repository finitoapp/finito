"use client";

import { MessageSquareTextIcon, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const aiAssistantTabs = [
	{
		value: "chat",
		label: "Chat",
		icon: MessageSquareTextIcon,
		nextUrl: "/admin/ai-assistant",
	},
	{
		value: "settings",
		label: "Settings",
		icon: SettingsIcon,
		nextUrl: "/admin/ai-assistant/settings",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<DefautLayout titleKey={"admin:layout.title.aiAssistant"}>
			<SubNavShellRoot
				tabsLabel={t("settings:page.aiAssistantTabsSections")}
				tabs={aiAssistantTabs}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
