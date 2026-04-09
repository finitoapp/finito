"use client";

import { LandmarkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const accountTabs = [
	{
		value: "accounts",
		labelKey: "accounts:table.accounts",
		icon: LandmarkIcon,
		nextUrl: "/admin/accounts",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<SubNavShellRoot
			tabsLabel={t("accounts:page.tabsSections")}
			tabs={accountTabs}
		>
			{props.children}
		</SubNavShellRoot>
	);
}
