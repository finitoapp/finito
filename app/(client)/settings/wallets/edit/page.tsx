"use client";

import type { Id } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";
import { useEvoluQuery } from "@/hooks/use-evolu-query";
import { createGetAccountQuery } from "@/lib/evolu/queries/account";

export default function Page() {
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
			router.replace("/settings/wallets");
		}
	}, [item, router]);

	if (item === undefined) {
		return null;
	}

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-8"} />
			<FadeHeader title={t("settings:page.navigation.connectedWallets")} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<AccountForm
						tagFilter={["accountSpark", "accountNwc"]}
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
