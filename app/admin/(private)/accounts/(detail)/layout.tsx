"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import { EditIcon, InfoIcon, MenuIcon, Trash2Icon } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { useEvolu } from "@/hooks/use-evolu";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { useGlobalDialog } from "@/hooks/use-global-dialog";
import { createGetAccountQuery } from "@/lib/evolu/queries/account";

const detailTabs = [
	{
		value: "detail",
		labelKey: "accounts:detail.tabs.detail",
		icon: InfoIcon,
		nextUrl: "/admin/accounts/detail",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");

	if (id === null) {
		throw Promise.reject();
	}

	const accountQuery = useMemo(
		() =>
			createGetAccountQuery({
				id: id as Id,
			}),
		[id],
	);
	const { data: items } = useEvoluQuery(accountQuery);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/accounts");
		}
	}, [item, router]);

	const { mutateAsync: deleteItem } = useMutation({
		mutationFn: async () => {
			if (item === undefined) {
				return;
			}

			evolu.update("account", { id: item.id, isDeleted: sqliteTrue });
			router.push("/admin/accounts");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteItem();
		},
		{
			title: t("accounts:detail.deleteDialog.title"),
			description: t("accounts:detail.deleteDialog.description"),
			confirmText: t("accounts:detail.deleteDialog.confirm"),
			cancelText: t("accounts:detail.deleteDialog.cancel"),
			confirmVariant: "destructive",
		},
	);

	if (item === undefined) {
		return null;
	}

	return (
		<SubNavShellRoot
			sidebarTop={<BackButton fallbackHref={"/admin/accounts" as Route} />}
			tabsLabel={t("accounts:detail.tabs.sections")}
			tabs={detailTabs}
		>
			<SubNavShellContent
				title={item.name}
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
									router.push(
										`/admin/accounts/edit?id=${encodeURIComponent(id)}` as Route,
									);
								}}
							>
								<EditIcon />
								{t("accounts:detail.actions.edit")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => void onDelete()}
							>
								<Trash2Icon />
								{t("accounts:detail.actions.delete")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				}
			>
				{props.children}
			</SubNavShellContent>
		</SubNavShellRoot>
	);
}
