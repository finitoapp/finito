"use client";

import { FileTextIcon, HashIcon, MailIcon, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const invoicesTabs = [
	{
		value: "invoices",
		labelKey: "invoices:table.invoices",
		icon: FileTextIcon,
		nextUrl: "/admin/invoices",
	},
	{
		value: "numberSeries",
		labelKey: "settings:page.invoiceNumberSeries",
		icon: HashIcon,
		nextUrl: "/admin/invoices/number-series",
	},
	{
		value: "settings",
		labelKey: "settings:page.settings",
		icon: SettingsIcon,
		nextUrl: "/admin/invoices/settings",
	},
	{
		value: "mailSettings",
		labelKey: "settings:form.billing-settings-form.title.invoice-email",
		icon: MailIcon,
		nextUrl: "/admin/invoices/mail-settings",
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<DefautLayout titleKey={"admin:layout.title.invoices"}>
			<SubNavShellRoot
				tabsLabel={t("invoices:page.tabsSections")}
				tabs={invoicesTabs}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
