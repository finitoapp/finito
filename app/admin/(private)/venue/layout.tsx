"use client";

import { IconClock, IconPicnicTable, IconUsers } from "@tabler/icons-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

type VenueTab = "tables" | "openingHours" | "waiters";

const venueTabs = [
	{
		value: "tables",
		labelKey: "navigation:main.links.tables",
		icon: IconPicnicTable,
	},
	{
		value: "openingHours",
		label: "Opening Hours",
		icon: IconClock,
	},
	{
		value: "waiters",
		labelKey: "navigation:main.links.waiters",
		icon: IconUsers,
	},
] as const;

const resolveActiveTab = (pathname: string): VenueTab =>
	pathname.startsWith("/admin/venue/opening-hours")
		? "openingHours"
		: pathname.startsWith("/admin/venue/waiters")
			? "waiters"
			: "tables";

const resolvePath = (tab: VenueTab) => {
	switch (tab) {
		case "tables":
			return "/admin/venue/tables";
		case "openingHours":
			return "/admin/venue/opening-hours";
		case "waiters":
			return "/admin/venue/waiters";
	}
};

const isTabbedRoute = (pathname: string) =>
	pathname.startsWith("/admin/venue/tables") ||
	pathname.startsWith("/admin/venue/opening-hours") ||
	pathname.startsWith("/admin/venue/waiters");

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const pathname = usePathname();
	const router = useRouter();

	if (!isTabbedRoute(pathname)) {
		return (
			<DefautLayout titleKey={"admin:layout.title.venue"}>
				{props.children}
			</DefautLayout>
		);
	}

	const activeTab = resolveActiveTab(pathname);

	return (
		<DefautLayout titleKey={"admin:layout.title.venue"}>
			<SubNavShellRoot
				tabsLabel={t("invoices:page.tabsSections")}
				tabs={venueTabs}
				activeTab={activeTab}
				onTabChange={(tab) => router.replace(resolvePath(tab) as Route)}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
