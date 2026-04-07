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
			title={t("navigation:main.links.contacts")}
			description={t("contacts:table.listOfYourContacts")}
			actions={
				<Link href={"/admin/contacts/new"}>
					<Button>
						<PlusIcon />
						{t("contacts:table.actions.new-contact")}
					</Button>
				</Link>
			}
		>
			{props.children}
		</SubNavShellContent>
	);
}
