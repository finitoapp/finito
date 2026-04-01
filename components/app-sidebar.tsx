"use client";

import {
	IconAiAgent,
	IconBug,
	IconBuildingBank,
	IconCalendarEvent,
	IconCashRegister,
	IconDashboard,
	IconInvoice,
	IconListDetails,
	IconPackage,
	IconPicnicTable,
	IconSettings,
	IconUserCircle,
	IconUsers,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import Link from "next/link";
import type { ComponentProps } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { FinitoLogo } from "@/components/finito-logo";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

const user = {
	name: "shadcn",
	email: "m@example.com",
	avatar: "/avatars/shadcn.jpg",
};

const createNavigationData = (t: TFunction) =>
	({
		navMain: [
			{
				title: t("navigation:main.links.dashboard"),
				url: "/admin",
				icon: IconDashboard,
			},
			{
				title: t("navigation:main.links.payments"),
				url: "/admin/payments",
				icon: IconListDetails,
			},
			{
				title: t("navigation:main.links.pointOfSale"),
				url: "/admin/pos",
				icon: IconCashRegister,
			},
			{
				title: t("navigation:main.links.invoices"),
				url: "/admin/invoices",
				icon: IconInvoice,
			},
			{
				title: t("navigation:main.links.catalog"),
				url: "/admin/catalog",
				icon: IconPackage,
			},
			{
				title: t("navigation:main.links.menus"),
				url: "/admin/menus" as never,
				icon: IconPackage,
			},
			{
				title: t("navigation:main.links.venue"),
				url: "/admin/venue/tables",
				icon: IconPicnicTable,
			},
			{
				title: t("navigation:main.links.reservations"),
				url: "/admin/reservations",
				icon: IconCalendarEvent,
			},
			{
				title: t("navigation:main.links.contacts"),
				url: "/admin/contacts" as never,
				icon: IconUsers,
			},
			{
				title: t("navigation:main.links.moneyAccounts"),
				url: "/admin/accounts",
				icon: IconBuildingBank,
			},
			{
				title: t("navigation:main.links.aiAssistant"),
				url: "/admin/ai-assistant",
				icon: IconAiAgent,
			},
		],
		navSecondary: [
			{
				title: t("navigation:main.settings"),
				url: "/admin/settings",
				icon: IconSettings,
			},
			{
				title: t("navigation:settings.links.debug"),
				url: "/admin/debug",
				icon: IconBug,
			},
			{
				title: t("settings:page.switchAccount"),
				url: "/admin/switch-account",
				icon: IconUserCircle,
			},
		],
	}) satisfies {
		navMain: ComponentProps<typeof NavMain>["items"];
		navSecondary: ComponentProps<typeof NavSecondary>["items"];
	};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { t } = useTranslation();
	const { setOpenMobile } = useSidebar();
	const data = React.useMemo(() => createNavigationData(t), [t]);

	// Close sidebar on page change
	React.useEffect(() => {
		setOpenMobile(false);
	}, [setOpenMobile]);

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader className={"safe-area-t"}>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={<Link href={"/admin"} />}
							className="data-[slot=sidebar-menu-button]:!p-1.5"
						>
							<FinitoLogo />
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent className={"pt-4"}>
				<NavMain items={data.navMain} />
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter className={"safe-area-b"}>
				<NavUser user={user} />
			</SidebarFooter>
		</Sidebar>
	);
}
