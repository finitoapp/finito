"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ContactForm } from "@/app/(client)/contacts/contact-form";
import { FadeHeader } from "@/components/fade-header";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("contacts:page.newContact")} />

			<div className={"w-full px-8"}>
				<ContactForm
					onSuccess={() => {
						router.back();
					}}
				/>
			</div>
		</div>
	);
}
