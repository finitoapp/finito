"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	ContactForm,
	mapContactToFormContact,
} from "@/app/admin/(private)/contacts/contact-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetContactsQuery } from "@/lib/evolu/queries/contact";

export default function Home() {
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
			router.replace("/admin/contacts");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className={"max-w-xl w-full"}>
			<div className={"mb-6"}>
				<BackButton />
			</div>

			<ResponsiveCard>
				<CardHeader>
					<CardTitle>{t("contacts:page.editContact")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ContactForm
						defaultValues={mapContactToFormContact(item)}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
