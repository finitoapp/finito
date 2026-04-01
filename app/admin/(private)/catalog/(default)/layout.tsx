"use client";

import { FolderTreeIcon, PackageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const catalogTabs = [
	{
		value: "items",
		labelKey: "navigation:main.links.items",
		icon: PackageIcon,
		nextUrl: "/admin/catalog",
	},
	{
		value: "categories",
		labelKey: "navigation:main.links.categories",
		icon: FolderTreeIcon,
		nextUrl: "/admin/catalog/categories",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<DefautLayout titleKey={"admin:layout.title.catalog"}>
			<SubNavShellRoot
				tabsLabel={t("items:detail.tabs.sections")}
				tabs={catalogTabs}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
