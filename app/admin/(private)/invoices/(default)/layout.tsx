"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { SubNavShellContent } from "@/components/sub-nav-shell";
import { Button } from "@/components/ui/button";

export default function Layout(
	props: Readonly<{
		children: React.ReactNode;
	}>,
) {
	const { t } = useTranslation();

	return (
		<SubNavShellContent
			title={t("invoices:table.invoices")}
			description={t("invoices:table.listOfYourInvoices")}
			actions={
				<Link href={"/admin/invoices/new"}>
					<Button>
						<PlusIcon />
						{t("invoices:table.actions.new-invoice")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
