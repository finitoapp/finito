"use client";

import { BoxIcon, HistoryIcon, InfoIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/shared/ui/cn";

type DetailTab = "detail" | "inventory" | "history";

const detailTabs = [
	{
		value: "detail",
		labelKey: "items:detail.tabs.detail",
		icon: InfoIcon,
	},
	{
		value: "inventory",
		labelKey: "items:detail.tabs.inventory",
		icon: BoxIcon,
	},
	{
		value: "history",
		labelKey: "items:detail.tabs.history",
		icon: HistoryIcon,
	},
] as const;

const resolveActiveTab = (pathname: string): DetailTab => {
	if (pathname.endsWith("/inventory")) {
		return "inventory";
	}

	if (pathname.endsWith("/history")) {
		return "history";
	}

	return "detail";
};

const resolvePath = (tab: DetailTab) =>
	tab === "detail" ? "/admin/items/detail" : `/admin/items/detail/${tab}`;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const activeTab = resolveActiveTab(pathname);

	const navigateToTab = (tab: DetailTab) => {
		const query = new URLSearchParams(searchParams.toString());
		const path = resolvePath(tab);
		const queryString = query.toString();
		const href = queryString ? `${path}?${queryString}` : path;
		router.replace(href as Route);
	};

	return (
		<div className="flex w-full flex-col gap-1 xl:flex-row">
			<aside className="w-full flex flex-col gap-1 px-2 py-4 xl:sticky xl:top-6 xl:w-64 xl:shrink-0">
				<div className="mb-4 px-2">
					<BackButton />
				</div>
				<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
					{t("items:detail.tabs.sections")}
				</p>
				<div className="flex gap-1 overflow-x-auto p-1 xl:flex-col xl:overflow-visible">
					{detailTabs.map((tab) => (
						<button
							key={tab.value}
							type="button"
							value={tab.value}
							className={cn(
								"flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm ring-ring transition-all whitespace-nowrap focus-visible:ring-2 xl:w-full",
								activeTab === tab.value
									? "bg-accent text-accent-foreground font-medium"
									: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
							)}
							onClick={() => navigateToTab(tab.value)}
						>
							<tab.icon className="size-4 shrink-0" />
							{t(tab.labelKey)}
						</button>
					))}
				</div>
			</aside>

			<div className="min-w-0 flex-1 [&>*]:w-full [&>*]:max-w-7xl">
				{props.children}
			</div>
		</div>
	);
}
