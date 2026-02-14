"use client";

import { type Id, sqliteTrue } from "@evolu/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AccountForm } from "@/app/admin/(private)/accounts/account-form";
import { FadeHeader } from "@/components/fade-header";
import { ResponsiveCard } from "@/components/responsive-card";
import { CardContent } from "@/components/ui/card";
import { useCreateQuery } from "@/hooks/use-create-query";
import { useEvoluQuery } from "@/hooks/use-evolu-query";

export default function Page() {
	const { t } = useTranslation();
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id");
	if (id === null) {
		throw Promise.reject();
	}

	const query = useCreateQuery(
		(db) =>
			db
				.selectFrom("account")
				.leftJoin("accountIban", "accountIban.id", "account.id")
				.leftJoin("accountLud16", "accountLud16.id", "account.id")
				.leftJoin("accountSpark", "accountSpark.id", "account.id")
				.leftJoin("accountNwc", "accountNwc.id", "account.id")
				.leftJoin("accountCashRegister", "accountCashRegister.id", "account.id")
				.select([
					"account.id as id",
					"account.name as name",
					"account._tag as _tag",
					"accountIban.iban as accountIban.iban",
					"accountIban.currency as accountIban.currency",
					"accountLud16.lud16 as accountLud16.lud16",
					"accountSpark.mnemonic as accountSpark.mnemonic",
					"accountNwc.credentials as accountNwc.credentials",
					"accountCashRegister.currency as accountCashRegister.currency",
				] as const)
				.where("account.isDeleted", "is not", sqliteTrue)
				.where("account.id", "=", id as Id),
		[id],
	);
	const { data } = useEvoluQuery(query);

	const item = data && data[0];

	return (
		<div className="space-y-8 w-full px-4">
			<div className={"h-10"} />
			<FadeHeader title={t("settings:page.navigation.connectedWallets")} />

			<ResponsiveCard className="w-full max-w-xl" variant={"transparent"}>
				<CardContent>
					<AccountForm
						tagFilter={["accountSpark", "accountNwc"]}
						key={item ? "yes" : "no"}
						defaultValues={
							item
								? {
										...item,
										mnemonicVariant: "manual",
									}
								: undefined
						}
						onSuccess={() => router.back()}
					/>
				</CardContent>
			</ResponsiveCard>
		</div>
	);
}
