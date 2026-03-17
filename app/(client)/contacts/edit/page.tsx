"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ContactForm } from "@/app/(client)/contacts/contact-form";
import { FadeHeader } from "@/components/fade-header";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";
import type { Id } from "@/lib/evolu/types";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(() => createGetContactsQuery({ id: id as Id }), [id]);

	const { data: items } = useEvoluQuery(query);

	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/contacts");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className="space-y-8 w-full">
			<div className={"h-10"} />
			<FadeHeader title={t("contacts:page.editContact")} />

			<div className={"w-full px-8"}>
				<ContactForm
					defaultValues={{
						id: item.id,
						deviceId: item.deviceId,
						name: item.name,
						internalName: item.label ?? "",
						npub: item.nostr?.npub ?? "",
						lud16: item.account?.lud16?.lud16 ?? "",
					}}
					onSuccess={() => {
						router.back();
					}}
				/>
			</div>
		</div>
	);
}
