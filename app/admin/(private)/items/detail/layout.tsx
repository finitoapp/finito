"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import {
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
import { BackButton } from "@/components/back-button";
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
import { cn } from "@/lib/shared/ui/cn";
import { createItemDetailQuery } from "./item-detail-query";

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

			router.push("/admin/items");
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
			router.replace("/admin/items");
		}
	}, [item, router]);

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

			<div className="flex min-w-0 flex-1 flex-col gap-4">
				<div className="w-full max-w-7xl">
					<div className="flex flex-col gap-3 pl-4 sm:flex-row sm:items-center sm:justify-between">
						<h1 className="text-xl font-semibold tracking-tight">
							{item?.label ?? t("items:detail.header.productNamePlaceholder")}
						</h1>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="outline"
										size="icon-sm"
										disabled={item === undefined}
										aria-label={t("common:table.actions")}
									/>
								}
							>
								<MenuIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuItem
									onClick={() => {
										if (item !== undefined) {
											void copy(item.id);
										}
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
					</div>
				</div>

				<div className="min-w-0 flex-1 [&>*]:w-full [&>*]:max-w-7xl">
					{props.children}
				</div>
			</div>
		</div>
	);
}
