import { MailIcon, PhoneIcon, UserRoundIcon } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { VerticalNav } from "@/app/(client)/settings/vertial-nav";
import { Input } from "@/components/ui/input";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";
import type { Id } from "@/lib/evolu/types";

const contactsQuery = createGetContactsQuery();

export const ContactList: React.FC<{
	onClick?: (props: { contactId: Id }) => unknown;
}> = (props) => {
	const { t } = useTranslation();
	const { data: contacts } = useEvoluQuery(contactsQuery);
	const [filter, setFilter] = useState("");

	const sortedContacts = useMemo(
		() =>
			[...contacts].sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			),
		[contacts],
	);

	const filteredContacts = useMemo(() => {
		const normalizedFilter = filter.trim().toLocaleLowerCase();

		if (normalizedFilter === "") {
			return sortedContacts;
		}

		return sortedContacts.filter((contact) => {
			const matchesName = contact.name
				.toLocaleLowerCase()
				.includes(normalizedFilter);
			const matchesLabel =
				contact.label?.toLocaleLowerCase().includes(normalizedFilter) ?? false;

			return matchesName || matchesLabel;
		});
	}, [filter, sortedContacts]);

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
			: filteredContacts.length === 0
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
										{t("client:contactsPage.filteredEmpty.title")}
									</h2>
									<p className="text-balance text-sm text-muted-foreground">
										{t("client:contactsPage.filteredEmpty.description")}
									</p>
								</div>
							),
						},
					]
				: filteredContacts.map((contact) => ({
						disableAction: true,
						onClick: () => props.onClick?.({ contactId: contact.id }),
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
									className={
										"flex flex-col gap-1 text-xs text-muted-foreground"
									}
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
		<div className={"space-y-8"}>
			<Input
				type="search"
				value={filter}
				onChange={(event) => setFilter(event.target.value)}
				placeholder={t("contacts:table.search.placeholder.by-name-or-label")}
			/>

			<VerticalNav
				title={t("contacts:table.listOfYourContacts")}
				items={navItems}
			/>
		</div>
	);
};
