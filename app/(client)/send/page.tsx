"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ContactList } from "@/components/contact-list";
import { FadeHeader } from "@/components/fade-header";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("client:page.sendPayment")} />

			<ContactList
				onClick={({ contactId }) => {
					router.push(`/send/step-2?id=${encodeURIComponent(contactId)}`);
				}}
			/>
		</div>
	);
}
