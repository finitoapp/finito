"use client";

import {
	IconCashBanknote,
	IconKey,
	IconListDetails,
	IconMail,
	IconSettings,
	IconUserCircle,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const settingsTabs = [
	{
		value: "billingSettings",
		labelKey: "navigation:settings.links.generalSettings",
		icon: IconSettings,
		nextUrl: "/admin/settings",
	},
	{
		value: "devices",
		labelKey: "navigation:settings.links.devices",
		icon: IconListDetails,
		nextUrl: "/admin/settings/devices",
	},
	{
		value: "account",
		labelKey: "navigation:settings.links.account",
		icon: IconUserCircle,
		nextUrl: "/admin/settings/account",
	},
	{
		value: "fioPlugin",
		labelKey: "navigation:settings.links.fioPlugin",
		icon: IconCashBanknote,
		nextUrl: "/admin/settings/fio-plugin",
	},
	{
		value: "smtp",
		labelKey: "navigation:settings.links.emailPlugin",
		icon: IconMail,
		nextUrl: "/admin/settings/smtp",
	},
	{
		value: "credentials",
		labelKey: "navigation:settings.links.credentials",
		icon: IconKey,
		nextUrl: "/admin/settings/credentials",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<DefautLayout titleKey={"admin:layout.title.settings"}>
			<SubNavShellRoot
				tabsLabel={t("settings:page.settings")}
				tabs={settingsTabs}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
