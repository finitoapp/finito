"use client";

import { MailIcon, PhoneIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";

const contactsQuery = createGetContactsQuery();

export default function Page() {
	const { t } = useTranslation();
	const { data: contacts } = useEvoluQuery(contactsQuery);

	const sortedContacts = useMemo(
		() =>
			[...contacts].sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			),
		[contacts],
	);

	const navItems =
		sortedContacts.length === 0
			? [
					{
						disableAction: true,
						label: (
							<div
								className={
									"flex flex-col justify-center items-center gap-4 py-10 text-center"
								}
							>
								<UserRoundIcon className="h-10 w-10 text-muted-foreground" />
								<h2 className={"text-foreground text-lg"}>
									{t("client:contactsPage.empty.title")}
								</h2>
								<p className="text-balance text-sm text-muted-foreground">
									{t("client:contactsPage.empty.description")}
								</p>
							</div>
						),
					},
				]
			: sortedContacts.map((contact) => ({
					disableAction: true,
					icon: (
						<div className={"p-2"}>
							<UserRoundIcon className="h-5 w-5 text-primary" />
						</div>
					),
					label: (
						<div className={"flex min-w-0 flex-col gap-1"}>
							<div className={"truncate font-semibold"}>
								{contact.label ?? contact.name}
							</div>
							<div
								className={"flex flex-col gap-1 text-xs text-muted-foreground"}
							>
								{contact.phone && (
									<div className={"flex items-center gap-2"}>
										<PhoneIcon className="h-3.5 w-3.5" />
										<span className={"truncate"}>{contact.phone}</span>
									</div>
								)}
								{contact.email && (
									<div className={"flex items-center gap-2"}>
										<MailIcon className="h-3.5 w-3.5" />
										<span className={"truncate"}>{contact.email}</span>
									</div>
								)}
							</div>
						</div>
					),
				}));

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.contacts")} />

			<VerticalNav
				title={t("contacts:table.listOfYourContacts")}
				items={navItems}
			/>

			<Link href={"/contacts/new" as never}>
				<Button
					size="icon"
					className="fixed right-8 bottom-8 z-50 size-18 rounded-full shadow-lg"
					aria-label={t("contacts:page.newContact")}
				>
					<PlusIcon className={"size-6"} strokeWidth={3} />
				</Button>
			</Link>
		</div>
	);
}
