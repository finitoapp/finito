"use client";

import type { TFunction } from "i18next";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/shared/ui/cn";

type DetailShellTabIcon = ComponentType<{ className?: string }>;

type TKey = Parameters<TFunction>[0];

export type DetailShellTab<TValue extends string = string> = {
	value: TValue;
	icon: DetailShellTabIcon;
	nextUrl?: Route;
} & (
	| {
			labelKey: TKey;
			label?: undefined;
	  }
	| {
			label: ReactNode;
			labelKey?: undefined;
	  }
);

type DetailShellRootProps<TValue extends string> = Readonly<{
	sidebarTop?: ReactNode;
	tabsLabel: ReactNode;
	tabs: readonly DetailShellTab<TValue>[];
	activeTab?: TValue;
	onTabChange?: (tab: TValue) => void;
	children: ReactNode;
}>;

type DetailShellContentProps = Readonly<{
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
}>;

function SubNavShellRoot<TValue extends string>(
	props: DetailShellRootProps<TValue>,
) {
	const { t } = useTranslation();
	const router = useRouter();

	const pathname = usePathname();
	const activeTab = useMemo(() => {
		if (props.activeTab) {
			return props.activeTab;
		}

		const result = props.tabs.find((tab) => tab.nextUrl === pathname)?.value;
		if (result !== undefined) {
			return result;
		}

		return props.tabs.reduce<TValue | undefined>((longestMatch, tab) => {
			if (!tab.nextUrl || !pathname.startsWith(tab.nextUrl)) {
				return longestMatch;
			}
			if (!longestMatch || tab.nextUrl.length > longestMatch.length) {
				return tab.value;
			}
			return longestMatch;
		}, undefined);
	}, [pathname, props.tabs, props.activeTab]);

	return (
		<div className="flex w-full flex-col gap-1 xl:flex-row">
			<aside className="w-full flex flex-col gap-1 px-2 py-4 xl:sticky xl:top-6 xl:w-64 xl:shrink-0">
				{props.sidebarTop ? (
					<div className="mb-4 px-2">{props.sidebarTop}</div>
				) : null}
				<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
					{props.tabsLabel}
				</p>
				<div className="flex gap-1 overflow-x-auto p-1 xl:flex-col xl:overflow-visible">
					{props.tabs.map((tab) => {
						const Icon = tab.icon;

						return (
							<button
								key={tab.value}
								type="button"
								value={tab.value}
								className={cn(
									"flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm ring-ring transition-all whitespace-nowrap focus-visible:ring-2 xl:w-full font-medium",
									activeTab === tab.value
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
								)}
								onClick={() => {
									if (tab.nextUrl) {
										router.push(tab.nextUrl);
									}

									props.onTabChange?.(tab.value);
								}}
							>
								<Icon className="size-4 shrink-0" />
								{tab.labelKey ? t(tab.labelKey) : tab.label}
							</button>
						);
					})}
				</div>
			</aside>

			{props.children}
		</div>
	);
}

function SubNavShellContent(props: DetailShellContentProps) {
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-4">
			<div className="w-full max-w-7xl">
				<div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
					<div className={"flex flex-col gap-2"}>
						<h1 className="text-xl font-semibold tracking-tight">
							{props.title}
						</h1>
						{props.description && (
							<div className={"text-muted-foreground text-sm"}>
								{props.description}
							</div>
						)}
					</div>
					{props.actions}
				</div>
			</div>

			<div className="min-w-0 flex-1 [&>*]:w-full [&>*]:max-w-7xl">
				{props.children}
			</div>
		</div>
	);
}

export { SubNavShellContent, SubNavShellRoot };
