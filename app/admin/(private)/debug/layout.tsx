"use client";

import {
	HardDriveDownloadIcon,
	HistoryIcon,
	InfoIcon,
	RefreshCcwIcon,
} from "lucide-react";
import type { Route } from "next";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import {
	type DetailShellTab,
	SubNavShellRoot,
} from "@/components/sub-nav-shell";
import { useNostr } from "@/hooks/use-nostr";

type DebugTab = "application" | "storage" | "generator" | "nostr";

const debugTabs = [
	{
		value: "application",
		labelKey: "admin:dashboard.applicationInformation",
		icon: InfoIcon,
		nextUrl: "/admin/debug" as Route,
	},
	{
		value: "storage",
		labelKey: "admin:dashboard.storageData",
		icon: HardDriveDownloadIcon,
		nextUrl: "/admin/debug/storage" as Route,
	},
	{
		value: "generator",
		labelKey: "admin:dashboard.randomDataGenerator",
		icon: RefreshCcwIcon,
		nextUrl: "/admin/debug/generator" as Route,
	},
] satisfies readonly DetailShellTab<DebugTab>[];

const nostrTab = {
	value: "nostr",
	labelKey: "admin:dashboard.nostrRelays",
	icon: HistoryIcon,
	nextUrl: "/admin/debug/nostr" as Route,
} satisfies DetailShellTab<DebugTab>;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const { ndk } = useNostr();
	const tabs: readonly DetailShellTab<DebugTab>[] = ndk.cacheAdapter
		? [...debugTabs, nostrTab]
		: debugTabs;

	return (
		<DefautLayout titleKey={"admin:layout.title.debug"}>
			<SubNavShellRoot tabsLabel={t("items:detail.tabs.sections")} tabs={tabs}>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
