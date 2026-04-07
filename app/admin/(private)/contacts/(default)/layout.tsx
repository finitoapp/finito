"use client";

import { IconSettings, IconUsers } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const contactsTabs = [
	{
		value: "contacts",
		labelKey: "navigation:main.links.contacts",
		icon: IconUsers,
		nextUrl: "/admin/contacts",
	},
	{
		value: "settings",
		labelKey: "navigation:main.settings",
		icon: IconSettings,
		nextUrl: "/admin/contacts/settings" as never,
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
			tabsLabel={t("contacts:page.tabsSections")}
			tabs={contactsTabs}
		>
			{props.children}
		</SubNavShellRoot>
	);
}
