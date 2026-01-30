"use client";

import {
	IconBug,
	IconBuildingBank,
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
import Link from "next/link";
import type { ComponentProps } from "react";
import * as React from "react";
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

const data = {
	navMain: [
		{
			title: "Dashboard",
			url: "/admin",
			icon: IconDashboard,
		},
		{
			title: "Payments",
			url: "/admin/payments",
			icon: IconListDetails,
		},
		{
			title: "Point of Sale",
			url: "/admin/pos",
			icon: IconCashRegister,
		},
		{
			title: "Invoices",
			url: "/admin/invoices",
			icon: IconInvoice,
		},
		{
			title: "Items",
			url: "/admin/items",
			icon: IconPackage,
		},
		{
			title: "Categories",
			url: "/admin/categories" as never,
			icon: IconPackage,
		},
		{
			title: "Tables",
			url: "/admin/tables",
			icon: IconPicnicTable,
		},
		{
			title: "Clients",
			url: "/admin/clients",
			icon: IconUsers,
		},
		{
			title: "Money Accounts",
			url: "/admin/accounts",
			icon: IconBuildingBank,
		},
	],
	navSecondary: [
		{
			title: "Billing information",
			url: "/admin/settings/billing-info",
			icon: IconSettings,
		},
		{
			title: "Billing settings",
			url: "/admin/settings/billing-settings",
			icon: IconSettings,
		},
		{
			title: "Invoice number series",
			url: "/admin/settings/invoice-number-series",
			icon: IconSettings,
		},
		{
			title: "Account",
			url: "/admin/settings/account",
			icon: IconUserCircle,
		},
		{
			title: "Fio plugin",
			url: "/admin/settings/fio-plugin",
			icon: IconCashBanknote,
		},
		{
			title: "Email plugin",
			url: "/admin/settings/smtp",
			icon: IconMail,
		},
		{
			title: "Credentials",
			url: "/admin/settings/credentials",
			icon: IconKey,
		},
		{
			title: "Debug",
			url: "/admin/debug",
			icon: IconBug,
		},
	],
} satisfies {
	navMain: ComponentProps<typeof NavMain>["items"];
	navSecondary: ComponentProps<typeof NavSecondary>["items"];
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { setOpenMobile } = useSidebar();

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
