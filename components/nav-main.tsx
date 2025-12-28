"use client";

import type { Icon } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavMain({
	items,
}: {
	items: {
		title: string;
		url: Route;
		icon?: Icon;
	}[];
}) {
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								asChild
								isActive={
									item.url === pathname ||
									(item.url !== "/admin" && pathname.startsWith(item.url))
								}
								tooltip={item.title}
							>
								<Link href={item.url} onClick={() => setOpenMobile(false)}>
									{item.icon && <item.icon />}
									{item.title}
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
