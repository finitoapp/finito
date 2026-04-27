"use client";

import {
	IconCashBanknote,
	IconInvoice,
	IconListDetails,
	IconSettings,
} from "@tabler/icons-react";
import { HashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DefautLayout } from "@/app/admin/defaut-layout";
import { SubNavShellRoot } from "@/components/sub-nav-shell";

const paymentsTabs = [
	{
		value: "payments",
		labelKey: "navigation:main.links.payments",
		icon: IconCashBanknote,
		nextUrl: "/admin/payments",
	},
	{
		value: "transactions",
		labelKey: "navigation:main.links.transactions",
		icon: IconListDetails,
		nextUrl: "/admin/payments/transactions",
	},
	{
		value: "bills",
		labelKey: "navigation:main.links.bills",
		icon: IconInvoice,
		nextUrl: "/admin/payments/bills" as never,
	},
	{
		value: "receiptNumberSeries",
		labelKey: "settings:page.receiptNumberSeries",
		icon: HashIcon,
		nextUrl: "/admin/payments/receipt-number-series" as never,
	},
	{
		value: "settings",
		labelKey: "navigation:main.settings",
		icon: IconSettings,
		nextUrl: "/admin/payments/settings" as never,
	},
] as const;

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<DefautLayout titleKey={"admin:layout.title.payments"}>
			<SubNavShellRoot
				tabsLabel={t("invoices:page.tabsSections")}
				tabs={paymentsTabs}
			>
				{props.children}
			</SubNavShellRoot>
		</DefautLayout>
	);
}
