"use client";

import { useTranslation } from "react-i18next";
import { SubNavShellContent } from "@/components/sub-nav-shell";

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<SubNavShellContent
			title={"Chat"}
			description={t("settings:page.aiAssistantDescription")}
		>
			{props.children}
		</SubNavShellContent>
	);
}
