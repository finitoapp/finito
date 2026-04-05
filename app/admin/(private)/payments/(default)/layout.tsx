"use client";

import {
	IconCashBanknote,
	IconInvoice,
	IconListDetails,
} from "@tabler/icons-react";
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
