"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClientForm } from "@/app/admin/(private)/clients/client-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetClientsQuery } from "@/lib/evolu/queries/client";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useMemo(() => createGetClientsQuery({ id: id as Id }), [id]);

	const { data: items } = useEvoluQuery(query);

	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/clients");
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
					<CardTitle>{t("clients:page.editClient")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ClientForm
						defaultValues={{
							...item,
							label: item.label ?? "",
							email: item.email ?? "",
							address: {
								...item.address,
								street: item.address.street ?? "",
								city: item.address.city ?? "",
								postalCode: item.address.postalCode ?? "",
								descriptiveNumber: item.address.descriptiveNumber ?? "",
							},
							cz: item.cz
								? {
										...item.cz,
										vatNumber: item.cz.vatNumber ?? "",
										identificationNumber: item.cz.identificationNumber ?? "",
										caseNumber: item.cz.caseNumber ?? "",
									}
								: undefined,
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
