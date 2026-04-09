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
			title={t("accounts:table.accounts")}
			description={t("accounts:table.description.list-of-your-accounts")}
			actions={
				<Link href={"/admin/accounts/new"}>
					<Button>
						<PlusIcon />
						{t("accounts:table.actions.new-account")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
