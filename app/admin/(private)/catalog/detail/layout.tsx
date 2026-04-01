"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import {
	BarChart3Icon,
	BoxIcon,
	CheckIcon,
	CopyIcon,
	HistoryIcon,
	InfoIcon,
	MenuIcon,
	Trash2Icon,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClipboard } from "@/hooks/use-clipboard";
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createItemDetailQuery } from "./item-detail-query";

type DetailTab = "detail" | "inventory" | "history" | "analytics";

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
	{
		value: "analytics",
		labelKey: "items:detail.tabs.analytics",
		icon: BarChart3Icon,
	},
] as const;

const resolveActiveTab = (pathname: string): DetailTab => {
	if (pathname.endsWith("/inventory")) {
		return "inventory";
	}

	if (pathname.endsWith("/history")) {
		return "history";
	}

	if (pathname.endsWith("/analytics")) {
		return "analytics";
	}

	return "detail";
};

const resolvePath = (tab: DetailTab) =>
	tab === "detail" ? "/admin/catalog/detail" : `/admin/catalog/detail/${tab}`;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const { copy, copied } = useClipboard();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");

	if (id === null) {
		throw Promise.reject();
	}

	const activeTab = resolveActiveTab(pathname);
	const itemDetailQuery = useMemo(() => createItemDetailQuery(id as Id), [id]);
	const { data: items } = useEvoluQuery(itemDetailQuery);
	const item = items[0];

	const navigateToTab = (tab: DetailTab) => {
		const query = new URLSearchParams(searchParams.toString());
		const path = resolvePath(tab);
		const queryString = query.toString();
		const href = queryString ? `${path}?${queryString}` : path;
		router.replace(href as Route);
	};

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("item", {
				id: item.id,
				isDeleted: sqliteTrue,
			});

			router.push("/admin/catalog");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: t("items:detail.deleteDialog.title"),
			description: t("items:detail.deleteDialog.description"),
			confirmText: t("items:detail.actions.delete"),
			cancelText: t("items:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/catalog");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<DefautLayout titleKey={"admin:layout.title.items"}>
			<SubNavShellRoot
				sidebarTop={<BackButton />}
				tabsLabel={t("items:detail.tabs.sections")}
				tabs={detailTabs}
				activeTab={activeTab}
				onTabChange={navigateToTab}
			>
				<SubNavShellContent
					title={item.label}
					actions={
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="outline"
										size="icon"
										aria-label={t("common:table.actions")}
									/>
								}
							>
								<MenuIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuItem
									onClick={() => {
										void copy(item.id);
									}}
								>
									{copied ? <CheckIcon /> : <CopyIcon />}
									{t("items:detail.actions.copyRecordId")}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onClick={() => void onDelete()}
								>
									<Trash2Icon />
									{t("items:detail.actions.delete")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					}
				>
					{props.children}
				</SubNavShellContent>
			</SubNavShellRoot>
		</DefautLayout>
	);
}
