"use client";

import type { Id } from "@evolu/common";
import { HistoryIcon, InfoIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { BackButton } from "@/components/back-button";
import {
	SubNavShellContent,
	SubNavShellRoot,
} from "@/components/sub-nav-shell";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createBillDetailQuery } from "./bill-detail-query";

type DetailTab = "detail" | "history";

const detailTabs = [
	{
		value: "detail",
		labelKey: "bills:detail.tabs.detail",
		icon: InfoIcon,
	},
	{
		value: "history",
		labelKey: "bills:detail.tabs.history",
		icon: HistoryIcon,
	},
] as const;

const resolveActiveTab = (pathname: string): DetailTab => {
	if (pathname.endsWith("/history")) {
		return "history";
	}

	return "detail";
};

const resolvePath = (tab: DetailTab) => {
	if (tab === "detail") {
		return "/admin/payments/bills/detail";
	}

	return "/admin/payments/bills/history";
};

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const activeTab = resolveActiveTab(pathname);

	if (id === null) {
		throw Promise.reject();
	}

	const billDetailQuery = useMemo(() => createBillDetailQuery(id as Id), [id]);
	const { data: bills } = useEvoluQuery(billDetailQuery);
	const bill = bills[0];

	useEffect(() => {
		if (bill === undefined) {
			router.replace("/admin/payments/bills" as never);
		}
	}, [bill, router]);

	const navigateToTab = (tab: DetailTab) => {
		const query = new URLSearchParams(searchParams.toString());
		const path = resolvePath(tab);
		const queryString = query.toString();
		const href = queryString ? `${path}?${queryString}` : path;
		router.replace(href as Route);
	};

	if (bill === undefined) {
		return null;
	}

	const billTitle =
		bill.label && bill.label.trim() !== ""
			? `${bill.label} (#${bill.displayId})`
			: `#${bill.displayId}`;

	return (
		<DefautLayout titleKey={"admin:layout.title.bills"}>
			<SubNavShellRoot
				sidebarTop={
					<BackButton fallbackHref={"/admin/payments/bills" as never} />
				}
				tabsLabel={t("bills:detail.tabs.sections")}
				tabs={detailTabs}
				activeTab={activeTab}
				onTabChange={navigateToTab}
			>
				<SubNavShellContent title={billTitle}>
					{props.children}
				</SubNavShellContent>
			</SubNavShellRoot>
		</DefautLayout>
	);
}
