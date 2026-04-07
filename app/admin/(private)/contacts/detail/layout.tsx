"use client";

import type { Id } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import { useMutation } from "@tanstack/react-query";
import {
	EditIcon,
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
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";

type DetailTab = "detail" | "history";

const detailTabs = [
	{
		value: "detail",
		labelKey: "contacts:detail.tabs.detail",
		icon: InfoIcon,
	},
	{
		value: "history",
		labelKey: "contacts:detail.tabs.history",
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
		return "/admin/contacts/detail";
	}

	return "/admin/contacts/detail/history";
};

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const evolu = useEvolu();
	const { withConfirm } = useGlobalDialog();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");

	if (id === null) {
		throw Promise.reject();
	}

	const activeTab = resolveActiveTab(pathname);
	const contactQuery = useMemo(
		() => createGetContactsQuery({ id: id as Id }),
		[id],
	);
	const { data: contacts } = useEvoluQuery(contactQuery);
	const contact = contacts[0];

	useEffect(() => {
		if (contact === undefined) {
			router.replace("/admin/contacts");
		}
	}, [contact, router]);

	const { mutateAsync: deleteContact } = useMutation({
		mutationFn: async () => {
			if (contact === undefined) {
				return;
			}

			evolu.update("contact", { id: contact.id, isDeleted: sqliteTrue });
			router.push("/admin/contacts");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deleteContact();
		},
		{
			title: t("contacts:detail.deleteDialog.title"),
			description: t("contacts:detail.deleteDialog.description"),
			confirmText: t("contacts:detail.deleteDialog.confirm"),
			cancelText: t("contacts:detail.deleteDialog.cancel"),
			confirmVariant: "destructive",
		},
	);

	const navigateToTab = (tab: DetailTab) => {
		const query = new URLSearchParams(searchParams.toString());
		const path = resolvePath(tab);
		const queryString = query.toString();
		const href = queryString ? `${path}?${queryString}` : path;
		router.replace(href as Route);
	};

	if (contact === undefined) {
		return null;
	}

	const contactTitle =
		contact.label && contact.label.trim() !== "" ? contact.label : contact.name;

	return (
		<SubNavShellRoot
			sidebarTop={<BackButton fallbackHref={"/admin/contacts" as never} />}
			tabsLabel={t("contacts:detail.tabs.sections")}
			tabs={detailTabs}
			activeTab={activeTab}
			onTabChange={navigateToTab}
		>
			<SubNavShellContent
				title={contactTitle}
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
										`/admin/contacts/edit?id=${encodeURIComponent(id)}` as Route,
									);
								}}
							>
								<EditIcon />
								{t("contacts:detail.actions.edit")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() => void onDelete()}
							>
								<Trash2Icon />
								{t("contacts:detail.actions.delete")}
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
