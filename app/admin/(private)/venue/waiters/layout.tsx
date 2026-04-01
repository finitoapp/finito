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
			title={t("navigation:main.links.waiters")}
			description={t("waiters:table.listOfYourWaiters")}
			actions={
				<Link href={"/admin/venue/waiters/new"}>
					<Button>
						<PlusIcon />
						{t("waiters:table.actions.new-waiter")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
