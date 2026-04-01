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
			title={t("navigation:main.links.transactions")}
			description={t("transactions:table.description.list-of-transactions")}
			actions={
				<Link href={"/admin/payments/transactions/new"}>
					<Button>
						<PlusIcon />
						{t("transactions:table.actions.new-transaction")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
