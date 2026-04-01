"use client";

import { useMutation } from "@tanstack/react-query";
import {
	CheckIcon,
	CopyIcon,
	InfoIcon,
	Link2Icon,
	MenuIcon,
	Trash2Icon,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { useGlobalDialog } from "@/hooks/use-global-dialog";

type DetailTab = "overview" | "reconciliation";

const detailTabs = [
	{
		value: "overview",
		labelKey: "payments:detail.sections.overview",
		icon: InfoIcon,
	},
	{
		value: "reconciliation",
		labelKey: "payments:detail.sections.reconciliation",
		icon: Link2Icon,
	},
] as const;

const resolveActiveTab = (pathname: string): DetailTab => {
	if (pathname.endsWith("/reconciliation")) {
		return "reconciliation";
	}

	return "overview";
};

const resolvePath = (tab: DetailTab) => {
	if (tab === "overview") {
		return "/admin/payments/detail";
	}

	return `/admin/payments/detail/${tab}`;
};

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();
	const { copy, copied } = useClipboard();
	const { withConfirm } = useGlobalDialog();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	const router = useRouter();
	const activeTab = resolveActiveTab(pathname);

	const { mutateAsync: deletePayment } = useMutation({
		mutationFn: async () => {
			// @TODO
			router.push("/admin/payments");
		},
	});

	const onDelete = withConfirm(
		async () => {
			await deletePayment();
		},
		{
			title: t("payments:detail.confirm.delete-payment.title"),
			description: t("payments:detail.confirm.delete-payment.description"),
			confirmText: t("payments:detail.actions.delete"),
			cancelText: t("payments:detail.actions.cancel"),
			confirmVariant: "destructive",
		},
	);

	if (id === null) {
		throw Promise.reject();
	}

	const navigateToTab = (tab: DetailTab) => {
		const query = new URLSearchParams(searchParams.toString());
		const path = resolvePath(tab);
		const queryString = query.toString();
		const href = queryString ? `${path}?${queryString}` : path;
		router.replace(href as Route);
	};

	return (
		<DefautLayout titleKey={"admin:layout.title.payments"}>
			<SubNavShellRoot
				tabsLabel={t("payments:detail.sections.sections")}
				sidebarTop={<BackButton />}
				tabs={detailTabs}
				activeTab={activeTab}
				onTabChange={navigateToTab}
			>
				<SubNavShellContent
					title={id}
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
										void copy(id);
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
