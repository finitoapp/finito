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
			title={t("navigation:main.links.tables")}
			description={t("tables:table.listOfYourTables")}
			actions={
				<Link href={"/admin/venue/tables/new"}>
					<Button>
						<PlusIcon />
						{t("tables:table.actions.new-table")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
