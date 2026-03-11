"use client";

import type { Icon } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavSecondary({
	items,
	...props
}: {
	items: {
		title: string;
		url: Route;
		icon: Icon;
	}[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	const { t } = useTranslation();
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarGroupLabel>{t("navigation:main.settings")}</SidebarGroupLabel>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								render={
									<Link href={item.url} onClick={() => setOpenMobile(false)} />
								}
								isActive={pathname.startsWith(item.url)}
								tooltip={item.title}
							>
								<item.icon />
								{item.title}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
