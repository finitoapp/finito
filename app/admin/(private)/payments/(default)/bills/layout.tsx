"use client";

import { useTranslation } from "react-i18next";
import { SubNavShellContent } from "@/components/sub-nav-shell";

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<SubNavShellContent
			title={t("navigation:main.links.bills")}
			description={t("bills:table.description.listOfBills")}
		>
			{props.children}
		</SubNavShellContent>
	);
}
