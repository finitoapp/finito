"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { BackButton } from "@/components/back-button";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetAccountQuery } from "@/lib/evolu/queries/account";
import type { Id } from "@/lib/evolu/types";

export default function Home() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const accountQuery = useMemo(
		() =>
			createGetAccountQuery({
				id: id as Id,
			}),
		[id],
	);

	const { data: items } = useEvoluQuery(accountQuery);
	const item = items[0];

	useEffect(() => {
		if (item === undefined) {
			router.replace("/admin/accounts");
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
					<CardTitle>{t("accounts:page.editAccount")}</CardTitle>
				</CardHeader>
				<CardContent>
					<AccountForm
						defaultValues={{
							...item,
							accountIban: item.accountIban ?? undefined,
							accountLud16: item.accountLud16 ?? undefined,
							accountSpark: item.accountSpark
								? {
										...item.accountSpark,
										mnemonicVariant: "manual",
									}
								: undefined,
							accountNwc: item.accountNwc ?? undefined,
							accountCashRegister: item.accountCashRegister ?? undefined,
						}}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
