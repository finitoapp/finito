"use client";

import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { NotificationCenter } from "@/components/notification-center";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader(props: { title?: string; titleKey?: string }) {
	const { t } = useTranslation();

	return (
		<header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				{(props.title || props.titleKey) && (
					<h1 className="text-base font-medium">
						{props.titleKey ? t(props.titleKey) : props.title}
					</h1>
				)}
				<div className="ml-auto flex items-center gap-4">
					<LanguageToggle />
					<ModeToggle />
					<NotificationCenter />
				</div>
			</div>
		</header>
	);
}
