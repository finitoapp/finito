"use client";

import {
	IconBug,
	IconBuildingBank,
	IconCalendarEvent,
	IconCashBanknote,
	IconCashRegister,
	IconDashboard,
	IconInvoice,
	IconKey,
	IconListDetails,
	IconMail,
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
				title: t("navigation:main.links.transactions"),
				url: "/admin/transactions",
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
				title: t("navigation:main.links.items"),
				url: "/admin/items",
				icon: IconPackage,
			},
			{
				title: t("navigation:main.links.categories"),
				url: "/admin/categories" as never,
				icon: IconPackage,
			},
			{
				title: t("navigation:main.links.menus"),
				url: "/admin/menus" as never,
				icon: IconPackage,
			},
			{
				title: t("navigation:main.links.tables"),
				url: "/admin/tables",
				icon: IconPicnicTable,
			},
			{
				title: t("navigation:main.links.reservations"),
				url: "/admin/reservations",
				icon: IconCalendarEvent,
			},
			{
				title: t("navigation:main.links.clients"),
				url: "/admin/clients",
				icon: IconUsers,
			},
			{
				title: t("navigation:main.links.moneyAccounts"),
				url: "/admin/accounts",
				icon: IconBuildingBank,
			},
		],
		navSecondary: [
			{
				title: t("navigation:settings.links.billingInformation"),
				url: "/admin/settings/billing-info",
				icon: IconSettings,
			},
			{
				title: t("navigation:settings.links.billingSettings"),
				url: "/admin/settings/billing-settings",
				icon: IconSettings,
			},
			{
				title: t("navigation:settings.links.invoiceNumberSeries"),
				url: "/admin/settings/invoice-number-series",
				icon: IconSettings,
			},
			{
				title: t("navigation:settings.links.account"),
				url: "/admin/settings/account",
				icon: IconUserCircle,
			},
			{
				title: t("navigation:settings.links.fioPlugin"),
				url: "/admin/settings/fio-plugin",
				icon: IconCashBanknote,
			},
			{
				title: t("navigation:settings.links.emailPlugin"),
				url: "/admin/settings/smtp",
				icon: IconMail,
			},
			{
				title: t("navigation:settings.links.credentials"),
				url: "/admin/settings/credentials",
				icon: IconKey,
			},
			{
				title: t("navigation:settings.links.debug"),
				url: "/admin/debug",
				icon: IconBug,
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
							asChild
							className="data-[slot=sidebar-menu-button]:!p-1.5"
						>
							<Link href={"/admin"}>
								<FinitoLogo />
							</Link>
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
