"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ContactList } from "@/components/contact-list";
import { FadeHeader } from "@/components/fade-header";
import { Button } from "@/components/ui/button";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.contacts")} />

			<ContactList
				onClick={({ contactId }) => {
					router.push(`/contacts/edit?id=${encodeURIComponent(contactId)}`);
				}}
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
